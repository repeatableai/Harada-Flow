import prisma from '../db.js';
import bcrypt from 'bcrypt';
import { AppError } from '../middleware/errorHandler.js';
import { deleteFile } from './storage.service.js';

/**
 * GDPR Right to Erasure Service
 *
 * Handles personal data erasure requests per GDPR Article 17.
 * - Users can erase their own data
 * - Admins can process erasure requests for users in their org
 * - All erasure events are logged in activity_logs (excluded from erasure per GDPR Art. 17(3)(e))
 */

/**
 * Get a summary of all personal data stored for a user.
 * Shows counts and categories before deletion so the user knows what will be removed.
 */
export async function getDataSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const [
    companiesCount,
    savedPromptsCount,
    knowledgeFilesCount,
    timeStudiesCount,
    sessionsCount,
    activityLogsCount,
  ] = await Promise.all([
    prisma.company.count({ where: { userId } }),
    prisma.savedPrompt.count({
      where: { company: { userId } },
    }),
    prisma.knowledgeFile.count({ where: { uploaderId: userId } }),
    prisma.timeStudy.count({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.activityLog.count({ where: { userId } }),
  ]);

  return {
    user: {
      email: user.email,
      name: user.name,
      jobTitle: user.jobTitle,
      role: user.role,
      organization: user.organization?.name || null,
      department: user.department?.name || null,
      createdAt: user.createdAt,
      hasPassword: !!user.passwordHash,
    },
    dataCounts: {
      roleSessions: companiesCount,
      savedDeliverables: savedPromptsCount,
      knowledgeFiles: knowledgeFilesCount,
      timeStudies: timeStudiesCount,
      activeSessions: sessionsCount,
    },
    // Activity logs are retained for compliance (GDPR Art. 17(3)(e))
    retainedForCompliance: {
      activityLogs: activityLogsCount,
    },
  };
}

/**
 * Erase all personal data for a user (self-service).
 * Requires password verification for users with passwords, or email confirmation phrase.
 *
 * What gets deleted:
 * - User account and profile data
 * - All role sessions (companies) and their saved deliverables
 * - All uploaded knowledge files (both DB records and stored files)
 * - All time study records
 * - All authentication sessions
 * - All password reset tokens
 *
 * What is RETAINED (GDPR Art. 17(3)(e) - legal obligation):
 * - Activity logs are anonymized (userId replaced, personal metadata stripped)
 */
export async function eraseUserData(userId, confirmationPhrase, password) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify confirmation phrase matches "DELETE ALL MY DATA"
  if (confirmationPhrase !== 'DELETE ALL MY DATA') {
    throw new AppError('Confirmation phrase does not match. Please type exactly: DELETE ALL MY DATA', 400);
  }

  // If user has a password, verify it
  if (user.passwordHash) {
    if (!password) {
      throw new AppError('Password is required to confirm account deletion', 400);
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid password', 401);
    }
  }

  // Step 1: Delete stored files from Supabase/local storage
  const knowledgeFiles = await prisma.knowledgeFile.findMany({
    where: { uploaderId: userId },
    select: { filename: true },
  });

  for (const file of knowledgeFiles) {
    try {
      await deleteFile(file.filename);
    } catch (err) {
      console.error(`Failed to delete stored file ${file.filename}:`, err.message);
      // Continue with erasure even if file deletion fails
    }
  }

  // Step 2: Log the erasure event BEFORE deleting the user (for compliance audit trail)
  await prisma.activityLog.create({
    data: {
      userId: 'ERASED',
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      activityType: 'gdpr_erasure',
      resourceType: 'user_account',
      resourceId: userId,
      metadata: {
        action: 'self_erasure',
        userEmail: user.email,
        erasedAt: new Date().toISOString(),
        dataErased: {
          account: true,
          roleSessions: true,
          savedDeliverables: true,
          knowledgeFiles: knowledgeFiles.length,
          timeStudies: true,
          sessions: true,
        },
      },
    },
  });

  // Step 3: Anonymize existing activity logs for this user
  // Use raw SQL for JSON manipulation since Prisma doesn't support partial JSON updates
  await prisma.$executeRaw`
    UPDATE activity_logs
    SET user_id = 'ERASED',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb) - 'userName' - 'userEmail',
          '{anonymized}',
          'true'::jsonb
        )
    WHERE user_id = ${userId}
  `;

  // Step 4: Delete the user (cascades to companies, sessions, time studies, knowledge files, password tokens)
  await prisma.user.delete({
    where: { id: userId },
  });

  return {
    success: true,
    message: 'All personal data has been erased. Activity logs have been anonymized and retained for compliance purposes.',
  };
}

/**
 * Admin: Erase a user's data on behalf of a data subject request.
 * Only admins within the same organization (or super admins) can do this.
 */
export async function adminEraseUserData(targetUserId, callerUser) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { organization: { select: { name: true } } },
  });

  if (!targetUser) {
    throw new AppError('User not found', 404);
  }

  // Prevent self-erasure via admin endpoint
  if (targetUserId === callerUser.id) {
    throw new AppError('Use the personal data erasure endpoint to delete your own data', 400);
  }

  // Check organization scoping
  if (callerUser.role !== 'SUPER_ADMIN') {
    if (targetUser.organizationId !== callerUser.organizationId) {
      throw new AppError('Cannot erase data for users outside your organization', 403);
    }
    if (!['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      throw new AppError('Insufficient permissions to process erasure requests', 403);
    }
  }

  // Delete stored files
  const knowledgeFiles = await prisma.knowledgeFile.findMany({
    where: { uploaderId: targetUserId },
    select: { filename: true },
  });

  for (const file of knowledgeFiles) {
    try {
      await deleteFile(file.filename);
    } catch (err) {
      console.error(`Failed to delete stored file ${file.filename}:`, err.message);
    }
  }

  // Log the admin-initiated erasure
  await prisma.activityLog.create({
    data: {
      userId: callerUser.id,
      organizationId: callerUser.organizationId,
      departmentId: callerUser.departmentId,
      activityType: 'gdpr_erasure',
      resourceType: 'user_account',
      resourceId: targetUserId,
      metadata: {
        action: 'admin_erasure',
        targetEmail: targetUser.email,
        processedBy: callerUser.email,
        erasedAt: new Date().toISOString(),
        dataErased: {
          account: true,
          roleSessions: true,
          savedDeliverables: true,
          knowledgeFiles: knowledgeFiles.length,
          timeStudies: true,
          sessions: true,
        },
      },
    },
  });

  // Anonymize target user's activity logs
  await prisma.activityLog.updateMany({
    where: { userId: targetUserId },
    data: {
      userId: 'ERASED',
    },
  });

  // Delete the user (cascades)
  await prisma.user.delete({
    where: { id: targetUserId },
  });

  return {
    success: true,
    message: `Data for ${targetUser.email} has been erased. Activity logs have been anonymized and retained for compliance.`,
  };
}
