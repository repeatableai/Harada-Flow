import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../db.js';
import config from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendInviteEmail, sendAccessRequestNotification, sendAccessApprovedEmail, sendAccessRejectedEmail } from './email.service.js';

const SALT_ROUNDS = 12;

// Generate a 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a secure refresh token string
function generateRefreshTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

export async function requestEmailVerification(email) {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists and still has an active session
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Check if email has already been used (one-time use)
  const usedEmail = await prisma.usedEmail.findUnique({
    where: { email: normalizedEmail },
  });

  if (usedEmail) {
    // Email was used before - check if user still has an active session window
    if (existingUser && existingUser.sessionExpiry && new Date() < existingUser.sessionExpiry) {
      // User's session is still active, allow re-login
      console.log(`User ${normalizedEmail} requesting re-login within active session window`);
    } else {
      // Session expired or user doesn't exist
      throw new AppError('This email has already been used and the session has expired', 400);
    }
  }

  // Delete any existing unused verification codes for this email
  await prisma.verificationCode.deleteMany({
    where: {
      email: normalizedEmail,
      used: false,
    },
  });

  // Generate new code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + config.session.verificationCodeDuration);

  await prisma.verificationCode.create({
    data: {
      email: normalizedEmail,
      code,
      expiresAt,
    },
  });

  // Send verification email (logs to console in dev, sends real email in prod)
  const emailResult = await sendVerificationEmail(normalizedEmail, code);

  // If email wasn't actually sent (no Resend configured), return the code for UI display
  const response = { expiresIn: config.session.verificationCodeDuration / 1000 };

  if (emailResult.method === 'console' || emailResult.method === 'console_fallback') {
    response.code = code; // Include code in response for UI display
    response.displayInUI = true;
  }

  return response;
}

export async function verifyCodeAndCreateSession(email, code, userAgent, ipAddress) {
  const normalizedEmail = email.toLowerCase().trim();

  // Find valid verification code
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      email: normalizedEmail,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!verificationCode) {
    throw new AppError('Invalid or expired verification code', 400);
  }

  // Mark code as used
  await prisma.verificationCode.update({
    where: { id: verificationCode.id },
    data: { used: true },
  });

  // Check if email already marked as used (for re-login case)
  const existingUsedEmail = await prisma.usedEmail.findUnique({
    where: { email: normalizedEmail },
  });

  if (!existingUsedEmail) {
    // First time login - mark email as used
    await prisma.usedEmail.create({
      data: { email: normalizedEmail },
    });
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // For re-login, keep the existing session expiry if it's still valid
  // For new users, set a new 72-hour window
  let sessionExpiry;
  if (user && user.sessionExpiry && new Date() < user.sessionExpiry) {
    // Re-login within active window - keep existing expiry
    sessionExpiry = user.sessionExpiry;
  } else {
    // New user or expired session - set new 72-hour window
    sessionExpiry = new Date(Date.now() + config.session.userDuration);
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        role: 'USER',
        isPermanent: false,
        sessionExpiry,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        sessionExpiry,
        lastLoginAt: new Date(),
      },
    });
  }

  // Create session with refresh token
  const refreshTokenString = generateRefreshTokenString();
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: refreshTokenString,
      userAgent,
      ipAddress,
      expiresAt: refreshExpiresAt,
    },
  });

  const accessToken = generateAccessToken(user.id);

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken: refreshTokenString,
    expiresIn: 900, // 15 minutes in seconds
  };
}

export async function loginWithPassword(email, password, userAgent, ipAddress) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, industry: true, companySize: true, website: true },
      },
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user || !user.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is active
  if (user.isActive === false) {
    throw new AppError('Your account has been paused. Please contact your administrator.', 403);
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create session
  const refreshTokenString = generateRefreshTokenString();
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: refreshTokenString,
      userAgent,
      ipAddress,
      expiresAt: refreshExpiresAt,
    },
  });

  const accessToken = generateAccessToken(user.id);

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken: refreshTokenString,
    expiresIn: 900,
  };
}

export async function refreshAccessToken(refreshToken) {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } });
    throw new AppError('Refresh token expired', 401);
  }

  // Rotate refresh token
  const newRefreshTokenString = generateRefreshTokenString();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshTokenString,
      expiresAt: newExpiresAt,
    },
  });

  const accessToken = generateAccessToken(session.user.id);

  return {
    accessToken,
    refreshToken: newRefreshTokenString,
    expiresIn: 900,
  };
}

