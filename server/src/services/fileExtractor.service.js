import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory path
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Extract text content from a file based on its MIME type
 * @param {string} filename - The stored filename
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(filename, mimeType) {
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return '';
  }

  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPDF(filePath);

      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractFromDOCX(filePath);

      case 'text/plain':
        return fs.readFileSync(filePath, 'utf-8');

      case 'text/csv':
        return fs.readFileSync(filePath, 'utf-8');

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
 * Extract text from PDF file
 */
async function extractFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

/**
 * Extract text from DOCX file
 */
async function extractFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
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
