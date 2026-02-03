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
import { sendVerificationEmail } from './email.service.js';

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
  });

  if (!user || !user.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401);
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
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: user.jobTitle,
    role: user.role,
    userType: user.role === 'USER' ? 'user' : 'superadmin',
    isPermanent: user.isPermanent,
    sessionExpiry: user.sessionExpiry,
    expiresAt: user.sessionExpiry ? user.sessionExpiry.getTime() : null,
    role_id: user.role === 'SUPER_ADMIN' ? 'super-admin' : null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
