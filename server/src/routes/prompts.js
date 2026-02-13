import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import * as promptService from '../services/prompt.service.js';
import { checkTrialUserDeliverableLimit, incrementTrialUserDeliverables } from '../services/auth.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schema
const createPromptSchema = z.object({
  deliverable_name: z.string().min(1).optional(),
  deliverableName: z.string().min(1).optional(),
  deliverable_type: z.enum(['productivity', 'performance']).optional(),
  deliverableType: z.enum(['productivity', 'performance']).optional(),
  column_name: z.string().optional().nullable(),
  columnName: z.string().optional().nullable(),
  overview: z.string().min(1),
  prompts: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    prompt: z.string(),
  })),
}).refine(data => data.deliverable_name || data.deliverableName, {
  message: 'deliverable_name or deliverableName is required',
}).refine(data => data.deliverable_type || data.deliverableType, {
  message: 'deliverable_type or deliverableType is required',
});

// GET /api/prompts - List all user's prompts across sessions
router.get('/', async (req, res, next) => {
  try {
    const prompts = await promptService.listByUser(req.user.id);
    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

// POST /api/companies/:companyId/prompts - Create prompt for a company
router.post('/companies/:companyId/prompts', async (req, res, next) => {
  try {
    // Check trial user deliverable limit before saving
    const trialStatus = await checkTrialUserDeliverableLimit(req.user.id);
    if (trialStatus.isTrialUser && !trialStatus.canSave) {
      throw new AppError(
        `Trial account limit reached. You have saved ${trialStatus.deliverableLimit} deliverables. Please contact an administrator to upgrade your account for full access.`,
        403
      );
    }

    const data = createPromptSchema.parse(req.body);
    const prompt = await promptService.create(
      req.user.id,
      req.params.companyId,
      data
    );

    // Increment trial user deliverable count after successful save
    let trialInfo = null;
    if (trialStatus.isTrialUser) {
      const updateResult = await incrementTrialUserDeliverables(req.user.id);
      trialInfo = {
        isTrialUser: true,
        deliverablesUsed: updateResult.deliverablesUsed,
        remaining: updateResult.remaining,
        limitReached: updateResult.limitReached,
      };
    }

    res.status(201).json({ ...prompt, trialStatus: trialInfo });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/prompts/:id - Delete prompt
router.delete('/:id', async (req, res, next) => {
  try {
    await promptService.deletePrompt(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
