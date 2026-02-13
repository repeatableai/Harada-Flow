import jwt from 'jsonwebtoken';
import config from '../config.js';
import prisma from '../db.js';
import { AppError } from './errorHandler.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        jobTitle: true,
        role: true,
        isPermanent: true,
        sessionExpiry: true,
        createdAt: true,
        lastLoginAt: true,
        organizationId: true,
        departmentId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Check session expiry for non-permanent users
    if (!user.isPermanent && user.sessionExpiry) {
      if (new Date() > new Date(user.sessionExpiry)) {
        throw new AppError('Session expired', 401);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(error);
    }
    next(new AppError('Authentication failed', 401));
  }
}

export function generateAccessToken(userId) {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}
