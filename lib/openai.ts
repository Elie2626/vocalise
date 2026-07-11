import "server-only";
import OpenAI from "openai";
import fs from "node:fs";
import type { TranscriptionSegment, MultilingualAnalysis, LanguageRun } from "@/lib/types";

let client: OpenAI | null = null;

// Lazily constructed so importing this module doesn't require OPENAI_API_KEY
// at build time (Next.js evaluates route modules while collecting page data).
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface WhisperResult {
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
}

interface VerboseTranscription {
  text: string;
  duration?: number;
  segments?: { start: number; end: number; text: string }[];
}

// Oriente la transcription vers une ponctuation soignée et les accents français.
const TRANSCRIBE_PROMPT =
  "Transcription soignée, avec ponctuation, majuscules et accents corrects.";

/**
 * Texte haute précision via gpt-4o-transcribe (bien meilleur que Whisper).
 * Ne fournit pas de timestamps — ceux-ci viennent de Whisper en parallèle.
 */
export async function transcribeText(filePath: string, priorText?: string): Promise<string> {
  const response = await getClient().audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "gpt-4o-transcribe",
    response_format: "text",
    prompt: priorText ? priorText.slice(-400) : TRANSCRIBE_PROMPT,
  });
  const text = typeof response === "string" ? response : ((response as { text?: string }).text ?? "");
  return text.trim();
}

/** Segments horodatés + durée via Whisper (le seul modèle qui donne les timestamps). */
export async function transcribeTimestamps(filePath: string): Promise<WhisperResult> {
  const response = await getClient().audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    temperature: 0,
  });

  const result = response as unknown as VerboseTranscription;
  return {
    text: result.text.trim(),
    duration: result.duration ?? 0,
    segments: (result.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
  };
}

export async function summarizeText(text: string): Promise<string> {
  if (!text.trim()) return "";
  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "Tu résumes des transcriptions audio en français, en 2 à 4 phrases claires et fidèles au contenu. N'ajoute aucune information absente du texte fourni.",
      },
      { role: "user", content: text },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

const ANALYSIS_SYSTEM_PROMPT = `Tu analyses une transcription audio qui peut mélanger plusieurs langues.

Détermine la langue principale (celle majoritaire dans le texte).

Repère UNIQUEMENT les mots ou expressions qui ne sont PAS dans la langue principale (anglais, hébreu, arabe, espagnol, etc.). Ignore les emprunts totalement lexicalisés dans la langue principale.

Pour chacun, renvoie :
- "text": le mot/expression EXACTEMENT tel qu'il apparaît dans le texte (mêmes caractères et casse),
- "lang": le nom de la langue en français,
- "translation": la traduction dans la langue principale,
- "uncertain": true UNIQUEMENT si tu n'es pas sûr du sens ou de la façon dont le mot a été transcrit,
- "note": courte explication en français quand uncertain (pourquoi tu doutes).

Ne corrige pas l'orthographe du "text". Réponds STRICTEMENT en JSON:
{"mainLanguage":"...","foreign":[{"text":"...","lang":"...","translation":"...","uncertain":false}]}.`;

interface RawForeignItem {
  text?: unknown;
  lang?: unknown;
  translation?: unknown;
  uncertain?: unknown;
  note?: unknown;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reconstruit des "runs" en localisant chaque mot étranger dans le texte
 * d'origine. Déterministe → la concaténation des runs redonne toujours le texte.
 */
function buildRuns(text: string, foreign: LanguageRun[]): LanguageRun[] {
  interface Match {
    start: number;
    end: number;
    item: LanguageRun;
  }
  const matches: Match[] = [];

  for (const item of foreign) {
    if (!item.text) continue;
    // Frontières de "mot" tolérantes à l'Unicode (hébreu, arabe, accents…).
    let re: RegExp;
    try {
      re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(item.text)}(?![\\p{L}\\p{N}])`, "gu");
    } catch {
      re = new RegExp(escapeRegExp(item.text), "g");
    }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, item });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const runs: LanguageRun[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue; // chevauchement → on ignore
    if (match.start > cursor) runs.push({ text: text.slice(cursor, match.start) });
    runs.push({ ...match.item, text: text.slice(match.start, match.end) });
    cursor = match.end;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });

  return runs;
}

export async function analyzeMultilingual(text: string): Promise<MultilingualAnalysis | null> {
  if (!text.trim()) return null;

  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  let parsed: { mainLanguage?: unknown; foreign?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const foreignRaw = Array.isArray(parsed.foreign) ? parsed.foreign : [];
  const foreign: LanguageRun[] = [];
  for (const it of foreignRaw as RawForeignItem[]) {
    if (!it || typeof it.text !== "string" || !it.text) continue;
    foreign.push({
      text: it.text,
      lang: typeof it.lang === "string" ? it.lang : "autre langue",
      translation: typeof it.translation === "string" ? it.translation : undefined,
      uncertain: it.uncertain === true,
      note: typeof it.note === "string" ? it.note : undefined,
    });
  }

  const runs = buildRuns(text, foreign);

  return {
    mainLanguage: typeof parsed.mainLanguage === "string" ? parsed.mainLanguage : "inconnue",
    runs,
  };
}
