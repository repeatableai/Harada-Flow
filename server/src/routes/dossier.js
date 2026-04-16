/**
 * Dossier Generation Routes (Session 00)
 *
 * POST /api/dossier/generate — Fire the Dossier Generation Protocol via Claude API
 * PATCH /api/dossier/:companyId/status — Update dossier status (for upload path)
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import config from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
router.use(authenticate);

// Load the Dossier Generation Protocol from disk
function loadDossierProtocol() {
  const protocolPath = path.resolve(__dirname, '../../../src/prompts/DCE_Dossier_Generation_Protocol.md');
  if (!fs.existsSync(protocolPath)) {
    throw new AppError('Dossier Generation Protocol file not found', 500);
  }
  return fs.readFileSync(protocolPath, 'utf-8');
}

/**
 * POST /api/dossier/generate
 * Fire the Dossier Generation Protocol with web search enabled
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { companyName, engagementFocus, companyId } = req.body;

    if (!companyName || !companyId) {
      throw new AppError('companyName and companyId are required', 400);
    }

    // Verify the company belongs to this user
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    // Load the protocol as the system prompt
    const systemPrompt = loadDossierProtocol();

    const userPrompt = `Generate a comprehensive dossier for ${companyName}.${engagementFocus ? ` Engagement focus: ${engagementFocus}.` : ''} Execute the full 22-section template with tiered web research per the protocol.`;

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
      timeout: 600000, // 10 minutes — dossier gen takes 3-5 min for F500
    });

    // Call Claude with web_search tool enabled
    const response = await anthropic.messages.create({
      model: config.anthropic.model || 'claude-opus-4-6',
      max_tokens: 32768,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [{
        type: 'web_search_20250305',
      }],
    });

    // Extract the text content from the response
    let dossierContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        dossierContent += block.text;
      }
    }

    if (!dossierContent) {
      throw new AppError('Dossier generation returned empty content', 500);
    }

    // Generate filename
    const sanitizedName = companyName.replace(/[^a-zA-Z0-9]/g, '');
    const dossierFilename = `${sanitizedName}_Dossier_DCE1.md`;

    // Update company record
    await prisma.company.update({
      where: { id: companyId },
      data: {
        dossierStatus: 'generated',
        dossierFilename,
      },
    });

    res.json({
      success: true,
      filename: dossierFilename,
      content: dossierContent,
      dossierStatus: 'generated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/dossier/:companyId/status
 * Update dossier status (used by upload path)
 */
router.patch('/:companyId/status', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { dossierStatus, dossierFilename } = req.body;

    if (!['pending', 'uploaded', 'generated'].includes(dossierStatus)) {
      throw new AppError('Invalid dossier status', 400);
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        dossierStatus,
        dossierFilename: dossierFilename || null,
      },
    });

    res.json({ dossierStatus: updated.dossierStatus, dossierFilename: updated.dossierFilename });
  } catch (error) {
    next(error);
  }
});

export default router;
