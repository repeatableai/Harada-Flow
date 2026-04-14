import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import * as erasureService from '../services/erasure.service.js';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const validateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const eraseAccountSchema = z.object({
  confirmationPhrase: z.string().min(1, 'Confirmation phrase is required'),
  password: z.string().optional(),
});

const accessRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().min(1, 'Company is required'),
  email: z.string().email('Invalid email address'),
  jobTitle: z.string().min(1, 'Job title is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Cookie options for refresh token
// sameSite: 'none' required for cross-origin requests (frontend/backend on different domains)
// secure: true required when sameSite is 'none'
const cookieOptions = {
  httpOnly: true,
  secure: true, // Required for sameSite: 'none'
  sameSite: 'none', // Allow cross-origin cookie sending
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

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/validate-token - Check if reset/invite token is valid
router.get('/validate-token', async (req, res, next) => {
  try {
    const { token } = validateTokenSchema.parse(req.query);
    const result = await authService.validateResetToken(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password - Set new password with reset token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/set-password - Set initial password with invite token
router.post('/set-password', async (req, res, next) => {
  try {
    const { token, password } = setPasswordSchema.parse(req.body);
    const result = await authService.setInitialPassword(token, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/request-access - Submit a temporary access request
router.post('/request-access', async (req, res, next) => {
  try {
    const data = accessRequestSchema.parse(req.body);
    const result = await authService.submitAccessRequest(data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/trial-status - Check trial user deliverable limit status
router.get('/trial-status', authenticate, async (req, res, next) => {
  try {
    const result = await authService.checkTrialUserDeliverableLimit(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password - Change user's password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/sessions - List user's active sessions
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const sessions = await authService.listUserSessions(req.user.id, refreshToken);
    res.json({ data: sessions });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions - Logout all other sessions
router.delete('/sessions', authenticate, async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ error: 'No current session found' });
    }
    const result = await authService.logoutOtherSessions(req.user.id, refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions/:id - Logout specific session
router.delete('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const result = await authService.logoutSession(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// === GDPR Right to Erasure Endpoints ===

// GET /api/auth/account/data-summary - Get summary of all stored personal data
router.get('/account/data-summary', authenticate, async (req, res, next) => {
  try {
    const summary = await erasureService.getDataSummary(req.user.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/account - Erase all personal data (GDPR Right to Erasure)
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    const { confirmationPhrase, password } = eraseAccountSchema.parse(req.body);
    const result = await erasureService.eraseUserData(req.user.id, confirmationPhrase, password);

    // Clear the refresh token cookie since the account no longer exists
    res.clearCookie('refreshToken', { path: '/' });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
