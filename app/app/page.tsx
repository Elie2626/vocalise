"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/lib/auth-context";
import { UploadDropzone, type UploadedFile } from "@/components/UploadDropzone";
import { TranscriptionHistoryList } from "@/components/TranscriptionHistoryList";

type Tab = "upload" | "link";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upload");
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submittingLink, setSubmittingLink] = useState(false);

  const startTranscription = useCallback(
    async (payload: Record<string, unknown>, id: string) => {
      if (!user) return;
      const token = await user.getIdToken();
      fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...payload }),
      }).catch((err) => console.error("Transcription request failed", err));
      router.push(`/app/transcription/${id}`);
    },
    [user, router]
  );

  const handleUploaded = useCallback(
    (file: UploadedFile) => startTranscription({ ...file }, uuidv4()),
    [startTranscription]
  );

  async function handleLinkSubmit(event: FormEvent) {
    event.preventDefault();
    setLinkError(null);
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      setLinkError("Entrez un lien valide commençant par http(s)://");
      return;
    }
    setSubmittingLink(true);
    await startTranscription({ url: trimmed }, uuidv4());
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle transcription</h1>
        <p className="mt-1 text-(--color-foreground-muted)">
          Déposez un fichier ou collez un lien pour lancer la transcription.
        </p>

        <div
          role="tablist"
          aria-label="Source de la transcription"
          className="mt-6 inline-flex gap-1 rounded-full border border-(--color-border) glass p-1"
        >
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")} id="tab-upload" controls="panel-upload">
            Depuis un fichier
          </TabButton>
          <TabButton active={tab === "link"} onClick={() => setTab("link")} id="tab-link" controls="panel-link">
            Depuis un lien
          </TabButton>
        </div>

        <div className="mt-5">
          {tab === "upload" ? (
            <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload">
              <UploadDropzone onUploaded={handleUploaded} />
            </div>
          ) : (
            <form
              id="panel-link"
              role="tabpanel"
              aria-labelledby="tab-link"
              onSubmit={handleLinkSubmit}
              className="glass rounded-2xl p-6"
              noValidate
            >
              <label htmlFor="source-url" className="text-sm font-medium">
                Lien vers un fichier audio/vidéo ou une vidéo YouTube
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id="source-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://… ou https://youtu.be/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-(--color-bg-elev) px-3 py-2.5 text-base outline-none focus:border-(--color-primary)"
                />
                <button
                  type="submit"
                  disabled={submittingLink}
                  className="flex h-11 shrink-0 items-center justify-center rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-60"
                >
                  {submittingLink ? "Envoi…" : "Transcrire"}
                </button>
              </div>
              {linkError && (
                <p role="alert" className="mt-3 rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)">
                  {linkError}
                </p>
              )}
              <p className="mt-3 text-xs text-(--color-foreground-muted)">
                Astuce : pour un vocal WhatsApp, enregistre-le puis utilise l&apos;onglet « Depuis un
                fichier ». Les liens YouTube fonctionnent en local mais peuvent échouer une fois en
                ligne (restriction YouTube).
              </p>
            </form>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Historique</h2>
        <div className="mt-4">
          <TranscriptionHistoryList uid={user.uid} />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  id,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  id: string;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-(--color-primary) text-(--color-on-primary)"
          : "text-(--color-foreground-muted) hover:text-(--color-foreground)"
      }`}
    >
      {children}
    </button>
  );
}
