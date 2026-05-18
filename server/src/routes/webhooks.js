/**
 * Webhook Routes
 *
 * Management API (JWT auth): CRUD for webhook endpoints + logs
 * Inbound API (API key auth): Receive context and files from external services
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateApiKey, logInboundEvent, sendTestEvent } from '../services/webhook.service.js';
import * as knowledgeFileService from '../services/knowledgeFile.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Validation Schemas ────────────────────────────────

const createEndpointSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().optional().default(''),
  direction: z.enum(['inbound', 'outbound']),
  events: z.array(z.string()).min(1),
  organizationId: z.string().uuid().optional().nullable(),
});

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const inboundContextSchema = z.object({
  jobTitle: z.string().min(1),
  industry: z.string().min(1),
  companySize: z.string().min(1),
  companyUrl: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  deliverableName: z.string().optional().nullable(),
  mode: z.enum(['Working', 'Executive']).optional().nullable(),
  metadata: z.any().optional(),
});

// ══════════════════════════════════════════════════════
// MANAGEMENT ENDPOINTS (JWT Auth)
// ══════════════════════════════════════════════════════

// GET /api/webhooks — List user's endpoints
router.get('/', authenticate, async (req, res, next) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });
    res.json(endpoints);
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks — Create new endpoint
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createEndpointSchema.parse(req.body);
    const apiKey = generateApiKey();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        name: data.name,
        url: data.url,
        direction: data.direction,
        events: data.events,
        apiKey,
        userId: req.user.id,
        organizationId: data.organizationId || null,
      },
    });

    res.status(201).json(endpoint);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/webhooks/:id — Update endpoint
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const data = updateEndpointSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) throw new AppError('Webhook endpoint not found', 404);

    const updated = await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/webhooks/:id — Delete endpoint
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) throw new AppError('Webhook endpoint not found', 404);

    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks/:id/logs — View delivery logs
router.get('/:id/logs', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) throw new AppError('Webhook endpoint not found', 404);

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where: { endpointId: req.params.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhookLog.count({ where: { endpointId: req.params.id } }),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks/:id/test — Send test event
router.post('/:id/test', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) throw new AppError('Webhook endpoint not found', 404);

    const result = await sendTestEvent(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════
// INBOUND ENDPOINTS (API Key Auth)
// ══════════════════════════════════════════════════════

// POST /api/webhooks/inbound/context — Receive company context
router.post('/inbound/context', requireApiKey, async (req, res, next) => {
  try {
    const data = inboundContextSchema.parse(req.body);

    const company = await prisma.company.create({
      data: {
        jobTitle: data.jobTitle,
        industry: data.industry,
        companySize: data.companySize,
        companyUrl: data.companyUrl || null,
        userId: req.user.id,
        createdBy: req.user.email,
      },
    });

    await logInboundEvent(req.webhookEndpoint.id, 'context.received', req.body, 201, true);

    res.status(201).json({
      companyId: company.id,
      status: 'created',
    });
  } catch (err) {
    if (req.webhookEndpoint) {
      await logInboundEvent(req.webhookEndpoint.id, 'context.received', req.body, 400, false).catch(() => {});
    }
    next(err);
  }
});

// POST /api/webhooks/inbound/files — Receive file attachments
router.post('/inbound/files', requireApiKey, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { companyId, description } = req.body;

    const file = await knowledgeFileService.uploadFile(
      req.file,
      req.user,
      'self',
      [],
      description || 'Uploaded via webhook',
      null,
      companyId || null,
      []
    );

    await logInboundEvent(req.webhookEndpoint.id, 'file.received', {
      filename: req.file.originalname,
      size: req.file.size,
      companyId: companyId || null,
    }, 201, true);

    res.status(201).json({
      fileId: file.id,
      filename: file.originalName || req.file.originalname,
      size: req.file.size,
      companyId: companyId || null,
    });
  } catch (err) {
    if (req.file) req.file.buffer = null;
    if (req.webhookEndpoint) {
      await logInboundEvent(req.webhookEndpoint.id, 'file.received', {
        filename: req.file?.originalname,
      }, 400, false).catch(() => {});
    }
    next(err);
  }
});

// POST /api/webhooks/inbound/context-with-files — Combined context + files
router.post('/inbound/context-with-files', requireApiKey, upload.array('files', 10), async (req, res, next) => {
  try {
    const data = inboundContextSchema.parse(req.body);

    // Create company
    const company = await prisma.company.create({
      data: {
        jobTitle: data.jobTitle,
        industry: data.industry,
        companySize: data.companySize,
        companyUrl: data.companyUrl || null,
        userId: req.user.id,
        createdBy: req.user.email,
      },
    });

    // Upload any attached files
    const fileIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploaded = await knowledgeFileService.uploadFile(
            file,
            req.user,
            'self',
            [],
            'Uploaded via webhook',
            null,
            company.id,
            []
          );
          fileIds.push(uploaded.id);
        } catch (fileErr) {
          console.error(`[Webhook] Failed to upload file ${file.originalname}:`, fileErr.message);
        }
      }
    }

    await logInboundEvent(req.webhookEndpoint.id, 'context-with-files.received', {
      companyId: company.id,
      fileCount: fileIds.length,
    }, 201, true);

    res.status(201).json({
      companyId: company.id,
      fileIds,
      status: 'created',
    });
  } catch (err) {
    if (req.files) req.files.forEach(f => { f.buffer = null; });
    if (req.webhookEndpoint) {
      await logInboundEvent(req.webhookEndpoint.id, 'context-with-files.received', req.body, 400, false).catch(() => {});
    }
    next(err);
  }
});

export default router;
