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
import { dispatchWebhookEvent } from '../services/webhook.service.js';

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
 * Uses SSE streaming to keep the connection alive and prevent gateway timeouts
 */
router.post('/generate', async (req, res) => {
  // Set SSE headers immediately to keep connection alive
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Vercel/nginx buffering
  res.flushHeaders();

  // Send initial progress event
  const sendProgress = (stage, message) => {
    res.write(`event: progress\ndata: ${JSON.stringify({ stage, message })}\n\n`);
  };

  try {
    const { companyName, companyUrl, jobTitle, industry, companySize, engagementFocus, companyId } = req.body;

    if (!companyId) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'companyId is required' })}\n\n`);
      return res.end();
    }

    sendProgress('init', 'Verifying company access...');

    // Verify the company belongs to this user and load full context
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Company not found or access denied' })}\n\n`);
      return res.end();
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

    sendProgress('research', `Researching ${resolvedCompanyName}...`);

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
      timeout: 600000, // 10 minutes — dossier gen takes 3-5 min for F500
    });

    // Start a keepalive interval to prevent idle connection timeout
    const keepaliveInterval = setInterval(() => {
      sendProgress('generating', 'Generating dossier — web research in progress...');
    }, 20000); // Send keepalive every 20 seconds

    let response;
    try {
      // Call Claude with web_search tool enabled
      response = await anthropic.messages.create({
        model: config.anthropic.model || 'claude-opus-4-6',
        max_tokens: 32768,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 25,
        }],
      });
    } finally {
      clearInterval(keepaliveInterval);
    }

    sendProgress('processing', 'Processing dossier content...');

    // Extract text from response
    let dossierContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        dossierContent += block.text;
      }
    }

    if (!dossierContent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Dossier generation returned empty content' })}\n\n`);
      return res.end();
    }

    // Generate filename from best available company identifier
    const nameForFile = resolvedCompanyName || resolvedIndustry || 'Company';
    const sanitizedName = nameForFile.replace(/[^a-zA-Z0-9]/g, '');
    const dossierFilename = `${sanitizedName}_Dossier_DCE1.md`;

    // Update company record — persist content so it survives page reloads
    await prisma.company.update({
      where: { id: companyId },
      data: {
        dossierStatus: 'generated',
        dossierFilename,
        dossierContent,
      },
    });

    // Fire outbound webhook event
    dispatchWebhookEvent('dossier.generated', {
      companyId,
      filename: dossierFilename,
      contentLength: dossierContent.length,
    }, req.user.id);

    // Send the final result
    res.write(`event: complete\ndata: ${JSON.stringify({
      success: true,
      filename: dossierFilename,
      content: dossierContent,
      dossierStatus: 'generated',
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Dossier generation error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Dossier generation failed' })}\n\n`);
    res.end();
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
