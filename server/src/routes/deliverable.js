/**
 * Deliverable Generation Routes
 *
 * POST /api/deliverable/working          — Working mode: generate 3-7 chunks
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
  for that specific input (label [SYN] in output)
- Preserve Magic Wand vision, 5-Expert Panel review, and Brutal Pre-Mortem where
  relevant to the chunk's scope
- Target: 10 minutes total human time across all chunks for a deliverable that
  would take 2 hours manually

The FINAL chunk must:
- Produce the deployment-ready artifact (file output)
- Include a self-grading QA rubric: "Magic wand vision present? Pre-mortem present?
  5-expert panel present? Deployment-ready (not outline)?"`;

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

    // Use streaming to prevent connection timeouts on large responses
    const stream = anthropic.messages.stream({
      model: config.anthropic.model || 'claude-opus-4-6',
      max_tokens: 32768,
      system: WORKING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Accumulate streamed text
    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullText += event.delta.text;
      }
    }

    // Parse chunks — flexible regex to handle Claude's varied header formats:
    // "### Chunk 1 of 5 — Purpose", "### CHUNK PROMPT 1:", "## Chunk 1/5: Purpose",
    // "### Chunk 1 of 5", "**Chunk 1 of 5**", etc.
    const chunkRegex = /(?:^|\n)\s*(?:#{2,3}\s*)?(?:\*\*)?chunk\s*(?:prompt\s*)?(\d+)(?:\s*(?:of|\/)\s*(\d+))?(?:\*\*)?[\s:—–\-]*([^\n]*)/gi;
    const chunks = [];
    const matches = [];
    let match;

    while ((match = chunkRegex.exec(fullText)) !== null) {
      matches.push({
        index: match.index,
        number: parseInt(match[1]),
        total: match[2] ? parseInt(match[2]) : null,
        purpose: (match[3] || '').trim() || `Chunk ${match[1]}`,
        headerLength: match[0].length,
      });
    }

    // Deduplicate — if same chunk number appears multiple times, keep first
    const seen = new Set();
    const dedupedMatches = matches.filter(m => {
      if (seen.has(m.number)) return false;
      seen.add(m.number);
      return true;
    });

    const totalChunkCount = dedupedMatches.length;
    for (let i = 0; i < dedupedMatches.length; i++) {
      const start = dedupedMatches[i].index + dedupedMatches[i].headerLength;
      const end = i < dedupedMatches.length - 1 ? dedupedMatches[i + 1].index : fullText.length;
      const content = fullText.substring(start, end).trim();

      chunks.push({
        number: dedupedMatches[i].number,
        total: dedupedMatches[i].total || totalChunkCount,
        purpose: dedupedMatches[i].purpose,
        content,
      });
    }

    // If no chunk headers found, treat entire response as one chunk
    if (chunks.length === 0) {
      chunks.push({
        number: 1,
        total: 1,
        purpose: 'Complete Deliverable',
        content: fullText,
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

    // Pre-flight is informational only — never blocks
    // Load Block A and Block B from disk — try server/prompts (Docker) then src/prompts (local dev)
    let blocksDir = path.resolve(__dirname, '../../prompts/ExecutiveDCE_Blocks');
    if (!fs.existsSync(blocksDir)) {
      blocksDir = path.resolve(__dirname, '../../../src/prompts/ExecutiveDCE_Blocks');
    }
    const blocks = [];

    const blockDefs = [
      { file: 'BlockA.md', title: 'Block A — Always-On Engine Instructions' },
      { file: 'BlockB.md', title: 'Block B — Deliverable Interpretation Logic' },
      { file: 'BlockC.md', title: 'Block C — Attending Asset Discovery & Parallel Production Queue' },
      { file: 'BlockD.md', title: 'Block D — Portfolio Hub — Deliverable Navigation Dashboard' },
    ];
    for (const blockDef of blockDefs) {
      const blockPath = path.join(blocksDir, blockDef.file);
      if (fs.existsSync(blockPath)) {
        const content = fs.readFileSync(blockPath, 'utf-8');
        blocks.push({
          name: blockDef.file.replace('.md', ''),
          title: blockDef.title,
          content,
        });
      }
    }

    // Load pre-flight banner
    let bannerPath = path.resolve(__dirname, '../../prompts/Executive_PreFlight_Banner.md');
    if (!fs.existsSync(bannerPath)) {
      bannerPath = path.resolve(__dirname, '../../../src/prompts/Executive_PreFlight_Banner.md');
    }
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

export default router;
