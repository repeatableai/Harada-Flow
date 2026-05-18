/**
 * API Key Authentication Middleware
 *
 * Checks X-API-Key header against WebhookEndpoint records.
 * If valid, sets req.webhookEndpoint and req.user (from the endpoint owner).
 * If no X-API-Key header, passes through to the next middleware (e.g., JWT auth).
 */

import prisma from '../db.js';
import { AppError } from './errorHandler.js';

export async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(); // No API key — fall through to JWT auth
  }

  try {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { apiKey },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            jobTitle: true,
            role: true,
            isPermanent: true,
            organizationId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!endpoint) {
      throw new AppError('Invalid API key', 401);
    }

    if (!endpoint.isActive) {
      throw new AppError('Webhook endpoint is disabled', 403);
    }

    req.webhookEndpoint = endpoint;
    req.user = endpoint.user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError('API key authentication failed', 500));
  }
}

/**
 * Require API key — rejects if no valid API key is present.
 * Use this on webhook-only routes that must not accept JWT.
 */
export async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(new AppError('X-API-Key header is required', 401));
  }

  return apiKeyAuth(req, res, next);
}
