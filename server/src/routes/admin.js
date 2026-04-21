import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireDepartmentAdmin, requireSuperAdmin } from '../middleware/admin.js';
import * as adminService from '../services/admin.service.js';
import * as authService from '../services/auth.service.js';
import * as erasureService from '../services/erasure.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/admin/users - List users (scoped by caller's role)
router.get('/users', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { search, page, limit, sort, role, organizationId, departmentId, isActive } = req.query;
    const result = await adminService.listUsers({
      search,
      page,
      limit,
      sort,
      role,
      organizationId,
      departmentId,
      isActive,
    }, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id - Get user with companies (scoped)
router.get('/users/:id', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const user = await adminService.getUser(req.params.id, req.user);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role - Change user role
router.patch('/users/:id/role', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) {
      throw new AppError('Role is required', 400);
    }
    const user = await adminService.updateUserRole(req.params.id, role, req.user);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/organization - Assign to organization (Super admin only)
router.patch('/users/:id/organization', requireSuperAdmin, async (req, res, next) => {
  try {
    const { organizationId } = req.body;
    const user = await adminService.assignUserToOrganization(req.params.id, organizationId, req.user);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/department - Assign to department
router.patch('/users/:id/department', requireAdmin, async (req, res, next) => {
  try {
    const { departmentId } = req.body;
    const user = await adminService.assignUserToDepartment(req.params.id, departmentId, req.user);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/invite - Invite user to org/dept
router.post('/users/invite', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { name, email, password, jobTitle, organizationId, departmentId, role } = req.body;
    if (!email) {
      throw new AppError('Email is required', 400);
    }
    if (!name?.trim()) {
      throw new AppError('Name is required', 400);
    }
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    const user = await adminService.inviteUser({ name, email, password, jobTitle, organizationId, departmentId, role }, req.user);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/password - Reset user password (Super admin only)
router.patch('/users/:id/password', requireSuperAdmin, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    const result = await adminService.resetUserPassword(req.params.id, password, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id - Update user details (edit)
router.patch('/users/:id', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { name, email, jobTitle } = req.body;
    const user = await adminService.updateUser(req.params.id, { name, email, jobTitle }, req.user);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/status - Toggle user active status (pause/activate)
router.patch('/users/:id/status', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive must be a boolean', 400);
    }
    const user = await adminService.toggleUserActive(req.params.id, isActive, req.user);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/companies - List all companies (scoped by caller's role)
router.get('/companies', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { search, userId, page, limit, sort } = req.query;
    const result = await adminService.listAllCompanies({
      search,
      userId,
      page,
      limit,
      sort,
    }, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/companies/:id - Get any company
router.get('/companies/:id', requireDepartmentAdmin, async (req, res, next) => {
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

// GET /api/admin/stats - Dashboard statistics (scoped by caller's role)
router.get('/stats', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const stats = await adminService.getStats(req.user);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/saved-prompts - List all saved prompts (scoped by caller's role)
router.get('/saved-prompts', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const { search, deliverableType, companyId, userId, page, limit, sort } = req.query;
    const result = await adminService.listAllSavedPrompts({
      search,
      deliverableType,
      companyId,
      userId,
      page,
      limit,
      sort,
    }, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/saved-prompts/stats - Saved prompts statistics (scoped by caller's role)
router.get('/saved-prompts/stats', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const stats = await adminService.getSavedPromptStats(req.user);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ============ Access Request Routes (Super Admin only) ============

// GET /api/admin/access-requests - List access requests
router.get('/access-requests', requireSuperAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await authService.listAccessRequests(status || null);
    res.json({ data: requests });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/access-requests/:id/approve - Approve access request
// Body can include optional: { accessExpiry: ISO date string, accessDays: number, deliverablesLimit: number }
router.post('/access-requests/:id/approve', requireSuperAdmin, async (req, res, next) => {
  try {
    const { accessExpiry, accessDays, deliverablesLimit } = req.body;
    const result = await authService.approveAccessRequest(
      req.params.id,
      req.user.id,
      { accessExpiry, accessDays, deliverablesLimit }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/access-requests/:id/reject - Reject access request
router.post('/access-requests/:id/reject', requireSuperAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await authService.rejectAccessRequest(req.params.id, req.user.id, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// === GDPR Right to Erasure (Admin) ===

// DELETE /api/admin/users/:id/erase - Erase all data for a user (GDPR data subject request)
router.delete('/users/:id/erase', requireDepartmentAdmin, async (req, res, next) => {
  try {
    const result = await erasureService.adminEraseUserData(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
