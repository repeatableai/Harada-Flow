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

// POST /api/integrations/llm - Invoke LLM
router.post('/llm', async (req, res, next) => {
  try {
    // Check trial user deliverable limit before allowing LLM generation
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
      add_context_from_internet: data.add_context_from_internet,
      company_url: data.company_url,
      // Additional knowledge files as context
      knowledgeFileIds: data.knowledgeFileIds,
      user: req.user, // Pass full user for access checks
      // Time study tracking - userId from auth middleware
      operationType: data.operationType,
      operationName: data.operationName,
      companyId: data.companyId,
      userId: req.user.id,
      // Dynamic baseline params
      industry: data.industry,
      companySize: data.companySize,
      deliverableName: data.deliverableName,
    });

    res.json(result);
  } catch (error) {
    next(error);
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
