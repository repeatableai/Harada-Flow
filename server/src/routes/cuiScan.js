/**
 * CUI Scan API Routes
 *
 * POST /api/cui/scan     — Manual scan (upload file, get findings, no save)
 * POST /api/cui/confirm  — Confirm a WARN verdict
 * GET  /api/cui/audit    — Admin: paginated audit log
 * GET  /api/cui/stats    — Admin: summary stats
 */

import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireDepartmentAdmin } from '../middleware/admin.js';
import { scanForCUI } from '../lib/cuiPatterns.js';
import { extractFromBuffer } from '../lib/fileExtractors.js';
import { logScanEvent, confirmScan, getAuditLog, getStats } from '../lib/cuiAuditLogger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/cui/scan
 * Manual scan — upload a file, get findings without saving it
 */
router.post('/scan', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const scanId = uuidv4();
    const file = req.file;

    const extracted = await extractFromBuffer(file.buffer, file.mimetype, file.originalname);

    if (extracted.unsupported) {
      file.buffer = null;
      return res.status(400).json({
        scan_id: scanId,
        error: 'This file type is not supported for scanning.',
      });
    }

    const result = scanForCUI(extracted.text, extracted.metadata, file.originalname);

    // Log the manual scan
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

    // Always discard buffer after manual scan
    file.buffer = null;

    res.json({
      scan_id: scanId,
      verdict: result.verdict,
      findings: result.findings,
      filename: file.originalname,
      file_type: file.mimetype,
      file_size_bytes: file.size,
    });
  } catch (error) {
    if (req.file) req.file.buffer = null;
    next(error);
  }
});

/**
 * POST /api/cui/confirm
 * Confirm a WARN verdict — user attests content is not CUI
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const { scan_id, cui_confirmed } = req.body;

    if (!scan_id) {
      throw new AppError('scan_id is required', 400);
    }
    if (cui_confirmed !== true) {
      throw new AppError('cui_confirmed must be true', 400);
    }

    const updated = await confirmScan(scan_id, req.user.id);

    if (!updated) {
      throw new AppError('Scan not found or not a WARN verdict', 404);
    }

    res.json({
      confirmed: true,
      scan_id,
      confirmed_at: updated.confirmedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cui/audit
 * Admin: paginated audit log for tenant
 */
router.get('/audit', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { page, limit, verdict } = req.query;

    // Super admins see all; others scoped to their org
    const organizationId = req.user.role === 'SUPER_ADMIN' ? null : req.user.organizationId;

    const result = await getAuditLog({
      organizationId,
      verdict: verdict || null,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cui/stats
 * Admin: summary statistics
 */
router.get('/stats', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const organizationId = req.user.role === 'SUPER_ADMIN' ? null : req.user.organizationId;
    const stats = await getStats(organizationId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
