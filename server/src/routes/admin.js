import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as adminService from '../services/admin.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/users - List all users
router.get('/users', async (req, res, next) => {
  try {
    const { search, page, limit, sort } = req.query;
    const result = await adminService.listUsers({ search, page, limit, sort });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id - Get user with companies
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await adminService.getUser(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/companies - List all companies
router.get('/companies', async (req, res, next) => {
  try {
    const { search, userId, page, limit, sort } = req.query;
    const result = await adminService.listAllCompanies({
      search,
      userId,
      page,
      limit,
      sort,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/companies/:id - Get any company
router.get('/companies/:id', async (req, res, next) => {
  try {
    const company = await adminService.getCompanyAdmin(req.params.id);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/saved-prompts - List all saved prompts
router.get('/saved-prompts', async (req, res, next) => {
  try {
    const { search, deliverableType, page, limit, sort } = req.query;
    const result = await adminService.listAllSavedPrompts({
      search,
      deliverableType,
      page,
      limit,
      sort,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/saved-prompts/stats - Saved prompts statistics
router.get('/saved-prompts/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getSavedPromptStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
