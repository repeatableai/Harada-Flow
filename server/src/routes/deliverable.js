/**
 * Deliverable Generation Routes
 *
 * POST /api/deliverable/working          — Working mode: generate 3-7 chunks
 * POST /api/deliverable/working/complete — Working mode: handle completion (ACD/Registry)
 * POST /api/deliverable/executive        — Executive mode: pre-check + block cards
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

// For internal ACD auto-fire calls
const INTERNAL_BASE = `http://localhost:${config.port || 3001}`;

const router = Router();
router.use(authenticate);

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  timeout: 600000,
});

// ── Working Deliverable Mode ────────────────────────────────

const WORKING_SYSTEM_PROMPT = `WORKING DELIVERABLE MODE — DYNAMIC CHUNK GENERATION

You are producing a complete, production-ready deliverable for this role
and company. Use the dossier in project knowledge as authoritative context.

INSTRUCTIONS:
Produce a sequence of 3-7 copy-paste prompts. Each prompt, when run in a
fresh LLM session, produces one component of the final artifact. The full
sequence, run in order, produces a complete deployment-ready artifact
(HTML, DOCX, PDF, or XLSX) — not a draft, not an outline.

Decide the chunk count based on complexity:
- Simple deliverables: 3 chunks
- Moderate deliverables: 4-5 chunks
- Complex deliverables: 6-7 chunks

Each chunk must:
- Include a chunk header: "### Chunk [N] of [TOTAL] — [purpose]"
- Stand alone (no reference to chunks not yet run)
- Request specific missing context if needed, OR offer to generate synthetic data
  for that specific input (label [SYN] in output), OR embed an MCQ if a structural
  choice is required
- Preserve Magic Wand vision, 5-Expert Panel review, and Brutal Pre-Mortem where
  relevant to the chunk's scope
- Target: 10 minutes total human time across all chunks for a deliverable that
  would take 2 hours manually

The FINAL chunk must:
- Produce the deployment-ready artifact (file output)
- Include a self-grading QA rubric: "Magic wand vision present? Pre-mortem present?
  5-expert panel present? Deployment-ready (not outline)?"
- Close with an ACD/Registry user-elect prompt:
  "This deliverable is complete. Would you like to: (A) Generate companion ACD,
  (B) Log to artifact registry, (C) Both, (D) Skip?"
- Emit the machine-readable marker "[SEQUENCE_COMPLETE]" on the last line`;

/**
 * POST /api/deliverable/working
 * Generate 3-7 copy-paste chunks for a deliverable
 */
