import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { requireUid, adminDb, AuthError } from "@/lib/firebase/admin";
import {
  transcribeText,
  transcribeTimestamps,
  summarizeText,
  analyzeMultilingual,
  generateDiagram,
} from "@/lib/openai";
import { normalizeToMp3, splitIntoChunks, MAX_SINGLE_FILE_BYTES } from "@/lib/audio";
import { fetchSourceFromUrl, isUnsupportedStreamingUrl } from "@/lib/fetch-source";
import { apiCostForMinutes, formatMinutes } from "@/lib/pricing";
import { decideCoverage, addMinutesUsed } from "@/lib/billing";
import { FieldValue } from "firebase-admin/firestore";
import type { Transcription, TranscriptionSegment } from "@/lib/types";

// Corps limité par Vercel à ~4,5 Mo : suffisant pour ~20 min de vocal.
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

/** Enregistre l'usage du mois pour un utilisateur (coût API + prix à l'utilisation). */
async function recordUsage(uid: string, durationSeconds: number) {
  const minutes = durationSeconds / 60;
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  await adminDb()
    .collection("users")
    .doc(uid)
    .collection("usage")
    .doc(period)
    .set(
      {
        period,
        minutes: FieldValue.increment(minutes),
        apiCost: FieldValue.increment(apiCostForMinutes(minutes)),
        transcriptions: FieldValue.increment(1),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
}

// Long audio/video needs more than the default 10s; requires a Vercel plan that allows it.
export const maxDuration = 300;

class NotCoveredError extends Error {}

/** Transcrit l'audio déjà normalisé (normalizedPath) et renvoie la mise à jour Firestore. */
async function runPipeline(
  normalizedPath: string,
  workDir: string,
  opts: { wantsDiagram: boolean; plain: boolean; vocabulary?: string }
) {
  const { wantsDiagram, plain, vocabulary } = opts;

  const { size } = await stat(normalizedPath);
  const chunkPaths =
    size <= MAX_SINGLE_FILE_BYTES ? [normalizedPath] : await splitIntoChunks(normalizedPath, workDir);

  let cumulativeOffset = 0;
  const allSegments: TranscriptionSegment[] = [];
  const textParts: string[] = [];

  for (const chunkPath of chunkPaths) {
    // Texte précis (gpt-4o-transcribe) + timestamps (Whisper) en parallèle.
    // La fin du texte précédent améliore la continuité entre chunks.
    const [text, timing] = await Promise.all([
      transcribeText(chunkPath, textParts.at(-1), vocabulary),
      transcribeTimestamps(chunkPath),
    ]);
    for (const seg of timing.segments) {
      allSegments.push({
        start: seg.start + cumulativeOffset,
        end: seg.end + cumulativeOffset,
        text: seg.text,
      });
    }
    textParts.push(text);
    cumulativeOffset += timing.duration;
  }

  const fullText = textParts.join(" ").replace(/\s+/g, " ").trim();

  // En mode "transcription seule", on saute résumé et analyse multilingue.
  const [summary, analysis, diagram] = await Promise.all([
    plain ? Promise.resolve("") : summarizeText(fullText),
    // L'analyse multilingue est optionnelle : un échec ne doit pas casser la transcription.
    plain ? Promise.resolve(null) : analyzeMultilingual(fullText).catch(() => null),
    // Schéma logique optionnel, uniquement si demandé.
    wantsDiagram ? generateDiagram(fullText).catch(() => null) : Promise.resolve(null),
  ]);

  return {
    status: "done" as const,
    text: fullText,
    summary,
    segments: allSegments,
    analysis,
    diagram,
    durationSeconds: cumulativeOffset,
    updatedAt: Date.now(),
  };
}

interface ParsedRequest {
  clientId?: string;
  sourceUrl?: string;
  file?: File;
  wantsDiagram: boolean;
  plain: boolean;
  vocabulary?: string;
}

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

async function parseRequest(request: NextRequest): Promise<ParsedRequest | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return null;
    const file = form.get("file");
    const id = form.get("id");
    const vocab = form.get("vocabulary");
    return {
      clientId: typeof id === "string" ? id : undefined,
      file: file instanceof File ? file : undefined,
      wantsDiagram: truthy(form.get("diagram")),
      plain: truthy(form.get("plain")),
      vocabulary: typeof vocab === "string" && vocab.trim() ? vocab.trim().slice(0, 800) : undefined,
    };
  }

  const body = await request.json().catch(() => null);
  if (!body) return null;
  return {
    clientId: typeof body.id === "string" ? body.id : undefined,
    sourceUrl: typeof body.url === "string" ? body.url : undefined,
    wantsDiagram: truthy(body.diagram),
    plain: truthy(body.plain),
    vocabulary:
      typeof body.vocabulary === "string" && body.vocabulary.trim()
        ? body.vocabulary.trim().slice(0, 800)
        : undefined,
  };
}

