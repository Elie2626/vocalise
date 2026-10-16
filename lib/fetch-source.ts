import "server-only";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";

// 100 Mo : au-delà, la conversion + transcription ne tient pas dans le délai de la fonction.
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export interface FetchedSource {
  filePath: string;
  fileName: string;
  sourceKind: "audio" | "video";
  mimeType: string;
}

const STREAMING_HOSTS = [
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "vimeo.com",
  "dailymotion.com",
];

/** Plateformes de streaming qu'on ne peut pas télécharger de façon fiable/légale. */
export function isUnsupportedStreamingUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return STREAMING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const FORBIDDEN = "Adresse non autorisée.";
const MAX_REDIRECTS = 5;

/** Adresse non routable publiquement (réseau local, loopback, métadonnées cloud…). */
export function isPrivateIp(raw: string): boolean {
  let ip = raw.toLowerCase();
  // IPv4 encapsulée dans de l'IPv6 (::ffff:127.0.0.1).
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // lien local / métadonnées cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast et réservé
    );
  }
  if (net.isIPv6(ip)) {
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe8") ||
      ip.startsWith("fe9") ||
      ip.startsWith("fea") ||
      ip.startsWith("feb") ||
      ip.startsWith("ff") ||
      ip.startsWith("64:ff9b:") // NAT64
    );
  }
  return true; // format inconnu : on refuse
}

/** Rejette les cibles internes/privées pour limiter le SSRF. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seuls les liens http(s) sont acceptés.");
  }
  if (url.username || url.password) throw new Error(FORBIDDEN);
  if (url.port && !["80", "443"].includes(url.port)) throw new Error(FORBIDDEN);

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error(FORBIDDEN);
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error(FORBIDDEN);
    return;
  }
  // Résout le nom pour attraper les cibles internes cachées derrière un domaine.
  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("Lien injoignable.");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new Error(FORBIDDEN);
  }
}

/** fetch qui revérifie chaque redirection (sinon un lien public peut rediriger vers le réseau interne). */
async function safeFetch(start: URL): Promise<{ response: Response; finalUrl: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
      url = new URL(location, url);
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new Error("Trop de redirections.");
}

function guessKindFromMime(mime: string, fileName: string): "audio" | "video" {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm", "mkv", "avi"].includes(ext) ? "video" : "audio";
}

export async function downloadDirectUrl(rawUrl: string, destDir: string): Promise<FetchedSource> {
  const { response, finalUrl: url } = await safeFetch(new URL(rawUrl));
  if (!response.ok || !response.body) {
    throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  }

  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  if (mimeType && !mimeType.startsWith("audio/") && !mimeType.startsWith("video/") && mimeType !== "application/octet-stream") {
    throw new Error("Le lien ne pointe pas vers un fichier audio ou vidéo.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("Le fichier dépasse la taille maximale (100 Mo).");
  }

  let rawName = "media";
  try {
    rawName = decodeURIComponent(url.pathname.split("/").pop() || "media");
  } catch {
    // nom mal encodé : on garde "media"
  }
  const fileName = rawName.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "media";
  const filePath = path.join(destDir, "source");

  // Limite appliquée pendant le flux (le serveur distant peut mentir ou omettre la taille).
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > MAX_DOWNLOAD_BYTES) {
        cb(new Error("Le fichier dépasse la taille maximale (100 Mo)."));
      } else {
        cb(null, chunk);
      }
    },
  });
  await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(filePath));

  return {
    filePath,
    fileName,
    mimeType: mimeType || "application/octet-stream",
    sourceKind: guessKindFromMime(mimeType, fileName),
  };
}

export async function fetchSourceFromUrl(rawUrl: string, destDir: string): Promise<FetchedSource> {
  if (isUnsupportedStreamingUrl(rawUrl)) {
    throw new Error(
      "Les liens YouTube, TikTok, Instagram, etc. ne sont pas supportés. Collez un lien direct vers un fichier audio/vidéo, ou importez le fichier."
    );
  }
  return downloadDirectUrl(rawUrl, destDir);
}
