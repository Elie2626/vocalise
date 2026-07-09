"use client";

import { useEffect, useRef, useState } from "react";
import type { MultilingualAnalysis, LanguageRun } from "@/lib/types";

export function AnnotatedTranscript({
  analysis,
  fallbackText,
}: {
  analysis: MultilingualAnalysis | null;
  fallbackText: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!analysis || analysis.runs.length === 0) {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{fallbackText}</p>;
  }

  const hasForeign = analysis.runs.some((r) => r.lang);

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {analysis.runs.map((run, i) =>
          run.lang ? (
            <ForeignWord
              key={i}
              run={run}
              open={openIndex === i}
              onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
              onClose={() => setOpenIndex(null)}
            />
          ) : (
            <span key={i}>{run.text}</span>
          )
        )}
      </p>

      {hasForeign && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-(--color-border) pt-3 text-xs text-(--color-foreground-muted)">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded border-b-2 border-dotted border-(--color-secondary) align-middle" />
            Mot dans une autre langue — cliquez pour la traduction
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded border-b-2 border-dotted border-(--color-error) align-middle" />
            <span className="text-(--color-error)">Rouge</span> = l&apos;IA n&apos;est pas sûre du sens
          </span>
        </div>
      )}
    </div>
  );
}

function ForeignWord({
  run,
  open,
  onToggle,
  onClose,
}: {
  run: LanguageRun;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const uncertain = run.uncertain;

  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={
          uncertain
            ? `${run.text} — sens incertain, cliquez pour l'explication`
            : `${run.text} — ${run.lang}, cliquez pour la traduction`
        }
        className={`cursor-pointer rounded-sm border-b-2 border-dotted bg-transparent px-0.5 font-medium transition-colors ${
          uncertain
            ? "border-(--color-error) text-(--color-error) hover:bg-(--color-error-bg)"
            : "border-(--color-secondary) text-(--color-secondary) hover:bg-(--color-secondary)/10"
        }`}
      >
        {run.text}
      </button>

      {open && (
        <span
          role="dialog"
          className="glass-strong absolute bottom-full left-0 z-30 mb-2 block w-64 rounded-xl p-3 text-left text-xs shadow-xl"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-(--color-surface-raised) px-2 py-0.5 font-medium capitalize">
              {run.lang}
            </span>
            {uncertain && (
              <span className="rounded-full bg-(--color-error-bg) px-2 py-0.5 font-medium text-(--color-error)">
                Incertain
              </span>
            )}
          </span>

          {uncertain ? (
            <span className="mt-2 block leading-relaxed text-(--color-foreground)">
              L&apos;IA n&apos;est pas sûre de ce que ce mot veut dire
              {run.translation ? (
                <>
                  {" "}— peut-être «&nbsp;{run.translation}&nbsp;».
                </>
              ) : (
                "."
              )}
              {run.note && (
                <span className="mt-1 block text-(--color-foreground-muted)">{run.note}</span>
              )}
            </span>
          ) : (
            <span className="mt-2 block leading-relaxed">
              <span className="text-(--color-foreground-muted)">Traduction&nbsp;:</span>{" "}
              <span className="font-medium text-(--color-foreground)">
                {run.translation || "—"}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
