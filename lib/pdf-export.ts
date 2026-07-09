import type { Transcription } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Construit le HTML (couleurs en hex, pas de variables) rendu ensuite en PDF. */
function buildPrintableHtml(t: Transcription): string {
  const parts: string[] = [];

  parts.push(
    `<h1 style="font-size:22px;font-weight:700;margin:0 0 4px;color:#111111;">${escapeHtml(
      t.fileName
    )}</h1>`
  );
  parts.push(
    `<p style="font-size:11px;color:#6b7280;margin:0 0 20px;">Transcription générée par Vocalise — ${new Date(
      t.createdAt
    ).toLocaleString("fr-FR")}</p>`
  );

  if (t.summary) {
    parts.push(
      `<h2 style="font-size:15px;font-weight:700;margin:0 0 6px;color:#111111;">Résumé</h2>` +
        `<p style="font-size:13px;line-height:1.6;margin:0 0 20px;color:#374151;">${escapeHtml(
          t.summary
        )}</p>`
    );
  }

  const foreign = (t.analysis?.runs ?? []).filter((r) => r.lang);
  if (foreign.length > 0) {
    const rows = foreign
      .map((r) => {
        const color = r.uncertain ? "#b91c1c" : "#0f7a5a";
        const label = r.uncertain
          ? `sens incertain${r.translation ? ` — peut-être « ${escapeHtml(r.translation)} »` : ""}`
          : escapeHtml(r.translation ?? "");
        return `<li style="margin:0 0 5px;font-size:12px;line-height:1.5;color:#374151;">
          <span style="font-weight:700;color:${color};">${escapeHtml(r.text)}</span>
          <span style="color:#9ca3af;"> · ${escapeHtml(r.lang ?? "")}</span> — ${label}
          ${r.note ? `<span style="color:#9ca3af;"> (${escapeHtml(r.note)})</span>` : ""}
        </li>`;
      })
      .join("");
    parts.push(
      `<h2 style="font-size:15px;font-weight:700;margin:0 0 6px;color:#111111;">Mots dans une autre langue</h2>` +
        `<ul style="margin:0 0 20px;padding-left:18px;">${rows}</ul>`
    );
  }

  parts.push(`<h2 style="font-size:15px;font-weight:700;margin:0 0 6px;color:#111111;">Transcription</h2>`);

  const runs = t.analysis?.runs;
  if (runs && runs.length > 0) {
    const body = runs
      .map((r) => {
        if (!r.lang) return escapeHtml(r.text);
        const color = r.uncertain ? "#b91c1c" : "#0f7a5a";
        return `<span style="color:${color};font-weight:600;">${escapeHtml(r.text)}</span>`;
      })
      .join("");
    parts.push(`<p style="font-size:13px;line-height:1.7;margin:0;color:#111111;white-space:pre-wrap;">${body}</p>`);
  } else {
    parts.push(
      `<p style="font-size:13px;line-height:1.7;margin:0;color:#111111;white-space:pre-wrap;">${escapeHtml(
        t.text ?? ""
      )}</p>`
    );
  }

  if (t.segments && t.segments.length > 0) {
    const segs = t.segments
      .map(
        (s) =>
          `<div style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#374151;">
            <span style="color:#9ca3af;font-variant-numeric:tabular-nums;">${formatTimestamp(
              s.start
            )}</span>  ${escapeHtml(s.text)}
          </div>`
      )
      .join("");
    parts.push(
      `<h2 style="font-size:15px;font-weight:700;margin:24px 0 6px;color:#111111;">Segments horodatés</h2>${segs}`
    );
  }

  return parts.join("");
}

export async function downloadTranscriptionPdf(t: Transcription): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-10000px;top:0;width:720px;padding:40px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;";
  container.innerHTML = buildPrintableHtml(t);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    // JPEG plutôt que PNG : bien plus léger pour de longues transcriptions,
    // texte reste net à cette échelle.
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 32;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    const contentH = pageH - margin * 2;

    let heightLeft = imgH;
    pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
    heightLeft -= contentH;

    while (heightLeft > 0) {
      pdf.addPage();
      const position = margin - (imgH - heightLeft);
      pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
      heightLeft -= contentH;
    }

    const baseName = t.fileName.replace(/\.[^/.]+$/, "") || "transcription";
    pdf.save(`${baseName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