export async function logout(refreshToken) {
  if (refreshToken) {
    await prisma.session.deleteMany({
      where: { refreshToken },
    });
  }
  return { success: true };
}

export async function logoutAllSessions(userId) {
  await prisma.session.deleteMany({
    where: { userId },
  });
  return { success: true };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, industry: true, companySize: true, website: true },
      },
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return formatUserResponse(user);
}

export async function updateCurrentUser(userId, data) {
  const { name, jobTitle } = data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(jobTitle !== undefined && { jobTitle }),
    },
  });

  return formatUserResponse(user);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function formatUserResponse(user) {
  // Determine user type for backwards compatibility
  let userType = 'user';
  if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
    userType = 'admin';
  }
  if (user.role === 'SUPER_ADMIN') {
    userType = 'superadmin';
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: user.jobTitle,
    role: user.role,
    userType,
    isPermanent: user.isPermanent,
    sessionExpiry: user.sessionExpiry,
    expiresAt: user.sessionExpiry ? user.sessionExpiry.getTime() : null,
    role_id: user.role === 'SUPER_ADMIN' ? 'super-admin' : null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    // Organization/Department hierarchy
    organizationId: user.organizationId || null,
    departmentId: user.departmentId || null,
    organization: user.organization || null,
    department: user.department || null,
    // Trial user info
    isTrialUser: user.isTrialUser || false,
    deliverablesUsed: user.deliverablesUsed || 0,
  };
}

// ============ Password Reset Token Functions ============

export async function createPasswordResetToken(email, type = 'reset') {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    // Don't reveal if email exists - return success anyway
    return { success: true };
  }

  // Invalidate existing unused tokens for this user of this type
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
      type,
    },
    data: { usedAt: new Date() }
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = type === 'invite'
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
    : new Date(Date.now() + 60 * 60 * 1000);          // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      type,
      expiresAt,
    }
  });

  return { token, user, success: true };
}

export async function requestPasswordReset(email) {
  const result = await createPasswordResetToken(email, 'reset');

  if (result.token && result.user) {
    // Send password reset email
    await sendPasswordResetEmail(result.user.email, result.user.name, result.token);
  }

  // Always return success to not reveal if email exists
  return { success: true, message: 'If an account exists with this email, a reset link has been sent.' };
}

export async function validateResetToken(token) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw new AppError('Invalid or expired reset link', 400);
  }

  if (resetToken.usedAt) {
    throw new AppError('This reset link has already been used', 400);
  }

  if (new Date() > resetToken.expiresAt) {
    throw new AppError('This reset link has expired', 400);
  }

  return {
    valid: true,
    type: resetToken.type,
    email: resetToken.user.email,
    name: resetToken.user.name,
  };
}

export async function resetPassword(token, newPassword) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw new AppError('Invalid or expired reset link', 400);
  }

  if (resetToken.usedAt) {
    throw new AppError('This reset link has already been used', 400);
  }

  if (new Date() > resetToken.expiresAt) {
    throw new AppError('This reset link has expired', 400);
  }

  // Validate password requirements
  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Password has been reset successfully' };
}

export async function setInitialPassword(token, newPassword) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw new AppError('Invalid or expired invite link', 400);
  }

  if (resetToken.type !== 'invite') {
    throw new AppError('Invalid token type', 400);
  }

  if (resetToken.usedAt) {
    throw new AppError('This invite link has already been used', 400);
  }

  if (new Date() > resetToken.expiresAt) {
    throw new AppError('This invite link has expired', 400);
  }

  // Validate password requirements
  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Password has been set successfully' };
}

export async function createInviteToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const result = await createPasswordResetToken(user.email, 'invite');

  if (result.token) {
    // Send invite email
    await sendInviteEmail(user.email, user.name, result.token);
  }

  return { success: true, token: result.token };
}

// ============ Access Request Functions ============

