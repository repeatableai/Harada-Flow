import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import * as companyService from '../services/company.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
// Helper to validate URL or allow empty string/null/undefined
const urlOrEmpty = z.union([
  z.string().url(),
  z.literal(''),
  z.null(),
  z.undefined(),
]);

const createCompanySchema = z.object({
  job_title: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  industry: z.string().min(1),
  company_size: z.string().min(1).optional(),
  companySize: z.string().min(1).optional(),
  company_url: urlOrEmpty,
  companyUrl: urlOrEmpty,
}).refine(data => data.job_title || data.jobTitle, {
  message: 'job_title or jobTitle is required',
}).refine(data => data.company_size || data.companySize, {
  message: 'company_size or companySize is required',
});

const updateCompanySchema = z.object({
  job_title: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  company_size: z.string().min(1).optional(),
  companySize: z.string().min(1).optional(),
  company_url: urlOrEmpty,
  companyUrl: urlOrEmpty,
  productivity_matrix: z.any().optional(),
  productivityMatrix: z.any().optional(),
  performance_matrix: z.any().optional(),
  performanceMatrix: z.any().optional(),
});

// GET /api/companies - List user's companies
router.get('/', async (req, res, next) => {
  try {
    const { sort, limit, page, created_by } = req.query;

    // Handle filter query for backwards compatibility
    if (created_by) {
      const companies = await companyService.filterCompanies(
        req.user.id,
        { created_by },
        sort || '-created_date',
        limit || 50
      );
      return res.json(companies);
    }

    const result = await companyService.listCompanies(req.user.id, {
      sort,
      limit,
      page,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/latest - Get most recent company
router.get('/latest', async (req, res, next) => {
  try {
    const company = await companyService.getLatestCompany(req.user.id);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/:id - Get company by ID
router.get('/:id', async (req, res, next) => {
  try {
    const company = await companyService.getCompany(req.user.id, req.params.id);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// POST /api/companies - Create company
router.post('/', async (req, res, next) => {
  try {
    const data = createCompanySchema.parse(req.body);
    const company = await companyService.createCompany(
      req.user.id,
      req.user.email,
      data
    );
    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/companies/:id - Update company
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateCompanySchema.parse(req.body);
    const company = await companyService.updateCompany(
      req.user.id,
      req.params.id,
      data
    );
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/companies/:id - Delete company
router.delete('/:id', async (req, res, next) => {
  try {
    await companyService.deleteCompany(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
