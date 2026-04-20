import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Downloads dossier content as a .docx file.
 * Falls back to .md if DOCX generation fails.
 */
export async function downloadDossier(content, filename = 'Company-Dossier') {
  try {
    const paragraphs = content.split('\n').map((line) => {
      const isHeading = line.startsWith('#');
      const cleanLine = line.replace(/^#+\s*/, '');

      return new Paragraph({
        children: [
          new TextRun({
            text: cleanLine,
            bold: isHeading,
            size: isHeading ? 28 : 22,
          }),
        ],
        spacing: { after: 120 },
      });
    });

    const doc = new Document({
      sections: [{ children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename}.docx`);
  } catch (err) {
    console.warn('DOCX generation failed, falling back to .md:', err);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${filename}.md`);
  }
}