export async function submitAccessRequest(data) {
  const { name, company, email, jobTitle, password } = data;
  const normalizedEmail = email.toLowerCase().trim();

  // Validate required fields
  if (!name?.trim()) {
    throw new AppError('Name is required', 400);
  }
  if (!company?.trim()) {
    throw new AppError('Company is required', 400);
  }
  if (!normalizedEmail) {
    throw new AppError('Email is required', 400);
  }
  if (!jobTitle?.trim()) {
    throw new AppError('Job title is required', 400);
  }
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Check if email is already in use by an existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new AppError('An account with this email already exists', 400);
  }

  // Check if there's already a pending access request for this email
  const existingRequest = await prisma.accessRequest.findFirst({
    where: {
      email: normalizedEmail,
      status: 'pending',
    },
  });

  if (existingRequest) {
    throw new AppError('An access request for this email is already pending review', 400);
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create the access request
  const accessRequest = await prisma.accessRequest.create({
    data: {
      name: name.trim(),
      company: company.trim(),
      email: normalizedEmail,
      jobTitle: jobTitle.trim(),
      passwordHash,
      status: 'pending',
    },
  });

  // Get all super admin emails to notify
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { email: true },
  });

  const superAdminEmails = superAdmins.map(admin => admin.email);

  // Send notification email to super admins
  if (superAdminEmails.length > 0) {
    await sendAccessRequestNotification(accessRequest, superAdminEmails);
  } else {
    console.log('No super admins found to notify about access request');
  }

  return {
    success: true,
    message: 'Access request submitted successfully',
    id: accessRequest.id,
  };
}

// ============ Access Request Management Functions ============

export async function listAccessRequests(status = null) {
  const where = status ? { status } : {};

  return prisma.accessRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function approveAccessRequest(requestId, adminUserId, options = {}) {
  const { accessExpiry, accessDays, deliverablesLimit } = options;

  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError('Access request not found', 404);
  }

  if (request.status !== 'pending') {
    throw new AppError(`This request has already been ${request.status}`, 400);
  }

  // Check if email is already in use
  const existingUser = await prisma.user.findUnique({
    where: { email: request.email },
  });

  if (existingUser) {
    throw new AppError('A user with this email already exists', 400);
  }

  // Calculate expiry date if provided by super admin
  let expiryDate = null;
  if (accessExpiry) {
    expiryDate = new Date(accessExpiry);
    if (isNaN(expiryDate.getTime())) {
      throw new AppError('Invalid accessExpiry date format', 400);
    }
    if (expiryDate <= new Date()) {
      throw new AppError('Access expiry must be in the future', 400);
    }
  } else if (accessDays && accessDays > 0) {
    expiryDate = new Date(Date.now() + accessDays * 24 * 60 * 60 * 1000);
  }
  // If neither provided, expiryDate remains null (indefinite access)

  // Get admin info for audit trail
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { email: true },
  });

  // Determine if this is a limited/trial user
  // Trial user = has either a time limit OR an output limit
  const hasOutputLimit = deliverablesLimit && deliverablesLimit > 0;
  const hasTimeLimit = !!expiryDate;
  const isTrialUser = hasOutputLimit || hasTimeLimit;

  // Create user - trial if limits are set
  const newUser = await prisma.user.create({
    data: {
      email: request.email,
      name: request.name,
      jobTitle: request.jobTitle,
      passwordHash: request.passwordHash,
      role: 'USER',
      isTrialUser,
      isPermanent: !isTrialUser,
      sessionExpiry: expiryDate,
      deliverablesLimit: hasOutputLimit ? parseInt(deliverablesLimit) : null,
      deliverablesUsed: 0,
      isActive: true,
    },
  });

  // Mark the request as approved
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: adminUser?.email || adminUserId,
    },
  });

  // Send approval email to the user
  await sendAccessApprovedEmail(request.email, request.name);

  return {
    success: true,
    message: 'Access request approved',
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    },
  };
}

export async function rejectAccessRequest(requestId, adminUserId, reason = null) {
  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError('Access request not found', 404);
  }

  if (request.status !== 'pending') {
    throw new AppError(`This request has already been ${request.status}`, 400);
  }

  // Get admin info for audit trail
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { email: true },
  });

  // Mark the request as rejected
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: adminUser?.email || adminUserId,
    },
  });

  // Send rejection email to the user
  await sendAccessRejectedEmail(request.email, request.name, reason);

  return {
    success: true,
    message: 'Access request rejected',
  };
}

// ============ Trial User Deliverable Limit Functions ============

// Default limit for legacy trial users without a specific limit set
const DEFAULT_TRIAL_USER_DELIVERABLE_LIMIT = 3;

