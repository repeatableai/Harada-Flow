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
  // Try server/prompts first (Docker deployment), then src/prompts (local dev)
  const paths = [
    path.resolve(__dirname, '../../prompts/DCE_Dossier_Generation_Protocol.md'),
    path.resolve(__dirname, '../../../src/prompts/DCE_Dossier_Generation_Protocol.md'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  throw new AppError('Dossier Generation Protocol file not found', 500);
}

/**
 * POST /api/dossier/generate
 * Fire the Dossier Generation Protocol with web search enabled
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { companyName, companyUrl, jobTitle, industry, companySize, engagementFocus, companyId } = req.body;

    if (!companyId) {
      throw new AppError('companyId is required', 400);
    }

    // Verify the company belongs to this user and load full context
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    // Use all available context — from request body AND stored company record
    const resolvedCompanyName = companyName || company.industry || 'the company';
    const resolvedUrl = companyUrl || company.companyUrl || null;
    const resolvedJobTitle = jobTitle || company.jobTitle || null;
    const resolvedIndustry = industry || company.industry || null;
    const resolvedSize = companySize || company.companySize || null;

    // Load the protocol as the system prompt
    const systemPrompt = loadDossierProtocol();

    // Build a rich user prompt with ALL available context
    let userPrompt = `Generate a comprehensive dossier for ${resolvedCompanyName}.`;
    if (resolvedUrl) {
      userPrompt += `\n\nCOMPANY WEBSITE: ${resolvedUrl} — Start your research here. Read this website thoroughly for company identity, leadership, products/services, capabilities, certifications, and recent news before conducting web searches.`;
    }
    if (resolvedJobTitle) {
      userPrompt += `\n\nENGAGEMENT CONTEXT: The user's role is ${resolvedJobTitle}. The dossier should be focused on the operational context relevant to this role.`;
    }
    if (resolvedIndustry) {
      userPrompt += `\nINDUSTRY: ${resolvedIndustry}`;
    }
    if (resolvedSize) {
      userPrompt += `\nCOMPANY SIZE: ${resolvedSize}`;
    }
    if (engagementFocus) {
      userPrompt += `\nENGAGEMENT FOCUS: ${engagementFocus}`;
    }
    userPrompt += `\n\nExecute the full 22-section dossier template with tiered web research per the protocol. The company website URL above is your primary starting point — use it to anchor all research.`;

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
        max_uses: 25,
      }],
    });

    // Extract text from response
    let dossierContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        dossierContent += block.text;
      }
    }

    if (!dossierContent) {
      throw new AppError('Dossier generation returned empty content', 500);
    }

    // Generate filename from best available company identifier
    const nameForFile = resolvedCompanyName || resolvedIndustry || 'Company';
    const sanitizedName = nameForFile.replace(/[^a-zA-Z0-9]/g, '');
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
    console.error('[DOSSIER] Generation failed:', {
      name: error.name,
      message: error.message,
      status: error.status,
      cause: error.cause?.message,
      apiKeyPresent: !!config.anthropic.apiKey,
      apiKeyPrefix: config.anthropic.apiKey ? config.anthropic.apiKey.slice(0, 10) : 'MISSING',
      model: config.anthropic.model,
    });
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
