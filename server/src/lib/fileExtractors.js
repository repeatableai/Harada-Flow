/**
 * In-Memory File Extractors
 *
 * Extract text content and metadata from file buffers.
 * All extraction happens in memory — zero temp files.
 */

import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import AdmZip from 'adm-zip';

/**
 * Extract text and metadata from a buffer based on MIME type
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type
 * @param {string} filename - Original filename
 * @returns {{ text: string, metadata: Object, unsupported: boolean }}
 */
export async function extractFromBuffer(buffer, mimetype, filename = '') {
  try {
    switch (mimetype) {
      case 'text/plain':
      case 'text/csv':
      case 'text/markdown':
      case 'application/json':
        return { text: buffer.toString('utf-8'), metadata: {}, unsupported: false };

      case 'application/pdf':
        return await extractPDF(buffer);

      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDOCX(buffer);

      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return extractXLSX(buffer);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return extractPPTX(buffer);

      default:
        return { text: '', metadata: {}, unsupported: true };
    }
  } catch (err) {
    console.error(`File extraction error for ${filename} (${mimetype}):`, err.message);
    return {
      text: '',
      metadata: {},
      unsupported: false,
      parseError: true,
      errorMessage: 'File could not be fully parsed — manual review recommended before upload.',
    };
  }
}

/**
 * Extract text + metadata from PDF buffer
 */
async function extractPDF(buffer) {
  const data = await pdf(buffer);
  const metadata = {};

  if (data.info) {
    if (data.info.Title) metadata.title = data.info.Title;
    if (data.info.Author) metadata.author = data.info.Author;
    if (data.info.Subject) metadata.subject = data.info.Subject;
    if (data.info.Keywords) metadata.keywords = data.info.Keywords;
  }

  return { text: data.text || '', metadata, unsupported: false };
}

/**
 * Extract text + metadata from DOCX buffer
 */
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const metadata = {};

  // Extract metadata from docProps/core.xml via zip
  try {
    const zip = new AdmZip(buffer);
    const coreXml = zip.getEntry('docProps/core.xml');
    if (coreXml) {
      const xmlContent = coreXml.getData().toString('utf-8');
      const titleMatch = xmlContent.match(/<dc:title>([^<]*)<\/dc:title>/);
      const subjectMatch = xmlContent.match(/<dc:subject>([^<]*)<\/dc:subject>/);
      const creatorMatch = xmlContent.match(/<dc:creator>([^<]*)<\/dc:creator>/);
      const keywordsMatch = xmlContent.match(/<cp:keywords>([^<]*)<\/cp:keywords>/);

      if (titleMatch) metadata.title = titleMatch[1];
      if (subjectMatch) metadata.subject = subjectMatch[1];
      if (creatorMatch) metadata.author = creatorMatch[1];
      if (keywordsMatch) metadata.keywords = keywordsMatch[1];
    }
  } catch {
    // Metadata extraction is best-effort
  }

  return { text: result.value || '', metadata, unsupported: false };
}

/**
 * Extract text from XLSX buffer — all sheets, all cells
 */
function extractXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const textParts = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to array of arrays, then flatten to text
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of data) {
      for (const cell of row) {
        if (cell !== null && cell !== undefined && cell !== '') {
          textParts.push(String(cell));
        }
      }
    }
  }

  return { text: textParts.join(' '), metadata: {}, unsupported: false };
}

/**
 * Extract text from PPTX buffer — all slide XML text nodes
 */
function extractPPTX(buffer) {
  const zip = new AdmZip(buffer);
  const textParts = [];

  // Get all slide files
  const entries = zip.getEntries();
  const slideEntries = entries
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

  for (const entry of slideEntries) {
    const xmlContent = entry.getData().toString('utf-8');
    // Extract text from <a:t> elements
    const textMatches = xmlContent.matchAll(/<a:t>([^<]*)<\/a:t>/g);
    for (const match of textMatches) {
      if (match[1].trim()) {
        textParts.push(match[1]);
      }
    }
  }

  // Also check metadata
  const metadata = {};
  try {
    const coreXml = zip.getEntry('docProps/core.xml');
    if (coreXml) {
      const xmlContent = coreXml.getData().toString('utf-8');
      const titleMatch = xmlContent.match(/<dc:title>([^<]*)<\/dc:title>/);
      const subjectMatch = xmlContent.match(/<dc:subject>([^<]*)<\/dc:subject>/);
      if (titleMatch) metadata.title = titleMatch[1];
      if (subjectMatch) metadata.subject = subjectMatch[1];
    }
  } catch {
    // Best effort
  }

  return { text: textParts.join(' '), metadata, unsupported: false };
}
