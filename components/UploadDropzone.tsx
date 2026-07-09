"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadFileToStorage, UploadValidationError, type UploadedFile } from "@/lib/upload";

export type { UploadedFile };

export function UploadDropzone({
  onUploaded,
  disabled,
}: {
  onUploaded: (file: UploadedFile) => void;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user) return;
      const file = files[0];
      setError(null);
      setActiveFileName(file.name);
      setProgress(0);

      try {
        const uploaded = await uploadFileToStorage(user, file, setProgress);
        setProgress(null);
        setActiveFileName(null);
        onUploaded(uploaded);
      } catch (err) {
        setProgress(null);
        setActiveFileName(null);
        setError(
          err instanceof UploadValidationError
            ? err.message
            : "Échec de l'envoi du fichier. Réessayez."
        );
      }
    },
    [user, onUploaded]
  );

  const isBusy = disabled || progress !== null;

  return (
    <div>
      <div
        role="button"
        tabIndex={isBusy ? -1 : 0}
        aria-disabled={isBusy}
        onClick={() => !isBusy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!isBusy && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (!isBusy) handleFiles(e.dataTransfer.files);
        }}
        className={`glass flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl !border-2 !border-dashed px-6 py-12 text-center transition-colors ${
          dragActive
            ? "!border-(--color-primary) bg-(--color-primary)/10"
            : "!border-(--color-border-strong)"
        } ${isBusy ? "cursor-not-allowed opacity-70" : "hover:!border-(--color-primary)"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.ogg,.oga,.m4a"
          className="sr-only"
          disabled={isBusy}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-primary) text-(--color-on-primary)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>

        {progress !== null ? (
          <div className="w-full max-w-xs">
            <p className="mb-2 truncate text-sm font-medium">{activeFileName}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-border)">
              <div
                className="h-full rounded-full bg-(--color-primary) transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-(--color-foreground-muted)">
              Envoi en cours… {progress}%
            </p>
          </div>
        ) : (
          <>
            <p className="font-medium">Glissez-déposez un fichier ici</p>
            <p className="text-sm text-(--color-foreground-muted)">
              ou cliquez pour parcourir — audio ou vidéo, jusqu&apos;à 300 Mo
            </p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)">
          {error}
        </p>
      )}
    </div>
  );
}
