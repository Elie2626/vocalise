import { ref, uploadBytesResumable } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import type { User } from "firebase/auth";
import { storage } from "@/lib/firebase/client";

export const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "ogg", "oga", "opus", "wav", "aac", "mp4", "mov", "webm"];
export const MAX_SIZE_BYTES = 300 * 1024 * 1024;

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sourceKind: "audio" | "video";
}

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

/** Valide et téléverse un fichier vers Storage. onProgress reçoit 0..100. */
export function uploadFileToStorage(
  user: User,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFile> {
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
    throw new UploadValidationError("Le fichier dépasse la taille maximale de 300 Mo.");
  }

  const fileId = uuidv4();
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const storagePath = `users/${user.uid}/uploads/${fileId}-${safeName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || undefined,
    });
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (err) => reject(err),
      () => {
        resolve({
          storagePath,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sourceKind,
        });
      }
    );
  });
}
