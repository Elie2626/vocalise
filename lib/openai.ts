import "server-only";
import OpenAI from "openai";
import fs from "node:fs";
import type { TranscriptionSegment } from "@/lib/types";

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

export async function transcribeAudioFile(filePath: string): Promise<WhisperResult> {
  const response = await getClient().audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
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
