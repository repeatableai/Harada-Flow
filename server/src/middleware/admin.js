import { AppError } from './errorHandler.js';

// Role hierarchy levels (higher number = more permissions)
const ROLE_LEVELS = {
  USER: 1,
  DEPARTMENT_ADMIN: 2,
  COMPANY_ADMIN: 3,
  ADMIN: 3,  // Maps to COMPANY_ADMIN level for backwards compatibility
  SUPER_ADMIN: 4,
};

// Check if a role has at least the required level
export function hasRoleLevel(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
}

// Backwards compatible admin check (COMPANY_ADMIN or higher)
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  const validRoles = ['ADMIN', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(req.user.role)) {
    return next(new AppError('Admin access required', 403));
  }

  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return next(new AppError('Super admin access required', 403));
  }

  next();
}

export function requireCompanyAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  const validRoles = ['COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(req.user.role)) {
    return next(new AppError('Company admin access required', 403));
  }

  next();
}

export function requireDepartmentAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  const validRoles = ['DEPARTMENT_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(req.user.role)) {
    return next(new AppError('Department admin access required', 403));
  }

  next();
}

// Scope-checking middleware: ensures user can only access data in their organization
export function requireSameOrganization(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  // Super admins can access all organizations
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const targetOrgId = req.params.orgId || req.params.organizationId || req.body?.organizationId;

  if (!targetOrgId) {
    return next(new AppError('Organization ID required', 400));
  }

  if (req.user.organizationId !== targetOrgId) {
    return next(new AppError('Access denied: not a member of this organization', 403));
  }

  next();
}

// Scope-checking middleware: ensures user can only access data in their department
export function requireSameDepartment(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  // Super admins and company admins can access all departments
  if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return next();
  }

  const targetDeptId = req.params.deptId || req.params.departmentId || req.body?.departmentId;

  if (!targetDeptId) {
    return next(new AppError('Department ID required', 400));
  }

  if (req.user.departmentId !== targetDeptId) {
    return next(new AppError('Access denied: not a member of this department', 403));
  }

  next();
}

// Check if user can manage another user based on role hierarchy
export function canManageUser(managerRole, targetRole, sameOrg = true, sameDept = true) {
  // Cannot manage users with same or higher role level
  if (ROLE_LEVELS[targetRole] >= ROLE_LEVELS[managerRole]) {
    return false;
  }

  // Super admins can manage anyone with lower role
  if (managerRole === 'SUPER_ADMIN') {
    return true;
  }

  // Company admins can manage users in their org with lower role
  if (['COMPANY_ADMIN', 'ADMIN'].includes(managerRole)) {
    return sameOrg && ROLE_LEVELS[targetRole] < ROLE_LEVELS[managerRole];
  }

  // Department admins can only manage users in their department
  if (managerRole === 'DEPARTMENT_ADMIN') {
    return sameOrg && sameDept && targetRole === 'USER';
  }

  return false;
}
