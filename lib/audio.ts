import "server-only";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "node:fs";
import path from "node:path";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// 20 min chunks stay well under Whisper's 25MB upload limit at 64kbps mono.
const CHUNK_SECONDS = 20 * 60;
export const MAX_SINGLE_FILE_BYTES = 24 * 1024 * 1024;

function parseTimemark(mark: string | undefined): number {
  if (!mark) return 0;
  const parts = mark.split(":").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** Convertit en mp3 mono 16 kHz nettoyé et renvoie la durée audio (secondes). */
export function normalizeToMp3(inputPath: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let inputDuration = 0;
    let lastTimemark = 0;
    ffmpeg(inputPath)
      .noVideo()
      // Nettoyage léger pour améliorer la clarté de la voix avant transcription :
      // coupe les basses fréquences (bruits de fond), égalise le volume.
      .audioFilters(["highpass=f=80", "dynaudnorm=f=200:g=11"])
      .audioCodec("libmp3lame")
      .audioBitrate("64k")
      .audioChannels(1)
      .audioFrequency(16000)
      .output(outputPath)
      .on("codecData", (data: { duration?: string }) => {
        inputDuration = parseTimemark(data.duration);
      })
      .on("progress", (p: { timemark?: string }) => {
        lastTimemark = Math.max(lastTimemark, parseTimemark(p.timemark));
      })
      .on("end", () => {
        if (inputDuration > 0) return resolve(inputDuration);
        if (lastTimemark > 0) return resolve(lastTimemark);
        // Repli : 64 kbit/s → 8000 octets/s.
        try {
          resolve(fs.statSync(outputPath).size / 8000);
        } catch {
          resolve(0);
        }
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

export function splitIntoChunks(inputPath: string, outputDir: string): Promise<string[]> {
  const pattern = path.join(outputDir, "chunk-%03d.mp3");
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-f", "segment",
        "-segment_time", String(CHUNK_SECONDS),
        "-c", "copy",
        "-reset_timestamps", "1",
      ])
      .output(pattern)
      .on("end", () => {
        const files = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith("chunk-"))
          .sort()
          .map((f) => path.join(outputDir, f));
        resolve(files);
      })
      .on("error", (err) => reject(err))
      .run();
  });
}
