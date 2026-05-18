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
import { dispatchWebhookEvent } from '../services/webhook.service.js';

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

      // Check for MCQ patterns
      const containsMcq = /\b[A-G]\)\s|options?\s*(?:labeled|are)\s|choose\s+(?:one|from)/i.test(content);

      chunks.push({
        number: dedupedMatches[i].number,
        total: dedupedMatches[i].total || totalChunkCount,
        purpose: dedupedMatches[i].purpose,
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

    // Fire outbound webhook event
    dispatchWebhookEvent('artifact.created', {
      companyId,
      deliverableName,
      acdRegistryChoice,
      results,
    }, req.user.id);

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

    // Pre-flight is informational only — never blocks
    // Load Block A and Block B from disk — try server/prompts (Docker) then src/prompts (local dev)
    let blocksDir = path.resolve(__dirname, '../../prompts/ExecutiveDCE_Blocks');
    if (!fs.existsSync(blocksDir)) {
      blocksDir = path.resolve(__dirname, '../../../src/prompts/ExecutiveDCE_Blocks');
    }
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

/**
 * GET /api/deliverable/registry/:id/acd
 * Download ACD content for a registry entry
 */
router.get('/registry/:id/acd', async (req, res, next) => {
  try {
    const entry = await prisma.artifactRegistry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry) {
      throw new AppError('Registry entry not found', 404);
    }

    if (!entry.acdContent) {
      throw new AppError('No ACD content available for this entry', 404);
    }

    // Return as downloadable HTML file
    const filename = `${entry.name.replace(/[^a-zA-Z0-9]/g, '_')}_ACD.html`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(entry.acdContent);
  } catch (error) {
    next(error);
  }
});

export default router;
