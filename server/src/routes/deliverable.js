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
 * Parse chunk headers from accumulated text.
 * Returns array of { index, number, total, purpose, headerLength }.
 */
function parseChunkHeaders(text) {
  const chunkRegex = /(?:^|\n)\s*(?:#{2,3}\s*)?(?:\*\*)?chunk\s*(?:prompt\s*)?(\d+)(?:\s*(?:of|\/)\s*(\d+))?(?:\*\*)?[\s:—–\-]*([^\n]*)/gi;
  const matches = [];
  let match;
  while ((match = chunkRegex.exec(text)) !== null) {
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
  return matches.filter(m => {
    if (seen.has(m.number)) return false;
    seen.add(m.number);
    return true;
  });
}

/**
 * Extract a complete chunk object from parsed headers + full text.
 */
function extractChunk(headers, index, fullText) {
  const start = headers[index].index + headers[index].headerLength;
  const end = index < headers.length - 1 ? headers[index + 1].index : fullText.length;
  const content = fullText.substring(start, end).trim();
  const containsMcq = /\b[A-G]\)\s|options?\s*(?:labeled|are)\s|choose\s+(?:one|from)/i.test(content);
  return {
    number: headers[index].number,
    total: headers[index].total || headers.length,
    purpose: headers[index].purpose,
    content,
    containsMcq,
    isSequenceComplete: content.includes('[SEQUENCE_COMPLETE]'),
  };
}

/**
 * POST /api/deliverable/working
 * Generate 3-7 copy-paste chunks for a deliverable.
 * Uses SSE to stream each chunk progressively as it's parsed.
 */
router.post('/working', async (req, res) => {
  // Set SSE headers immediately to keep connection alive
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { companyId, deliverableName, deliverableType, category, description, estHoursHuman, estHoursAI, aiOpportunity } = req.body;

    if (!companyId || !deliverableName) {
      sendEvent('error', { message: 'companyId and deliverableName are required' });
      return res.end();
    }

    // Load company context
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) {
      sendEvent('error', { message: 'Company not found or access denied' });
      return res.end();
    }

    sendEvent('progress', { stage: 'generating', message: 'Generating prompt chunks...' });

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

    // Accumulate streamed text and emit chunks progressively
    let fullText = '';
    let emittedChunkCount = 0;

    // Send keepalive every 20 seconds
    const keepaliveInterval = setInterval(() => {
      sendEvent('progress', { stage: 'generating', message: 'Still generating chunks...' });
    }, 20000);

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullText += event.delta.text;

          // Incrementally parse — check if we have a new complete chunk
          const headers = parseChunkHeaders(fullText);
          // A chunk at index i is "complete" if there's a chunk at index i+1
          // (meaning we've moved past it)
          if (headers.length > emittedChunkCount + 1) {
            // We have at least one new complete chunk to emit
            for (let i = emittedChunkCount; i < headers.length - 1; i++) {
              const chunk = extractChunk(headers, i, fullText);
              // Update total based on latest header info
              chunk.total = headers[headers.length - 1].total || headers.length;
              sendEvent('chunk', chunk);
              emittedChunkCount++;
            }
          }
        }
      }
    } finally {
      clearInterval(keepaliveInterval);
    }

    // Emit the final chunk (the last one has no successor during streaming)
    const finalHeaders = parseChunkHeaders(fullText);
    if (finalHeaders.length > emittedChunkCount) {
      for (let i = emittedChunkCount; i < finalHeaders.length; i++) {
        const chunk = extractChunk(finalHeaders, i, fullText);
        chunk.total = finalHeaders.length;
        sendEvent('chunk', chunk);
      }
    }

    // If no chunk headers found at all, treat entire response as one chunk
    if (finalHeaders.length === 0) {
      sendEvent('chunk', {
        number: 1,
        total: 1,
        purpose: 'Complete Deliverable',
        content: fullText,
        containsMcq: false,
        isSequenceComplete: fullText.includes('[SEQUENCE_COMPLETE]'),
      });
    }

    // Send completion event with metadata
    const allChunks = finalHeaders.length > 0
      ? finalHeaders.map((_, i) => extractChunk(finalHeaders, i, fullText))
      : [{ number: 1, total: 1, purpose: 'Complete Deliverable', content: fullText, containsMcq: false, isSequenceComplete: fullText.includes('[SEQUENCE_COMPLETE]') }];

    sendEvent('complete', {
      totalChunks: allChunks.length,
      deliverableName,
      companyId,
    });
    res.end();
  } catch (error) {
    console.error('Working deliverable error:', error);
    sendEvent('error', { message: error.message || 'Failed to generate chunks' });
    res.end();
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
