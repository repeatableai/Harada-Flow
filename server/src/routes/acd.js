/**
 * ACD (Artifact Companion Document) Routes
 *
 * POST /api/acd/generate — Generate ACD for a non-HTML artifact
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import config from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  timeout: 300000,
});

const ACD_SYSTEM_PROMPT = `ARTIFACT COMPANION DOCUMENT (ACD) GENERATION

Generate a companion ACD as an HTML document for the provided artifact.

ACD STRUCTURE (7 mandatory sections):
1. What This Is — 30-second orientation
2. Strategic Value — why it exists
3. How — operational manual
4. Design Decisions — expert panel highlights
5. Known Risks & Failure Modes — pre-mortem digest
6. Expected Results — 30/90/180/365-day milestones
7. System Connections — dependencies and data flows

ACD follows all design rules:
- Inter font only
- Dark/light mode toggle (default dark, Shift+T, localStorage 'dce_theme')
- WCAG AA contrast in both modes
- Standard footer: [CLIENT_CODE] · [DELIVERABLE_NAME] · ACD · [DATE] · Confidential Internal

Output: Complete, standalone HTML document.`;

/**
 * POST /api/acd/generate
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { companyId, artifactName, artifactContent, artifactType } = req.body;

    if (!companyId || !artifactName) {
      throw new AppError('companyId and artifactName are required', 400);
    }

    const response = await anthropic.messages.create({
      model: config.anthropic.model || 'claude-opus-4-6',
      max_tokens: 32768,
      system: ACD_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate the companion ACD for the following artifact:\n\nArtifact Name: ${artifactName}\nArtifact Type: ${artifactType || 'unknown'}\n\n${artifactContent ? `Content:\n${artifactContent.substring(0, 10000)}` : 'Content not provided — generate based on artifact name and type.'}`,
      }],
    });

    let acdContent = '';
    for (const block of response.content) {
      if (block.type === 'text') acdContent += block.text;
    }

    // Update registry if entry exists
    const registryEntry = await prisma.artifactRegistry.findFirst({
      where: { companyId, name: artifactName },
      orderBy: { createdAt: 'desc' },
    });

    if (registryEntry) {
      await prisma.artifactRegistry.update({
        where: { id: registryEntry.id },
        data: { acdStatus: 'Complete', acdContent },
      });
    }

    res.json({
      success: true,
      artifactName,
      acdContent,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
