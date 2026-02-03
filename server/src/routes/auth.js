import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import config from '../config.js';

const router = Router();

// Validation schemas
const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyCodeSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  jobTitle: z.string().optional(),
  job_title: z.string().optional(), // Accept both formats
});

// Cookie options for refresh token
const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// POST /api/auth/email-verify - Request verification code
router.post('/email-verify', async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const result = await authService.requestEmailVerification(email);
    res.json({ message: 'Verification code sent', ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-code - Verify code and create session
router.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = verifyCodeSchema.parse(req.body);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    const result = await authService.verifyCodeAndCreateSession(
      email,
      code,
      userAgent,
      ipAddress
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    // Return response without refresh token in body
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - Admin password login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    const result = await authService.loginWithPassword(
      email,
      password,
      userAgent,
      ipAddress
    );

    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Logout and invalidate session
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    await authService.logout(refreshToken);

    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/auth/me - Update current user
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const data = updateMeSchema.parse(req.body);
    // Normalize job_title to jobTitle
    if (data.job_title && !data.jobTitle) {
      data.jobTitle = data.job_title;
      delete data.job_title;
    }
    const user = await authService.updateCurrentUser(req.user.id, data);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
