import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { Transcription } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";

export async function buildDocxBlob(transcription: Transcription): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: transcription.fileName, heading: HeadingLevel.HEADING_1 }),
  ];

  if (transcription.summary) {
    children.push(
      new Paragraph({ text: "Résumé", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Paragraph({ text: transcription.summary })
    );
  }

  const foreign = (transcription.analysis?.runs ?? []).filter((r) => r.lang);
  if (foreign.length > 0) {
    children.push(
      new Paragraph({
        text: "Mots dans une autre langue",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300 },
      })
    );
    for (const r of foreign) {
      const detail = r.uncertain
        ? `sens incertain${r.translation ? ` — peut-être « ${r.translation} »` : ""}${r.note ? ` (${r.note})` : ""}`
        : r.translation ?? "";
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${r.text}`, bold: true }),
            new TextRun({ text: ` (${r.lang}) — ${detail}` }),
          ],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    }
  }

  children.push(
    new Paragraph({ text: "Transcription", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } })
  );

  if (transcription.segments && transcription.segments.length > 0) {
    for (const seg of transcription.segments) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${formatTimestamp(seg.start)}] `, bold: true }),
            new TextRun({ text: seg.text }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  } else {
    children.push(new Paragraph({ text: transcription.text ?? "" }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
