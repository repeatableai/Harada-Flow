import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Downloads markdown-ish content as a .docx file.
 * Parses basic markdown headings and paragraphs into docx structure.
 */
export async function downloadDocx(content, filename = 'Document') {
  const lines = content.split('\n');
  const children = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    // Parse markdown headings
    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.replace(/^### /, ''), bold: true })],
      }));
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.replace(/^## /, ''), bold: true })],
      }));
    } else if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.replace(/^# /, ''), bold: true })],
      }));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: trimmed.replace(/^[-*] /, '') })],
      }));
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/\*\*/g, ''), bold: true })],
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed })],
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
