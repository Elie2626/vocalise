export type TranscriptionStatus = "processing" | "done" | "error";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

/** Un fragment consécutif du texte : soit langue principale, soit mot étranger annoté. */
export interface LanguageRun {
  text: string;
  /** Langue (en français) si le fragment n'est pas dans la langue principale. */
  lang?: string;
  /** Traduction dans la langue principale. */
  translation?: string;
  /** L'IA n'est pas sûre du sens / de la transcription de ce fragment. */
  uncertain?: boolean;
  /** Courte explication quand uncertain. */
  note?: string;
}

export interface MultilingualAnalysis {
  mainLanguage: string;
  runs: LanguageRun[];
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
  analysis: MultilingualAnalysis | null;
  /** L'utilisateur a demandé un schéma logique à la création. */
  wantsDiagram?: boolean;
  /** Code Mermaid du schéma logique généré, null si non demandé/échec. */
  diagram: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
