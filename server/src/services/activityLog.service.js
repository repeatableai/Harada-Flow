import prisma from '../db.js';

/**
 * Log an activity
 * @param {Object} params
 * @param {string} params.userId - User who performed the action
 * @param {string} params.organizationId - Organization context (for scoping)
 * @param {string} params.departmentId - Department context (for scoping)
 * @param {string} params.activityType - Type of activity: 'file_upload', 'file_access', 'session_load'
 * @param {string} params.resourceType - Type of resource: 'knowledge_file', 'session'
 * @param {string} params.resourceId - ID of the resource
 * @param {Object} params.metadata - Additional metadata (fileName, fileType, userName, sessionName, etc.)
 */
export async function logActivity({
  userId,
  organizationId = null,
  departmentId = null,
  activityType,
  resourceType,
  resourceId = null,
  metadata = null,
}) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId,
        organizationId,
        departmentId,
        activityType,
        resourceType,
        resourceId,
        metadata,
      },
    });
    return log;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not block operations
    return null;
  }
}

/**
 * Get activity logs with role-based scoping
 * @param {Object} callerUser - The user making the request (for scoping)
 * @param {Object} query - Query parameters
 */
export async function getActivityLogs(callerUser, query = {}) {
  const {
    page = 1,
    limit = 20,
    activityType,
    resourceType,
    userId,
  } = query;

  const skip = (page - 1) * limit;

  // Build where clause based on caller's role scope
  let where = {};

  // Super admins see everything
  if (callerUser.role === 'SUPER_ADMIN') {
    // No additional filtering needed
  }
  // Company admins see all activity in their organization
  else if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
    where.organizationId = callerUser.organizationId;
  }
  // Department admins see activity in their department only
  else if (callerUser.role === 'DEPARTMENT_ADMIN') {
    where.organizationId = callerUser.organizationId;
    where.departmentId = callerUser.departmentId;
  }
  // Regular users see nothing (or their own activity)
  else {
    where.userId = callerUser.id;
  }

  // Apply filters
  if (activityType) {
    where.activityType = activityType;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (userId) {
    where.userId = userId;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get activity stats for the admin dashboard
 * @param {Object} callerUser - The user making the request (for scoping)
 */
export async function getActivityStats(callerUser) {
  // Build where clause based on caller's role scope
  let where = {};

  if (callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      where.organizationId = callerUser.organizationId;
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      where.organizationId = callerUser.organizationId;
      where.departmentId = callerUser.departmentId;
    } else {
      where.userId = callerUser.id;
    }
  }

  const [
    totalLogs,
    recentLogs,
    byType,
  ] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.activityLog.groupBy({
      by: ['activityType'],
      where,
      _count: true,
    }),
  ]);

  return {
    totalLogs,
    recentLogs,
    byType: byType.reduce((acc, item) => {
      acc[item.activityType] = item._count;
      return acc;
    }, {}),
  };
}