router.post('/working', async (req, res, next) => {
  try {
    const { companyId, deliverableName, deliverableType, category, description, estHoursHuman, estHoursAI, aiOpportunity } = req.body;

    if (!companyId || !deliverableName) {
      throw new AppError('companyId and deliverableName are required', 400);
    }

    // Load company context
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    const userPrompt = `DELIVERABLE: ${deliverableName}
CATEGORY: ${category || 'General'}
DESCRIPTION: ${description || deliverableName}
TYPE: ${deliverableType || 'productivity'}
HOURS (Human only): ${estHoursHuman || 'N/A'}
HOURS (Human + AI): ${estHoursAI || 'N/A'}
AI OPPORTUNITY: ${aiOpportunity || 'Medium'}

ROLE CONTEXT:
- Job Title: ${company.jobTitle}
- Industry: ${company.industry}
- Company Size: ${company.companySize}

Generate the dynamic chunk sequence now.`;

    const response = await anthropic.messages.create({
      model: config.anthropic.model || 'claude-opus-4-6',
      max_tokens: 32768,
      system: WORKING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text
    let fullText = '';
    for (const block of response.content) {
      if (block.type === 'text') fullText += block.text;
    }

    // Parse chunks by splitting on "### Chunk [N] of [TOTAL]" headers
    const chunkRegex = /### Chunk (\d+) of (\d+)\s*[—–-]\s*(.+)/g;
    const chunks = [];
    let lastIndex = 0;
    let match;
    const matches = [];

    while ((match = chunkRegex.exec(fullText)) !== null) {
      matches.push({
        index: match.index,
        number: parseInt(match[1]),
        total: parseInt(match[2]),
        purpose: match[3].trim(),
        headerLength: match[0].length,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].headerLength;
      const end = i < matches.length - 1 ? matches[i + 1].index : fullText.length;
      const content = fullText.substring(start, end).trim();

      // Check for MCQ patterns
      const containsMcq = /\b[A-G]\)\s|options?\s*(?:labeled|are)\s|choose\s+(?:one|from)/i.test(content);

      chunks.push({
        number: matches[i].number,
        total: matches[i].total,
        purpose: matches[i].purpose,
        content,
        containsMcq,
        isSequenceComplete: content.includes('[SEQUENCE_COMPLETE]'),
      });
    }

    // If no chunk headers found, treat entire response as one chunk
    if (chunks.length === 0) {
      chunks.push({
        number: 1,
        total: 1,
        purpose: 'Complete Deliverable',
        content: fullText,
        containsMcq: false,
        isSequenceComplete: fullText.includes('[SEQUENCE_COMPLETE]'),
      });
    }

    res.json({
      chunks,
      totalChunks: chunks.length,
      deliverableName,
      companyId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/deliverable/working/complete
 * Handle completion of a Working deliverable (ACD/Registry choices)
 */
router.post('/working/complete', async (req, res, next) => {
  try {
    const { companyId, deliverableName, acdRegistryChoice } = req.body;

    if (!companyId || !deliverableName || !acdRegistryChoice) {
      throw new AppError('companyId, deliverableName, and acdRegistryChoice are required', 400);
    }

    const results = { acd: null, registry: null };

    // Choice B (Registry only) or C (Both) — actually write to artifact_registry
    if (['B', 'C'].includes(acdRegistryChoice)) {
      const existingCount = await prisma.artifactRegistry.count({ where: { companyId } });
      await prisma.artifactRegistry.create({
        data: {
          companyId,
          artifactNumber: existingCount + 1,
          name: deliverableName,
          type: 'MD',
          mode: 'Working',
          acdStatus: ['A', 'C'].includes(acdRegistryChoice) ? 'Required' : 'N/A',
          sessionNumber: 1,
          status: 'Generated',
        },
      });
      results.registry = 'written';
    }

    // Choice A (ACD only) or C (Both) — fire ACD generation
    if (['A', 'C'].includes(acdRegistryChoice)) {
      // Fire ACD asynchronously — don't block the response
      fetch(`${INTERNAL_BASE}/api/acd/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization },
        body: JSON.stringify({ companyId, artifactName: deliverableName, artifactType: 'MD' }),
      }).catch(err => console.error('ACD auto-fire failed:', err.message));
      results.acd = 'fired';
    }

    // Choice D — skip
    if (acdRegistryChoice === 'D') {
      results.acd = 'skipped';
      results.registry = 'skipped';
    }

    res.json({ success: true, choice: acdRegistryChoice, results });
  } catch (error) {
    next(error);
  }
});

// ── Executive DCE Mode ──────────────────────────────────────

/**
 * POST /api/deliverable/executive
 * Pre-check + return Block A and Block B content
 */
router.post('/executive', async (req, res, next) => {
  try {
    const { companyId, deliverableName } = req.body;

    if (!companyId) {
      throw new AppError('companyId is required', 400);
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }

    // Pre-check: verify required files
    const missingFiles = [];

    if (company.dossierStatus === 'pending') {
      missingFiles.push('Company Dossier (complete Session 00 first)');
    }

    // Check for knowledge files
    const knowledgeFiles = await prisma.knowledgeFile.findMany({
      where: { uploaderId: req.user.id },
      select: { originalName: true },
    });

    const fileNames = knowledgeFiles.map(f => f.originalName.toLowerCase());
    if (!fileNames.some(f => f.includes('master_spec') || f.includes('dce_master'))) {
      missingFiles.push('DCE_Master_Spec_v2_0.md');
    }

    if (missingFiles.length > 0) {
      return res.json({ status: 'blocked', missingFiles });
    }

    // Load Block A and Block B from disk
    const blocksDir = path.resolve(__dirname, '../../../src/prompts/ExecutiveDCE_Blocks');
    const blocks = [];

    for (const blockFile of ['BlockA.md', 'BlockB.md']) {
      const blockPath = path.join(blocksDir, blockFile);
      if (fs.existsSync(blockPath)) {
        const content = fs.readFileSync(blockPath, 'utf-8');
        blocks.push({
          name: blockFile.replace('.md', ''),
          title: blockFile === 'BlockA.md' ? 'Block A — Always-On Engine Instructions' : 'Block B — Deliverable Interpretation Logic',
          content,
        });
      }
    }

    // Load pre-flight banner
    const bannerPath = path.resolve(__dirname, '../../../src/prompts/Executive_PreFlight_Banner.md');
    const banner = fs.existsSync(bannerPath) ? fs.readFileSync(bannerPath, 'utf-8') : null;

    res.json({
      status: 'ready',
      blocks,
      banner,
      deliverableName,
      companyId,
    });
  } catch (error) {
    next(error);
  }
});

// ── Registry Read ─────────────────────────────────────────

/**
 * GET /api/deliverable/registry?companyId=xxx
 * Fetch artifact registry entries for an engagement
 */
router.get('/registry', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      throw new AppError('companyId is required', 400);
    }

    const entries = await prisma.artifactRegistry.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

export default router;
