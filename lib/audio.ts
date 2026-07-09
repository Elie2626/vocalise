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

export function normalizeToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("64k")
      .audioChannels(1)
      .audioFrequency(16000)
      .output(outputPath)
      .on("end", () => resolve())
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
