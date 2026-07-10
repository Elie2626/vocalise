"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/lib/auth-context";
import { uploadAndTranscribe, UploadValidationError, MAX_SIZE_BYTES } from "@/lib/upload";

type Phase = "idle" | "recording" | "processing";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "";
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  return "webm";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// À ~48 kbps opus, 4,5 Mo ≈ 12-13 min. On coupe un peu avant par sécurité.
const MAX_RECORD_SECONDS = 12 * 60;

export function RecordPanel({ onStarted }: { onStarted: (transcriptionId: string) => void }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  // Chrono
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Coupure automatique avant la limite de taille
  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_RECORD_SECONDS) {
      recorderRef.current?.stop();
    }
  }, [phase, seconds]);

  async function startRecording() {
    setError(null);
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setPhase("recording");
    } catch {
      setError(
        "Impossible d'accéder au micro. Autorisez l'accès au microphone dans votre navigateur."
      );
    }
  }

  async function handleStop() {
    cleanupStream();
    const mime = mimeRef.current || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];

    if (blob.size === 0) {
      setError("Aucun son n'a été enregistré. Réessayez.");
      setPhase("idle");
      return;
    }
    if (blob.size > MAX_SIZE_BYTES) {
      setError("L'enregistrement est trop long. Limitez-vous à ~12 minutes.");
      setPhase("idle");
      return;
    }

    setPhase("processing");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const file = new File([blob], `enregistrement-${stamp}.${extForMime(mime)}`, { type: mime });
    const id = uuidv4();
    try {
      if (!user) throw new Error("no user");
      await uploadAndTranscribe(user, file, id);
      onStarted(id);
    } catch (err) {
      setError(
        err instanceof UploadValidationError
          ? err.message
          : "Échec de l'envoi de l'enregistrement. Réessayez."
      );
      setPhase("idle");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  return (
    <div className="glass flex flex-col items-center gap-5 rounded-2xl px-6 py-10 text-center">
      {phase === "processing" ? (
        <>
          <span
            aria-hidden
            className="h-12 w-12 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
          />
          <p role="status" className="text-sm text-(--color-foreground-muted)">
            Envoi et transcription en cours…
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={phase === "recording" ? stopRecording : startRecording}
            aria-label={phase === "recording" ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
              phase === "recording"
                ? "bg-(--color-error) text-white"
                : "bg-(--color-primary) text-(--color-on-primary) hover:bg-(--color-primary-hover)"
            }`}
          >
            {phase === "recording" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-(--color-error) opacity-40" />
            )}
            {phase === "recording" ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            )}
          </button>

          {phase === "recording" ? (
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{formatDuration(seconds)}</p>
              <p className="mt-1 text-sm text-(--color-foreground-muted)">
                Enregistrement… appuyez pour arrêter et transcrire
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">Parlez en direct</p>
              <p className="mt-1 text-sm text-(--color-foreground-muted)">
                Appuyez pour enregistrer. À l&apos;arrêt, on transcrit et vous pourrez télécharger
                en PDF, Word ou texte. (jusqu&apos;à ~12 min)
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)">
          {error}
        </p>
      )}
    </div>
  );
}
