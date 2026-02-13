import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireCompanyAdmin, requireSameOrganization } from '../middleware/admin.js';
import * as organizationService from '../services/organization.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/organizations - List all organizations (Super admin only)
router.get('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const { search, page, limit, sort } = req.query;
    const result = await organizationService.listOrganizations({ search, page, limit, sort });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/organizations - Create organization (Super admin only)
router.post('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const organization = await organizationService.createOrganization(req.body);
    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
});

// GET /api/organizations/:id - Get organization details
// Super admins can see any org, Company admins can only see their org
router.get('/:id', async (req, res, next) => {
  try {
    // Check permission
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId !== req.params.id) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const organization = await organizationService.getOrganization(req.params.id);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    res.json(organization);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/organizations/:id - Update organization
// Super admins can update any org, Company admins can only update their own org's profile fields
router.patch('/:id', async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwnOrg = req.user.organizationId === req.params.id;
    const isCompanyAdmin = ['COMPANY_ADMIN', 'ADMIN'].includes(req.user.role);

    // Super admins can update any org
    // Company admins can only update their own org
    if (!isSuperAdmin && !(isCompanyAdmin && isOwnOrg)) {
      throw new AppError('Access denied', 403);
    }

    // For Company Admins, only allow profile fields (industry, companySize, website)
    // Super Admins can update everything
    let updateData = req.body;
    if (!isSuperAdmin) {
      // Company Admins can only update profile fields
      const { industry, companySize, website } = req.body;
      updateData = { industry, companySize, website };
    }

    const organization = await organizationService.updateOrganization(req.params.id, updateData);
    res.json(organization);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/organizations/:id - Delete organization (Super admin only)
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await organizationService.deleteOrganization(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/organizations/:id/status - Toggle organization active status (Super admin only)
router.patch('/:id/status', requireSuperAdmin, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive must be a boolean', 400);
    }
    const organization = await organizationService.toggleOrganizationActive(req.params.id, isActive);
    res.json(organization);
  } catch (error) {
    next(error);
  }
});

// GET /api/organizations/:id/users - List users in organization
// Super admins can see any org, Company admins can only see their org
router.get('/:id/users', async (req, res, next) => {
  try {
    // Check permission
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId !== req.params.id) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const { search, page, limit, sort, role } = req.query;
    const result = await organizationService.listOrganizationUsers(req.params.id, {
      search,
      page,
      limit,
      sort,
      role,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
