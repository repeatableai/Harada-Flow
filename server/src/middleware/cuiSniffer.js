/**
 * CUI Data Sniffer Middleware
 *
 * Scans file uploads and text inputs for CUI indicators BEFORE
 * data reaches the persistence layer.
 *
 * Three verdicts:
 *   BLOCK — 403, file buffer discarded, never persisted
 *   WARN  — 200 with confirm_required flag
 *   PASS  — next(), proceed normally
 */

import { v4 as uuidv4 } from 'uuid';
import { scanForCUI } from '../lib/cuiPatterns.js';
import { extractFromBuffer } from '../lib/fileExtractors.js';
import { logScanEvent } from '../lib/cuiAuditLogger.js';

// Text fields to scan in JSON request bodies
const SCANNABLE_TEXT_FIELDS = [
  'job_description',
  'company_context',
  'deliverable_request',
  'custom_instructions',
  'overview',
  'customInput',
  'custom_input',
  'description',
];

/**
 * Express middleware: scan uploads and text for CUI
 */
export function cuiSniffer(req, res, next) {
  // Skip if no user context (unauthenticated routes won't have CUI risk)
  if (!req.user) return next();

  // Check for file upload
  if (req.file) {
    return handleFileUpload(req, res, next);
  }

  // Check for text fields in JSON body
  if (req.body && typeof req.body === 'object') {
    return handleTextFields(req, res, next);
  }

  next();
}

/**
 * Handle file upload scanning
 */
async function handleFileUpload(req, res, next) {
  const scanId = uuidv4();
  const file = req.file;

  try {
    // Reject files > 10MB
    if (file.size > 10 * 1024 * 1024) {
      file.buffer = null;
      return res.status(413).json({
        blocked: true,
        scan_id: scanId,
        reason: 'File exceeds maximum allowed size of 10MB.',
      });
    }

    // Extract text and metadata from buffer
    const extracted = await extractFromBuffer(file.buffer, file.mimetype, file.originalname);

    // Block unsupported file types
    if (extracted.unsupported) {
      file.buffer = null;
      return res.status(403).json({
        blocked: true,
        scan_id: scanId,
        reason: 'This file type is not permitted for upload.',
      });
    }

    // Handle parse errors as WARN
    if (extracted.parseError) {
      await logScanEvent(req.user.organizationId, req.user.id, {
        scan_id: scanId,
        filename: file.originalname,
        file_type: file.mimetype,
        file_size_bytes: file.size,
        verdict: 'WARN',
        findings_count: 1,
        findings_summary: [{ pattern_name: 'Parse Error', category: 'SYSTEM' }],
        ip_address: req.ip,
      });

      return res.status(200).json({
        warning: true,
        scan_id: scanId,
        findings: [{ pattern: 'Parse Error', category: 'SYSTEM', match: extracted.errorMessage, line: 0 }],
        action: extracted.errorMessage,
        confirm_required: true,
      });
    }

    // Run CUI pattern scan
    const result = scanForCUI(extracted.text, extracted.metadata, file.originalname);

    // Log every scan
    await logScanEvent(req.user.organizationId, req.user.id, {
      scan_id: scanId,
      filename: file.originalname,
      file_type: file.mimetype,
      file_size_bytes: file.size,
      verdict: result.verdict,
      findings_count: result.findings.length,
      findings_summary: result.findings.map(f => ({ pattern_name: f.pattern, category: f.category })),
      ip_address: req.ip,
    });

    if (result.verdict === 'BLOCK') {
      // Discard the buffer immediately — never persist
      file.buffer = null;
      return res.status(403).json({
        blocked: true,
        scan_id: scanId,
        reason: 'CUI indicators detected',
        findings: result.findings,
        action: 'This file has been rejected and was not stored. If you believe this is an error, contact your CISO to confirm the data is not CUI before reuploading.',
      });
    }

    if (result.verdict === 'WARN') {
      // Check if user already confirmed this scan
      if (req.body && req.body.cui_confirmed === true && req.body.scan_id) {
        // Confirmed — allow through
        req.cuiScanId = scanId;
        return next();
      }

      return res.status(200).json({
        warning: true,
        scan_id: scanId,
        findings: result.findings,
        action: 'Potential controlled data indicators detected. Please confirm this data does not contain CUI, ITAR, or export-controlled information before proceeding.',
        confirm_required: true,
      });
    }

    // PASS — proceed normally
    req.cuiScanId = scanId;
    next();
  } catch (err) {
    console.error('CUI sniffer error:', err);
    // On error, allow through but log it — don't block normal operations
    next();
  }
}

/**
 * Handle text field scanning in JSON bodies
 */
async function handleTextFields(req, res, next) {
  const textsToScan = [];

  for (const field of SCANNABLE_TEXT_FIELDS) {
    if (req.body[field] && typeof req.body[field] === 'string') {
      textsToScan.push(req.body[field]);
    }
  }

  // Also scan prompt arrays if present
  if (Array.isArray(req.body.prompts)) {
    for (const prompt of req.body.prompts) {
      if (prompt.prompt && typeof prompt.prompt === 'string') {
        textsToScan.push(prompt.prompt);
      }
      if (prompt.description && typeof prompt.description === 'string') {
        textsToScan.push(prompt.description);
      }
    }
  }

  if (textsToScan.length === 0) return next();

  const combinedText = textsToScan.join('\n---\n');
  const scanId = uuidv4();

  try {
    const result = scanForCUI(combinedText);

    // Log every scan
    await logScanEvent(req.user.organizationId, req.user.id, {
      scan_id: scanId,
      filename: null,
      file_type: 'text/json-field',
      file_size_bytes: Buffer.byteLength(combinedText, 'utf-8'),
      verdict: result.verdict,
      findings_count: result.findings.length,
      findings_summary: result.findings.map(f => ({ pattern_name: f.pattern, category: f.category })),
      ip_address: req.ip,
    });

    if (result.verdict === 'BLOCK') {
      return res.status(403).json({
        blocked: true,
        scan_id: scanId,
        reason: 'CUI indicators detected in text input',
        findings: result.findings,
        action: 'This content has been rejected. If you believe this is an error, contact your CISO to confirm the data is not CUI.',
      });
    }

    if (result.verdict === 'WARN') {
      if (req.body.cui_confirmed === true && req.body.scan_id) {
        req.cuiScanId = scanId;
        return next();
      }

      return res.status(200).json({
        warning: true,
        scan_id: scanId,
        findings: result.findings,
        action: 'Potential controlled data indicators detected. Please confirm this data does not contain CUI, ITAR, or export-controlled information before proceeding.',
        confirm_required: true,
      });
    }

    // PASS
    req.cuiScanId = scanId;
    next();
  } catch (err) {
    console.error('CUI sniffer text scan error:', err);
    next();
  }
}
