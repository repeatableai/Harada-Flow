import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as storageService from './storage.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory path (for local fallback)
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Get file buffer - tries Supabase first, then local filesystem
 * @param {string} filename - The stored filename
 * @returns {Promise<Buffer|null>} - File buffer or null if not found
 */
async function getFileBuffer(filename) {
  // Try Supabase first
  if (storageService.isSupabaseEnabled()) {
    const downloadResult = await storageService.downloadFile(filename);
    if (downloadResult && downloadResult.buffer) {
      return downloadResult.buffer;
    }
  }

  // Fallback to local filesystem
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  return null;
}

/**
 * Extract text content from a file based on its MIME type
 * @param {string} filename - The stored filename
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(filename, mimeType) {
  const fileBuffer = await getFileBuffer(filename);

  if (!fileBuffer) {
    console.error(`File not found: ${filename}`);
    return '';
  }

  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPDFBuffer(fileBuffer);

      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractFromDOCXBuffer(fileBuffer);

      case 'text/plain':
        return fileBuffer.toString('utf-8');

      case 'text/csv':
        return fileBuffer.toString('utf-8');

      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // For Excel files, we'll read as CSV-like format
        // Note: For full Excel support, you'd want to use a library like xlsx
        console.log('Excel file extraction - basic support only');
        return `[Excel file: ${filename}]`;

      default:
        console.log(`Unsupported file type for text extraction: ${mimeType}`);
        return '';
    }
  } catch (error) {
    console.error(`Error extracting text from ${filename}:`, error);
    return '';
  }
}

/**
 * Extract text from PDF buffer
 */
async function extractFromPDFBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractFromDOCXBuffer(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return '';
  }
}

/**
 * Extract text from multiple files
 * @param {Array<{filename: string, originalName: string, mimeType: string}>} files
 * @returns {Promise<string>} - Combined text content with file headers
 */
export async function extractTextFromFiles(files) {
  const contents = [];

  for (const file of files) {
    const text = await extractTextFromFile(file.filename, file.mimeType);
    if (text) {
      contents.push(`\n--- File: ${file.originalName} ---\n${text}\n`);
    }
  }

  return contents.join('\n');
}