function guessKind(file: File): "audio" | "video" {
  if (file.type.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm"].includes(ext) ? "video" : "audio";
}

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

  const parsed = await parseRequest(request);
  if (!parsed || (!parsed.file && !parsed.sourceUrl)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { clientId, sourceUrl, file, wantsDiagram, plain, vocabulary } = parsed;

  if (clientId && !/^[A-Za-z0-9_-]{1,64}$/.test(clientId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (file && file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 4,5 Mo). Utilisez un lien pour les gros fichiers." },
      { status: 413 }
    );
  }
  if (sourceUrl) {
    try {
      new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
    }
  }

  const fileName: string = (file?.name || (sourceUrl ? "Fichier distant" : "Fichier")).slice(0, 120);
  const sourceKind: "audio" | "video" = file ? guessKind(file) : "audio";

  const collectionRef = adminDb().collection("users").doc(uid).collection("transcriptions");
  const docRef = clientId ? collectionRef.doc(clientId) : collectionRef.doc();
  const now = Date.now();
  const initial: Transcription = {
    id: docRef.id,
    ownerUid: uid,
    storagePath: null,
    sourceUrl: sourceUrl ?? null,
    fileName,
    sourceKind,
    mimeType: file?.type || "application/octet-stream",
    durationSeconds: null,
    status: "processing",
    text: null,
    summary: null,
    segments: null,
    analysis: null,
    wantsDiagram,
    diagram: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await docRef.set(initial);

  // Pré-contrôle avant tout travail coûteux (téléchargement, conversion) :
  // sans abonnement actif, on refuse tout de suite.
  const precheck = await decideCoverage(uid, 0);
  if (!precheck.ok && precheck.reason === "no_subscription") {
    const message = "Un abonnement est nécessaire pour transcrire. Choisissez une formule pour continuer.";
    await docRef.update({ status: "error", error: message, errorCode: "not_covered", updatedAt: Date.now() });
    return NextResponse.json({ error: message, code: "not_covered" }, { status: 402 });
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "vocalise-"));

  try {
    const originalPath = path.join(workDir, "source");

    if (file) {
      await writeFile(originalPath, Buffer.from(await file.arrayBuffer()));
    } else {
      const fetched = await fetchSourceFromUrl(sourceUrl!, workDir);
      // fetchSourceFromUrl écrit dans workDir/source ; on récupère aussi les métadonnées réelles.
      await docRef.update({
        fileName: fetched.fileName,
        sourceKind: fetched.sourceKind,
        mimeType: fetched.mimeType,
        updatedAt: Date.now(),
      });
    }

    // Conversion + durée, puis contrôle du paiement AVANT d'appeler OpenAI.
    const normalizedPath = path.join(workDir, "audio.mp3");
    const durationSeconds = await normalizeToMp3(originalPath, normalizedPath);
    const coverage = await decideCoverage(uid, durationSeconds);
    if (!coverage.ok) {
      throw new NotCoveredError(
        coverage.reason === "no_subscription"
          ? "Un abonnement est nécessaire pour transcrire. Choisissez une formule pour continuer."
          : `Quota de votre formule ${coverage.plan.name} atteint : il reste ${formatMinutes(coverage.remainingMinutes)} ce mois-ci et ce fichier dure ${formatMinutes(Math.ceil(durationSeconds / 60))}. Passez à une formule supérieure ou attendez le renouvellement.`
      );
    }

    const finalUpdate = await runPipeline(normalizedPath, workDir, { wantsDiagram, plain, vocabulary });
    await docRef.update({ ...finalUpdate, plan: coverage.plan.id });

    await addMinutesUsed(uid, (finalUpdate.durationSeconds || durationSeconds) / 60).catch((e) =>
      console.error("addMinutesUsed failed", e)
    );
    await recordUsage(uid, finalUpdate.durationSeconds || durationSeconds).catch((e) =>
      console.error("recordUsage failed", e)
    );

    return NextResponse.json({ ...initial, ...finalUpdate });
  } catch (error) {
    console.error("Transcription failed", error);
    if (error instanceof NotCoveredError) {
      await docRef.update({
        status: "error",
        error: error.message,
        errorCode: "not_covered",
        updatedAt: Date.now(),
      });
      return NextResponse.json({ error: error.message, code: "not_covered" }, { status: 402 });
    }
    const message =
      sourceUrl && isUnsupportedStreamingUrl(sourceUrl)
        ? "Les liens YouTube, TikTok, Instagram, etc. ne sont pas supportés. Collez un lien direct vers un fichier audio/vidéo, ou importez le fichier."
        : error instanceof Error && /http|lien|taille|autoris|audio ou vid|support/i.test(error.message)
          ? error.message
          : "La transcription a échoué. Réessayez avec un autre fichier ou lien.";
    await docRef.update({
      status: "error",
      error: message,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
