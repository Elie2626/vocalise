import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

/** Adresse expéditrice. onboarding@resend.dev fonctionne sans domaine vérifié (tests). */
function fromAddress(): string {
  return process.env.RESEND_FROM || "Vocalise <onboarding@resend.dev>";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface SendTranscriptionParams {
  to: string[];
  fileName: string;
  text: string;
  summary?: string | null;
  pdfBase64: string;
}

export async function sendTranscriptionEmail(params: SendTranscriptionParams): Promise<void> {
  // Nom nettoyé : pas de caractères de contrôle (injection d'en-têtes), longueur bornée.
  const baseName =
    params.fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 80)
      .trim() || "transcription";
  const intro = params.summary
    ? `Résumé :\n${params.summary}\n\n---\n\nTranscription :\n`
    : "Transcription :\n";

  const { error } = await getClient().emails.send({
    from: fromAddress(),
    to: params.to,
    subject: `Transcription — ${baseName}`,
    text: `${intro}${params.text}\n\n— Envoyé via Vocalise`,
    attachments: [
      {
        filename: `${baseName}.pdf`,
        content: params.pdfBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Échec de l'envoi de l'email.");
  }
}
