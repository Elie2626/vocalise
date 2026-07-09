export type TranscriptionStatus = "processing" | "done" | "error";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  id: string;
  ownerUid: string;
  /** Chemin Storage pour un upload, null pour une source par lien. */
  storagePath: string | null;
  /** URL source pour une ingestion par lien, null pour un upload. */
  sourceUrl: string | null;
  fileName: string;
  sourceKind: "audio" | "video";
  mimeType: string;
  durationSeconds: number | null;
  status: TranscriptionStatus;
  text: string | null;
  summary: string | null;
  segments: TranscriptionSegment[] | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
