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
