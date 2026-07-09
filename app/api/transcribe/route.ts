import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { requireUid, adminDb, adminStorage, AuthError } from "@/lib/firebase/admin";
import { transcribeAudioFile, summarizeText } from "@/lib/openai";
import { normalizeToMp3, splitIntoChunks, MAX_SINGLE_FILE_BYTES } from "@/lib/audio";
import { fetchSourceFromUrl, isYouTubeUrl } from "@/lib/fetch-source";
import type { Transcription, TranscriptionSegment } from "@/lib/types";

// Long audio/video needs more than the default 10s; requires a Vercel plan that allows it.
export const maxDuration = 300;

/** Transcrit un fichier source local (déjà téléchargé dans workDir) et met à jour Firestore. */
async function runPipeline(originalPath: string, workDir: string) {
  const normalizedPath = path.join(workDir, "audio.mp3");
  await normalizeToMp3(originalPath, normalizedPath);

  const { size } = await stat(normalizedPath);
  const chunkPaths =
    size <= MAX_SINGLE_FILE_BYTES ? [normalizedPath] : await splitIntoChunks(normalizedPath, workDir);

  let cumulativeOffset = 0;
  const allSegments: TranscriptionSegment[] = [];
  const textParts: string[] = [];

  for (const chunkPath of chunkPaths) {
    const result = await transcribeAudioFile(chunkPath);
    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + cumulativeOffset,
        end: seg.end + cumulativeOffset,
        text: seg.text,
      });
    }
    textParts.push(result.text);
    cumulativeOffset += result.duration;
  }

  const fullText = textParts.join(" ").replace(/\s+/g, " ").trim();
  const summary = await summarizeText(fullText);

  return {
    status: "done" as const,
    text: fullText,
    summary,
    segments: allSegments,
    durationSeconds: cumulativeOffset,
    updatedAt: Date.now(),
  };
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

  const body = await request.json().catch(() => null);
  const clientId: string | undefined = body?.id;
  const storagePath: string | undefined = body?.storagePath;
  const sourceUrl: string | undefined = body?.url;

  if (clientId && (clientId.includes("/") || clientId.length > 200)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  // Deux modes : upload (storagePath) ou lien (url).
  if (!storagePath && !sourceUrl) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (storagePath && !storagePath.startsWith(`users/${uid}/`)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (sourceUrl) {
    try {
      new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
    }
  }

  const isUpload = Boolean(storagePath);
  const fileName: string =
    body?.fileName ?? (sourceUrl ? (isYouTubeUrl(sourceUrl) ? "Vidéo YouTube" : "Fichier distant") : "Fichier");
  const sourceKind: "audio" | "video" = body?.sourceKind === "video" ? "video" : "audio";

  const collectionRef = adminDb().collection("users").doc(uid).collection("transcriptions");
  const docRef = clientId ? collectionRef.doc(clientId) : collectionRef.doc();
  const now = Date.now();
  const initial: Transcription = {
    id: docRef.id,
    ownerUid: uid,
    storagePath: storagePath ?? null,
    sourceUrl: sourceUrl ?? null,
    fileName,
    sourceKind,
    mimeType: body?.mimeType ?? "application/octet-stream",
    durationSeconds: null,
    status: "processing",
    text: null,
    summary: null,
    segments: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await docRef.set(initial);

  const workDir = await mkdtemp(path.join(tmpdir(), "vocalise-"));

  try {
    const originalPath = path.join(workDir, "source");

    if (isUpload) {
      const [fileBuffer] = await adminStorage().bucket().file(storagePath!).download();
      await writeFile(originalPath, fileBuffer);
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

    const finalUpdate = await runPipeline(originalPath, workDir);
    await docRef.update(finalUpdate);

    return NextResponse.json({ ...initial, ...finalUpdate });
  } catch (error) {
    console.error("Transcription failed", error);
    const message =
      sourceUrl && isYouTubeUrl(sourceUrl)
        ? "Impossible de récupérer cette vidéo YouTube (elle est peut-être protégée, ou l'hébergeur est bloqué par YouTube). Essayez un autre lien ou un upload de fichier."
        : error instanceof Error && /http|lien|taille|autoris|audio ou vid/i.test(error.message)
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
