import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import * as knowledgeFileService from '../services/knowledgeFile.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    // Generate UUID-based filename to avoid collisions
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/gif',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed types: PDF, DOC, DOCX, TXT, CSV, XLSX, PNG, JPG, GIF'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/knowledge-files/upload
 * Upload a file
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { scope = 'self', description, organizationId, companyId } = req.body;
    let departmentIds = [];
    let userIds = [];

    // Parse departmentIds if provided
    if (req.body.departmentIds) {
      try {
        departmentIds = JSON.parse(req.body.departmentIds);
      } catch {
        // If not JSON, try splitting by comma
        departmentIds = req.body.departmentIds.split(',').filter(Boolean);
      }
    }

    // Parse userIds if provided
    if (req.body.userIds) {
      try {
        userIds = JSON.parse(req.body.userIds);
      } catch {
        // If not JSON, try splitting by comma
        userIds = req.body.userIds.split(',').filter(Boolean);
      }
    }

    const file = await knowledgeFileService.uploadFile(
      req.file,
      req.user,
      scope,
      departmentIds,
      description || null,
      organizationId || null,
      companyId || null,
      userIds
    );

    res.status(201).json(file);
  } catch (error) {
    // If there was an error after file upload, clean up the file
    if (req.file) {
      const fs = await import('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Ignore cleanup errors
      }
    }
    next(error);
  }
});

/**
 * GET /api/knowledge-files/available-context
 * Get organization/company-wide knowledge files available as additional context
 * Returns files with scope: company, departments (user's dept), or system
 */
router.get('/available-context', async (req, res, next) => {
  try {
    const files = await knowledgeFileService.getAvailableContextFiles(req.user);
    res.json(files);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-files
 * List accessible files
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search, scope: scopeFilter } = req.query;

    const result = await knowledgeFileService.listFiles(req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || '',
      scopeFilter: scopeFilter || 'all',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-files/:id
 * Get file metadata
 */
router.get('/:id', async (req, res, next) => {
  try {
    const file = await knowledgeFileService.getFile(req.params.id, req.user);
    res.json(file);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-files/:id/download
 * Download a file
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { buffer, filePath, originalName, mimeType } = await knowledgeFileService.downloadFile(
      req.params.id,
      req.user
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);

    if (buffer) {
      // Send buffer directly (from Supabase)
      res.send(buffer);
    } else {
      // Send from local file path
      res.sendFile(filePath);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/knowledge-files/:id/link-company
 * Link a file to a company (role session)
 */
router.patch('/:id/link-company', async (req, res, next) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }
    const file = await knowledgeFileService.linkToCompany(req.params.id, companyId, req.user);
    res.json(file);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/knowledge-files/:id
 * Delete a file
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await knowledgeFileService.deleteFile(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

export default router;
