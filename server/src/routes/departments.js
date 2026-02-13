import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCompanyAdmin, requireDepartmentAdmin } from '../middleware/admin.js';
import * as departmentService from '../services/department.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to check org access
function checkOrgAccess(user, orgId) {
  if (user.role === 'SUPER_ADMIN') return true;
  return user.organizationId === orgId;
}

// Helper to check department access
function checkDeptAccess(user, dept) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (['COMPANY_ADMIN', 'ADMIN'].includes(user.role)) {
    return user.organizationId === dept.organizationId;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    return user.departmentId === dept.id;
  }
  return false;
}

// GET /api/organizations/:orgId/departments - List departments in organization
router.get('/organizations/:orgId/departments', async (req, res, next) => {
  try {
    if (!checkOrgAccess(req.user, req.params.orgId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const { search, page, limit, sort } = req.query;
    const result = await departmentService.listDepartments(req.params.orgId, {
      search,
      page,
      limit,
      sort,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/organizations/:orgId/departments - Create department (Company admin+)
router.post('/organizations/:orgId/departments', requireCompanyAdmin, async (req, res, next) => {
  try {
    if (!checkOrgAccess(req.user, req.params.orgId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const department = await departmentService.createDepartment(req.params.orgId, req.body);
    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
});

// GET /api/departments/:id - Get department details
router.get('/departments/:id', async (req, res, next) => {
  try {
    const department = await departmentService.getDepartment(req.params.id);
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    if (!checkOrgAccess(req.user, department.organizationId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    res.json(department);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/departments/:id - Update department (Company admin+)
router.patch('/departments/:id', requireCompanyAdmin, async (req, res, next) => {
  try {
    const existing = await departmentService.getDepartment(req.params.id);
    if (!existing) {
      throw new AppError('Department not found', 404);
    }

    if (!checkOrgAccess(req.user, existing.organizationId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const department = await departmentService.updateDepartment(req.params.id, req.body);
    res.json(department);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/departments/:id - Delete department (Company admin+)
router.delete('/departments/:id', requireCompanyAdmin, async (req, res, next) => {
  try {
    const existing = await departmentService.getDepartment(req.params.id);
    if (!existing) {
      throw new AppError('Department not found', 404);
    }

    if (!checkOrgAccess(req.user, existing.organizationId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    const result = await departmentService.deleteDepartment(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/departments/:id/users - List users in department
router.get('/departments/:id/users', async (req, res, next) => {
  try {
    const department = await departmentService.getDepartment(req.params.id);
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    // Check access - need at least department admin level access
    if (req.user.role === 'USER') {
      throw new AppError('Access denied', 403);
    }

    if (!checkOrgAccess(req.user, department.organizationId)) {
      throw new AppError('Access denied: not a member of this organization', 403);
    }

    // Department admins can only see their own department
    if (req.user.role === 'DEPARTMENT_ADMIN' && req.user.departmentId !== req.params.id) {
      throw new AppError('Access denied: not a member of this department', 403);
    }

    const { search, page, limit, sort } = req.query;
    const result = await departmentService.listDepartmentUsers(req.params.id, {
      search,
      page,
      limit,
      sort,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
