"use client";

import { useState } from "react";
import Link from "next/link";
import type { Transcription } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import { downloadTextFile, downloadBlob } from "@/lib/download";
import { buildDocxBlob } from "@/lib/docx-export";
import { downloadTranscriptionPdf, buildTranscriptionPdfBase64 } from "@/lib/pdf-export";
import { AnnotatedTranscript } from "@/components/AnnotatedTranscript";
import { DiagramView } from "@/components/DiagramView";
import { useAuth } from "@/lib/auth-context";

type SendState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "sent"; count: number }
  | { phase: "error"; message: string; noRecipients?: boolean };

const buttonClass =
  "flex h-11 items-center justify-center gap-2 rounded-lg border border-(--color-border) px-4 text-sm font-medium transition-colors hover:bg-(--color-bg) disabled:opacity-60";

export function TranscriptionResult({ transcription }: { transcription: Transcription }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [send, setSend] = useState<SendState>({ phase: "idle" });

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
        {transcription.errorCode === "not_covered" && (
          <Link
            href="/app/billing"
            className="mt-3 flex h-11 w-fit items-center rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary)"
          >
            Voir les abonnements
          </Link>
        )}
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

  async function handleSendEmail() {
    if (!user) return;
    setSend({ phase: "sending" });
    try {
      const pdfBase64 = await buildTranscriptionPdfBase64(transcription);
      const token = await user.getIdToken();
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcriptionId: transcription.id, pdfBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSend({
          phase: "error",
          message: data?.error ?? "L'envoi a échoué.",
          noRecipients: typeof data?.error === "string" && data.error.includes("destinataire"),
        });
        return;
      }
      setSend({ phase: "sent", count: data.count ?? 0 });
    } catch {
      setSend({ phase: "error", message: "L'envoi a échoué. Réessayez." });
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

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Envoyer par email</h2>
            <p className="mt-0.5 text-sm text-(--color-foreground-muted)">
              Envoie cette transcription (PDF) aux destinataires de votre compte.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={send.phase === "sending"}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-60"
          >
            {send.phase === "sending" ? "Envoi…" : "Valider et envoyer"}
          </button>
        </div>

        {send.phase === "sent" && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 rounded-lg bg-(--color-success-bg) px-3 py-2 text-sm text-(--color-success)"
          >
            Envoyé à {send.count} destinataire{send.count > 1 ? "s" : ""}.
          </p>
        )}
        {send.phase === "error" && (
          <p role="alert" className="mt-3 rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)">
            {send.message}
            {send.noRecipients && (
              <>
                {" "}
                <Link href="/app/settings" className="font-medium underline">
                  Ajouter des destinataires
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {transcription.summary && (
        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold">Résumé</h2>
          <p className="mt-2 text-sm leading-relaxed text-(--color-foreground-muted)">
            {transcription.summary}
          </p>
        </section>
      )}

      {transcription.diagram ? (
        <DiagramView code={transcription.diagram} fileBaseName={baseName} />
      ) : (
        transcription.wantsDiagram && (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold">Schéma logique</h2>
            <p className="mt-2 text-sm text-(--color-foreground-muted)">
              Aucun schéma n&apos;a pu être généré à partir de ce contenu.
            </p>
          </section>
        )
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