export async function checkTrialUserDeliverableLimit(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isTrialUser: true,
      deliverablesUsed: true,
      deliverablesLimit: true,
      sessionExpiry: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if time-based access has expired (completely locked out)
  if (user.sessionExpiry && new Date() > new Date(user.sessionExpiry)) {
    return {
      canSave: false,
      isTrialUser: true,
      isLockedOut: true,
      isViewOnly: false,
      deliverablesUsed: user.deliverablesUsed,
      deliverableLimit: user.deliverablesLimit,
      remaining: 0,
      message: 'Your access period has expired. Please contact an administrator.',
    };
  }

  // Not a trial user = full access
  if (!user.isTrialUser) {
    return { canSave: true, isTrialUser: false, isLockedOut: false, isViewOnly: false };
  }

  // Use user's specific limit, or default if not set
  const limit = user.deliverablesLimit ?? DEFAULT_TRIAL_USER_DELIVERABLE_LIMIT;

  // If no limit set (null) and no default needed, allow unlimited
  if (user.deliverablesLimit === null && !user.isTrialUser) {
    return { canSave: true, isTrialUser: false, isLockedOut: false, isViewOnly: false };
  }

  const remaining = limit - user.deliverablesUsed;
  const limitReached = user.deliverablesUsed >= limit;

  // View-only mode: output limit reached but time hasn't expired yet
  const isViewOnly = limitReached && (!user.sessionExpiry || new Date() <= new Date(user.sessionExpiry));

  return {
    canSave: !limitReached,
    isTrialUser: true,
    isLockedOut: false,
    isViewOnly,
    deliverablesUsed: user.deliverablesUsed,
    deliverableLimit: limit,
    remaining: Math.max(0, remaining),
    message: isViewOnly
      ? `You have used all ${limit} outputs. You can still view your saved work until your access expires.`
      : null,
  };
}

export async function incrementTrialUserDeliverables(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isTrialUser: true, deliverablesUsed: true, deliverablesLimit: true },
  });

  if (!user || !user.isTrialUser) {
    return { success: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deliverablesUsed: user.deliverablesUsed + 1 },
  });

  const newCount = user.deliverablesUsed + 1;
  const limit = user.deliverablesLimit ?? DEFAULT_TRIAL_USER_DELIVERABLE_LIMIT;
  const remaining = limit - newCount;

  return {
    success: true,
    deliverablesUsed: newCount,
    deliverableLimit: limit,
    remaining: Math.max(0, remaining),
    limitReached: newCount >= limit,
  };
}

// ============ Password Change Functions ============

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, email: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.passwordHash) {
    throw new AppError('Cannot change password - no password set on this account', 400);
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Validate new password requirements
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  // Check for password complexity (at least one number and one letter)
  if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
    throw new AppError('Password must contain at least one letter and one number', 400);
  }

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true, message: 'Password changed successfully' };
}

// ============ Session Management Functions ============

export async function listUserSessions(userId, currentRefreshToken = null) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map(session => ({
    id: session.id,
    userAgent: parseUserAgent(session.userAgent),
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    lastUsedAt: session.updatedAt || session.createdAt,
    isCurrent: currentRefreshToken ? session.refreshToken === currentRefreshToken : false,
  }));
}

export async function logoutOtherSessions(userId, currentRefreshToken) {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      refreshToken: { not: currentRefreshToken },
    },
  });

  return { success: true, count: result.count };
}

export async function logoutSession(userId, sessionId) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  return { success: true };
}

// Helper function to parse user agent string into readable format
function parseUserAgent(userAgentString) {
  if (!userAgentString) return 'Unknown device';

  let browser = 'Unknown browser';
  let os = 'Unknown OS';

  // Detect browser
  if (userAgentString.includes('Chrome') && !userAgentString.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgentString.includes('Safari') && !userAgentString.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgentString.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgentString.includes('Edg')) {
    browser = 'Edge';
  }

  // Detect OS
  if (userAgentString.includes('Windows')) {
    os = 'Windows';
  } else if (userAgentString.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgentString.includes('Linux')) {
    os = 'Linux';
  } else if (userAgentString.includes('iPhone') || userAgentString.includes('iPad')) {
    os = 'iOS';
  } else if (userAgentString.includes('Android')) {
    os = 'Android';
  }

  return `${browser} on ${os}`;
}
