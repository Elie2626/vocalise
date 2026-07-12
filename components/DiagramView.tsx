"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "@/lib/download";

export function DiagramView({ code, fileBaseName }: { code: string; fileBaseName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "strict",
        });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg: out } = await mermaid.render(id, code);
        if (!cancelled) setSvg(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function downloadSvg() {
    if (!svg) return;
    downloadBlob(`${fileBaseName}-schema.svg`, new Blob([svg], { type: "image/svg+xml" }));
  }

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Schéma logique</h2>
        <div className="flex gap-2">
          {svg && (
            <button
              type="button"
              onClick={downloadSvg}
              className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium transition-colors hover:bg-(--color-bg)"
            >
              Télécharger .svg
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSource((s) => !s)}
            className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium transition-colors hover:bg-(--color-bg)"
          >
            {showSource ? "Masquer le code" : "Voir le code"}
          </button>
        </div>
      </div>

      {failed ? (
        <p className="mt-3 text-sm text-(--color-foreground-muted)">
          Le schéma n&apos;a pas pu être affiché. Le code source reste disponible ci-dessous.
        </p>
      ) : svg ? (
        <div
          ref={containerRef}
          className="mt-4 overflow-x-auto rounded-xl bg-(--color-surface-raised) p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          // Le SVG vient de Mermaid en mode strict (pas de HTML utilisateur).
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="mt-3 text-sm text-(--color-foreground-muted)">Génération du schéma…</p>
      )}

      {(showSource || failed) && (
        <pre className="mt-4 overflow-x-auto rounded-xl bg-(--color-bg-elev) p-4 text-xs">
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
}
