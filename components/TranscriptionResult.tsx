"use client";

import { useState } from "react";
import type { Transcription } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import { downloadTextFile, downloadBlob } from "@/lib/download";
import { buildDocxBlob } from "@/lib/docx-export";
import { downloadTranscriptionPdf } from "@/lib/pdf-export";
import { AnnotatedTranscript } from "@/components/AnnotatedTranscript";

const buttonClass =
  "flex h-11 items-center justify-center gap-2 rounded-lg border border-(--color-border) px-4 text-sm font-medium transition-colors hover:bg-(--color-bg) disabled:opacity-60";

export function TranscriptionResult({ transcription }: { transcription: Transcription }) {
  const [copied, setCopied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  if (transcription.status === "processing") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 glass rounded-2xl p-6"
      >
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
        />
        <p className="text-sm text-(--color-foreground-muted)">
          Transcription en cours, cela peut prendre quelques minutes…
        </p>
      </div>
    );
  }

  if (transcription.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-(--color-error) bg-(--color-error-bg) p-6 text-sm text-(--color-error)"
      >
        {transcription.error ?? "La transcription a échoué."}
      </div>
    );
  }

  const baseName = transcription.fileName.replace(/\.[^/.]+$/, "") || "transcription";

  async function handleCopy() {
    if (!transcription.text) return;
    await navigator.clipboard.writeText(transcription.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownloadTxt() {
    if (!transcription.text) return;
    downloadTextFile(`${baseName}.txt`, transcription.text);
  }

  async function handleDownloadDocx() {
    setExportingDocx(true);
    try {
      const blob = await buildDocxBlob(transcription);
      downloadBlob(`${baseName}.docx`, blob);
    } finally {
      setExportingDocx(false);
    }
  }

  async function handleDownloadPdf() {
    setExportingPdf(true);
    try {
      await downloadTranscriptionPdf(transcription);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleCopy} className={buttonClass}>
          <span aria-live="polite">{copied ? "Copié !" : "Copier le texte"}</span>
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={exportingPdf}
          className={buttonClass}
        >
          {exportingPdf ? "Génération…" : "Télécharger .pdf"}
        </button>
        <button type="button" onClick={handleDownloadTxt} className={buttonClass}>
          Télécharger .txt
        </button>
        <button
          type="button"
          onClick={handleDownloadDocx}
          disabled={exportingDocx}
          className={buttonClass}
        >
          {exportingDocx ? "Génération…" : "Télécharger .docx"}
        </button>
      </div>

      {transcription.summary && (
        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold">Résumé</h2>
          <p className="mt-2 text-sm leading-relaxed text-(--color-foreground-muted)">
            {transcription.summary}
          </p>
        </section>
      )}

      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold">Texte complet</h2>
        <div className="mt-2">
          <AnnotatedTranscript
            analysis={transcription.analysis}
            fallbackText={transcription.text ?? ""}
          />
        </div>
      </section>

      {transcription.segments && transcription.segments.length > 0 && (
        <details className="glass rounded-2xl p-6">
          <summary className="cursor-pointer font-semibold">Segments horodatés</summary>
          <ol className="mt-4 flex flex-col gap-3">
            {transcription.segments.map((seg, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono tabular-nums text-(--color-foreground-muted)">
                  {formatTimestamp(seg.start)}
                </span>
                <span>{seg.text}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
