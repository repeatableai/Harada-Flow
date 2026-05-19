import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { invokeLLM, extractRoleInfoFromFiles } from '../services/llm.service.js';
import { checkTrialUserDeliverableLimit } from '../services/auth.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schema for InvokeLLM
const invokeLLMSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  response_json_schema: z.any().optional(),
  // Strict tool_use schema — grammar-constrained output enforcement
  tool_use_schema: z.any().optional(),
  add_context_from_internet: z.boolean().optional(),
  company_url: z.string().optional().nullable(),
  // Additional knowledge files to include as context
  knowledgeFileIds: z.array(z.string()).optional(),
  // Time study tracking params
  operationType: z.string().optional(),
  operationName: z.string().optional(),
  companyId: z.string().optional().nullable(),
  // Dynamic baseline params
  industry: z.string().optional().nullable(),
  companySize: z.string().optional().nullable(),
  deliverableName: z.string().optional().nullable(),
});

// POST /api/integrations/llm - Invoke LLM (non-streaming fallback)
router.post('/llm', async (req, res, next) => {
  try {
    const trialStatus = await checkTrialUserDeliverableLimit(req.user.id);
    if (trialStatus.isTrialUser && !trialStatus.canSave) {
      throw new AppError(
        `Trial account limit reached. You have saved ${trialStatus.deliverableLimit} deliverables. Please contact an administrator to upgrade your account for full access.`,
        403
      );
    }

    const data = invokeLLMSchema.parse(req.body);

    const result = await invokeLLM({
      prompt: data.prompt,
      response_json_schema: data.response_json_schema,
      tool_use_schema: data.tool_use_schema,
      add_context_from_internet: data.add_context_from_internet,
      company_url: data.company_url,
      knowledgeFileIds: data.knowledgeFileIds,
      user: req.user,
      operationType: data.operationType,
      operationName: data.operationName,
      companyId: data.companyId,
      userId: req.user.id,
      industry: data.industry,
      companySize: data.companySize,
      deliverableName: data.deliverableName,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/integrations/llm/stream - Invoke LLM with SSE streaming (prevents 504 timeouts)
router.post('/llm/stream', async (req, res) => {
  // Set SSE headers immediately to keep connection alive
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Vercel/nginx buffering
  res.flushHeaders();

  try {
    const trialStatus = await checkTrialUserDeliverableLimit(req.user.id);
    if (trialStatus.isTrialUser && !trialStatus.canSave) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Trial account limit reached.' })}\n\n`);
      return res.end();
    }

    const data = invokeLLMSchema.parse(req.body);

    const result = await invokeLLM({
      prompt: data.prompt,
      response_json_schema: data.response_json_schema,
      tool_use_schema: data.tool_use_schema,
      add_context_from_internet: data.add_context_from_internet,
      company_url: data.company_url,
      knowledgeFileIds: data.knowledgeFileIds,
      user: req.user,
      operationType: data.operationType,
      operationName: data.operationName,
      companyId: data.companyId,
      userId: req.user.id,
      industry: data.industry,
      companySize: data.companySize,
      deliverableName: data.deliverableName,
      // SSE progress callback — sends keepalive events to prevent timeout
      onProgress: (progress) => {
        res.write(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);
      },
    });

    res.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
    res.end();
  } catch (error) {
    console.error('LLM stream error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'LLM request failed' })}\n\n`);
    res.end();
  }
});

// POST /api/integrations/extract-role - Extract role info from uploaded files
router.post('/extract-role', async (req, res, next) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new AppError('fileIds array is required', 400);
    }

    const result = await extractRoleInfoFromFiles(fileIds, req.user.id);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
