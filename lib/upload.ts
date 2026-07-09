import type { User } from "firebase/auth";

export const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "ogg", "oga", "opus", "wav", "aac", "mp4", "mov", "webm"];

// Vercel limite le corps des requêtes serverless à ~4,5 Mo.
// Assez pour ~20 min de vocal ; les gros fichiers passent par « Depuis un lien ».
export const MAX_SIZE_BYTES = 4.5 * 1024 * 1024;

export function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function guessSourceKind(file: File): "audio" | "video" | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = extensionOf(file.name);
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  if (["mp3", "m4a", "ogg", "oga", "opus", "wav", "aac"].includes(ext)) return "audio";
  return null;
}

export class UploadValidationError extends Error {}

export function validateMediaFile(file: File): void {
  const ext = extensionOf(file.name);
  const sourceKind = guessSourceKind(file);
  const hasMediaMime = file.type.startsWith("audio/") || file.type.startsWith("video/");

  // On accepte si l'extension est connue OU si le type MIME est un média
  // (cas des fichiers partagés depuis WhatsApp, parfois sans extension).
  if (!sourceKind || (!ACCEPTED_EXTENSIONS.includes(ext) && !hasMediaMime)) {
    throw new UploadValidationError(
      "Format non supporté. Utilisez un fichier audio (mp3, m4a, ogg, opus, wav, aac) ou vidéo (mp4, mov, webm)."
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadValidationError(
      "Le fichier dépasse 4,5 Mo. Pour les gros fichiers (vidéos), utilisez l'onglet « Depuis un lien »."
    );
  }
}

/**
 * Envoie le fichier directement à /api/transcribe (multipart).
 * Résout dès que l'ENVOI est terminé (la transcription continue côté serveur) —
 * le résultat arrive ensuite dans Firestore via onSnapshot.
 */
export async function uploadAndTranscribe(
  user: User,
  file: File,
  transcriptionId: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  validateMediaFile(file);
  const token = await user.getIdToken();

  const form = new FormData();
  form.append("id", transcriptionId);
  form.append("file", file, file.name || "audio");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/transcribe");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    // L'upload est fini : on n'attend pas la fin de la transcription.
    xhr.upload.onload = () => resolve();
    xhr.onerror = () => reject(new Error("upload failed"));
    // Si le serveur répond une erreur AVANT la fin de l'upload (ex: 402/413).
    xhr.onload = () => {
      if (xhr.status >= 400) reject(new Error(`server ${xhr.status}`));
    };

    xhr.send(form);
  });
}
