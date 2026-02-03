import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as timeStudyService from '../services/timeStudy.service.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/time-studies - List all time studies (paginated, filterable)
router.get('/', async (req, res, next) => {
  try {
    const { userId, companyId, operationType, page, limit, sort } = req.query;
    const result = await timeStudyService.listTimeStudies({
      userId,
      companyId,
      operationType,
      page,
      limit,
      sort,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/time-studies/stats - Aggregate statistics
router.get('/stats', async (req, res, next) => {
  try {
    const { userId, companyId } = req.query;
    const stats = await timeStudyService.getTimeStudyStats({ userId, companyId });
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
