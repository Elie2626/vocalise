import { NextRequest, NextResponse } from "next/server";
import { requireUid, adminDb, AuthError } from "@/lib/firebase/admin";
import { sendTranscriptionEmail, isValidEmail } from "@/lib/email";
import type { Transcription } from "@/lib/types";

// Limite de taille du PDF accepté (base64), garde-fou.
const MAX_PDF_BASE64 = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let uid: string;
  try {
    uid = await requireUid(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const transcriptionId: unknown = body?.transcriptionId;
  const pdfBase64: unknown = body?.pdfBase64;

  if (typeof transcriptionId !== "string" || !transcriptionId) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof pdfBase64 !== "string" || !pdfBase64 || pdfBase64.length > MAX_PDF_BASE64) {
    return NextResponse.json({ error: "Pièce jointe invalide." }, { status: 400 });
  }

  // Transcription : lue côté serveur, on vérifie qu'elle appartient à l'utilisateur.
  const docSnap = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("transcriptions")
    .doc(transcriptionId)
    .get();

  if (!docSnap.exists) {
    return NextResponse.json({ error: "Transcription introuvable." }, { status: 404 });
  }
  const t = docSnap.data() as Transcription;
  if (t.status !== "done" || !t.text) {
    return NextResponse.json({ error: "La transcription n'est pas prête." }, { status: 400 });
  }

  // Destinataires : lus côté serveur (jamais fournis par le client → anti-spam).
  const settingsSnap = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("settings")
    .doc("account")
    .get();

  const recipients: string[] = Array.isArray(settingsSnap.data()?.recipients)
    ? (settingsSnap.data()!.recipients as unknown[]).filter(
        (r): r is string => typeof r === "string" && isValidEmail(r)
      )
    : [];

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Aucun destinataire configuré. Ajoutez-en dans les réglages." },
      { status: 400 }
    );
  }

  try {
    await sendTranscriptionEmail({
      to: recipients,
      fileName: t.fileName,
      text: t.text,
      summary: t.summary,
      pdfBase64,
    });
    return NextResponse.json({ ok: true, count: recipients.length });
  } catch (error) {
    console.error("Email send failed", error);
    return NextResponse.json(
      { error: "L'envoi de l'email a échoué. Vérifiez la configuration." },
      { status: 500 }
    );
  }
}
