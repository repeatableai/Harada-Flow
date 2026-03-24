import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireDepartmentAdmin } from '../middleware/admin.js';
import { getActivityLogs, getActivityStats } from '../services/activityLog.service.js';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireDepartmentAdmin);

// GET /api/admin/activity - List activity logs (scoped by caller's role)
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, activityType, resourceType, userId } = req.query;
    const result = await getActivityLogs(req.user, {
      page,
      limit,
      activityType,
      resourceType,
      userId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/activity/stats - Activity statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getActivityStats(req.user);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
