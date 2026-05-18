/**
 * Session Close Protocol Routes
 *
 * POST /api/session/close — Execute session close protocol
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import config from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { dispatchWebhookEvent } from '../services/webhook.service.js';

const router = Router();
router.use(authenticate);

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  timeout: 300000,
});

/**
 * POST /api/session/close
 * Execute Session Close Protocol
 */
router.post('/close', async (req, res, next) => {
  try {
    const { companyId, sessionNumber = 1 } = req.body;

    if (!companyId) {
      throw new AppError('companyId is required', 400);
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    // Get registry entries for this engagement
    const registryEntries = await prisma.artifactRegistry.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });

    const registrySummary = registryEntries.length > 0
      ? registryEntries.map(e => `- ${e.name} (${e.type}, ${e.mode}, ACD: ${e.acdStatus})`).join('\n')
      : 'No artifacts registered yet.';

    const response = await anthropic.messages.create({
      model: config.anthropic.model || 'claude-opus-4-6',
      max_tokens: 8192,
      system: 'Execute Session Close Protocol. Produce: session summary, registry update, pending ACDs, collateral register update, navigator update status.',
      messages: [{
        role: 'user',
        content: `Close session ${sessionNumber} for engagement:\n\nRole: ${company.jobTitle}\nIndustry: ${company.industry}\nCompany Size: ${company.companySize}\n\nArtifact Registry:\n${registrySummary}\n\nProduce the session close output.`,
      }],
    });

    let outputMarkdown = '';
    for (const block of response.content) {
      if (block.type === 'text') outputMarkdown += block.text;
    }

    // Save session close record
    await prisma.sessionCloseRecord.create({
      data: {
        companyId,
        sessionNumber,
        outputMarkdown,
      },
    });

    // Fire outbound webhook event
    dispatchWebhookEvent('session.closed', {
      companyId,
      sessionNumber,
    }, req.user.id);

    res.json({
      success: true,
      sessionNumber,
      output: outputMarkdown,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
