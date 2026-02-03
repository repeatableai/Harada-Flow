import { AppError } from './errorHandler.js';

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401));
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
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
