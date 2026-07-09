import "server-only";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import ytdl from "@distube/ytdl-core";

const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

export interface FetchedSource {
  filePath: string;
  fileName: string;
  sourceKind: "audio" | "video";
  mimeType: string;
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "music.youtube.com"
    );
  } catch {
    return false;
  }
}

/** Rejette les cibles internes/privées pour limiter le SSRF. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seuls les liens http(s) sont acceptés.");
  }
  const host = url.hostname;

  const isPrivate = (ip: string): boolean => {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split(".").map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 127) return true;
    }
    if (net.isIPv6(ip) && (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80"))) {
      return true;
    }
    return false;
  };

  if (host === "localhost") {
    throw new Error("Adresse non autorisée.");
  }
  if (net.isIP(host) && isPrivate(host)) {
    throw new Error("Adresse non autorisée.");
  }
  // Résout le nom pour attraper les cibles internes cachées derrière un domaine.
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some((r) => isPrivate(r.address))) {
      throw new Error("Adresse non autorisée.");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Adresse non autorisée.") throw err;
    // Si la résolution échoue, on laisse fetch échouer plus loin.
  }
}

function guessKindFromMime(mime: string, fileName: string): "audio" | "video" {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm", "mkv", "avi"].includes(ext) ? "video" : "audio";
}

export async function downloadDirectUrl(rawUrl: string, destDir: string): Promise<FetchedSource> {
  const url = new URL(rawUrl);
  await assertPublicUrl(url);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  }

  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  if (mimeType && !mimeType.startsWith("audio/") && !mimeType.startsWith("video/") && mimeType !== "application/octet-stream") {
    throw new Error("Le lien ne pointe pas vers un fichier audio ou vidéo.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("Le fichier dépasse la taille maximale (500 Mo).");
  }

  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "media");
  const fileName = rawName.includes(".") ? rawName : `${rawName || "media"}`;
  const filePath = path.join(destDir, "source");

  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(filePath));

  return {
    filePath,
    fileName,
    mimeType: mimeType || "application/octet-stream",
    sourceKind: guessKindFromMime(mimeType, fileName),
  };
}

export async function downloadYouTube(rawUrl: string, destDir: string): Promise<FetchedSource> {
  if (!ytdl.validateURL(rawUrl)) {
    throw new Error("Lien YouTube invalide.");
  }

  const info = await ytdl.getInfo(rawUrl);
  const title = info.videoDetails.title.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim() || "youtube";
  const filePath = path.join(destDir, "source");

  await pipeline(
    ytdl.downloadFromInfo(info, { quality: "highestaudio", filter: "audioonly" }),
    createWriteStream(filePath)
  );

  return {
    filePath,
    fileName: `${title}.m4a`,
    mimeType: "audio/mp4",
    sourceKind: "audio",
  };
}

export async function fetchSourceFromUrl(rawUrl: string, destDir: string): Promise<FetchedSource> {
  return isYouTubeUrl(rawUrl)
    ? downloadYouTube(rawUrl, destDir)
    : downloadDirectUrl(rawUrl, destDir);
}
