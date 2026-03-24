import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from './activityLog.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory path
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Role hierarchy levels
const ROLE_LEVELS = {
  USER: 1,
  DEPARTMENT_ADMIN: 2,
  COMPANY_ADMIN: 3,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Check if a user can upload to a specific scope
 */
function canUploadToScope(user, scope) {
  const roleLevel = ROLE_LEVELS[user.role] || 0;

  switch (scope) {
    case 'self':
      return true; // All users can upload to self
    case 'users':
      return roleLevel >= ROLE_LEVELS.DEPARTMENT_ADMIN; // Admins can share with specific users
    case 'departments':
    case 'company':
      return roleLevel >= ROLE_LEVELS.DEPARTMENT_ADMIN;
    case 'system':
      return roleLevel >= ROLE_LEVELS.SUPER_ADMIN;
    default:
      return false;
  }
}

/**
 * Check if a user can access a file
 */
function canAccessFile(file, user) {
  const roleLevel = ROLE_LEVELS[user.role] || 0;

  // Super admin can access everything
  if (roleLevel >= ROLE_LEVELS.SUPER_ADMIN) {
    return true;
  }

  // Company admin can access all files in their organization
  if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN && file.organizationId === user.organizationId) {
    return true;
  }

  // Check based on file scope
  switch (file.scope) {
    case 'self':
      return file.uploaderId === user.id;

    case 'users':
      // User must be in the shared users list or be the uploader
      if (file.sharedUserIds && file.sharedUserIds.includes(user.id)) {
        return true;
      }
      return file.uploaderId === user.id;

    case 'departments':
      // User must be in one of the shared departments
      if (file.departmentIds && file.departmentIds.includes(user.departmentId)) {
        return true;
      }
      // Or be a dept admin of the same org
      if (roleLevel >= ROLE_LEVELS.DEPARTMENT_ADMIN && file.organizationId === user.organizationId) {
        return true;
      }
      // Or be the uploader
      return file.uploaderId === user.id;

    case 'company':
      // User must be in the same organization
      return file.organizationId === user.organizationId;

    case 'system':
      // System files are visible to everyone
      return true;

    default:
      return file.uploaderId === user.id;
  }
}

/**
 * Check if a user can delete a file
 */
function canDeleteFile(file, user) {
  // Super admin can delete any file
  if (ROLE_LEVELS[user.role] >= ROLE_LEVELS.SUPER_ADMIN) {
    return true;
  }
  // Only the uploader can delete their files
  return file.uploaderId === user.id;
}

/**
 * Upload a file
 */
export async function uploadFile(file, user, scope, departmentIds = [], description = null, organizationId = null, companyId = null, userIds = []) {
  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new AppError('File type not allowed. Allowed types: PDF, DOC, DOCX, TXT, CSV, XLSX, PNG, JPG, GIF', 400);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('File too large. Maximum size is 10MB', 400);
  }

  // Validate scope permissions
  if (!canUploadToScope(user, scope)) {
    throw new AppError('You do not have permission to upload files with this scope', 403);
  }

  // For departments scope, validate departmentIds
  if (scope === 'departments' && (!departmentIds || departmentIds.length === 0)) {
    throw new AppError('You must select at least one department for department-scoped files', 400);
  }

  // For users scope, validate userIds
  if (scope === 'users' && (!userIds || userIds.length === 0)) {
    throw new AppError('You must select at least one user for user-scoped files', 400);
  }

  // Validate companyId if provided - user must own the company
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: user.id },
    });
    if (!company) {
      throw new AppError('Company not found or access denied', 404);
    }
  }

  // Determine which organization to use:
  // - Super Admin can specify an organization for company/department scope files
  // - Others use their own organization
  // - Personal (self) files don't require an organization
  let targetOrgId = null;
  if (scope !== 'self') {
    if (ROLE_LEVELS[user.role] >= ROLE_LEVELS.SUPER_ADMIN && organizationId) {
      targetOrgId = organizationId;
    } else {
      targetOrgId = user.organizationId || null;
    }
  }

  // Create knowledge file record
  const knowledgeFile = await prisma.knowledgeFile.create({
    data: {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploaderId: user.id,
      scope,
      departmentIds: scope === 'departments' ? departmentIds : [],
      sharedUserIds: scope === 'users' ? userIds : [],
      organizationId: targetOrgId,
      companyId,
      description,
    },
    include: {
      uploader: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  // Log file upload activity
  logActivity({
    userId: user.id,
    organizationId: targetOrgId,
    departmentId: user.departmentId || null,
    activityType: 'file_upload',
    resourceType: 'knowledge_file',
    resourceId: knowledgeFile.id,
    metadata: {
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      scope,
      userName: user.name || user.email,
    },
  });

  return formatFileResponse(knowledgeFile);
}

/**
 * Link a file to a company (role session)
 */
export async function linkToCompany(fileId, companyId, user) {
  const file = await prisma.knowledgeFile.findUnique({
    where: { id: fileId },
  });

  if (!file || file.uploaderId !== user.id) {
    throw new AppError('File not found or access denied', 404);
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: user.id },
  });

  if (!company) {
    throw new AppError('Company not found or access denied', 404);
  }

  const updated = await prisma.knowledgeFile.update({
    where: { id: fileId },
    data: { companyId },
    include: {
      uploader: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  return formatFileResponse(updated);
}

/**
 * List files accessible by a user
 */
export async function listFiles(user, query = {}) {
  const { page = 1, limit = 20, search = '', scopeFilter = 'all' } = query;
  const skip = (page - 1) * limit;

  const roleLevel = ROLE_LEVELS[user.role] || 0;

  // Build where clause based on user role and access permissions
  let whereClause = {};

  if (roleLevel >= ROLE_LEVELS.SUPER_ADMIN) {
    // Super admin sees all files
    whereClause = {};
  } else if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) {
    // Company admin sees all files in their organization
    whereClause = {
      OR: [
        { organizationId: user.organizationId },
        { scope: 'system' },
        { uploaderId: user.id },
      ],
    };
  } else if (roleLevel >= ROLE_LEVELS.DEPARTMENT_ADMIN) {
    // Department admin sees files in their org that are company-wide, in their dept, shared with them, or their own
    whereClause = {
      OR: [
        { uploaderId: user.id },
        { scope: 'system' },
        {
          AND: [
            { organizationId: user.organizationId },
            { scope: 'company' },
          ],
        },
        {
          AND: [
            { organizationId: user.organizationId },
            { scope: 'departments' },
            { departmentIds: { has: user.departmentId } },
          ],
        },
        {
          AND: [
            { scope: 'users' },
            { sharedUserIds: { has: user.id } },
          ],
        },
      ],
    };
  } else {
    // Regular user sees their own files + files shared with them
    whereClause = {
      OR: [
        { uploaderId: user.id },
        { scope: 'system' },
        {
          AND: [
            { organizationId: user.organizationId },
            { scope: 'company' },
          ],
        },
        {
          AND: [
            { organizationId: user.organizationId },
            { scope: 'departments' },
            { departmentIds: { has: user.departmentId } },
          ],
        },
        {
          AND: [
            { scope: 'users' },
            { sharedUserIds: { has: user.id } },
          ],
        },
      ],
    };
  }

  // Apply scope filter
  if (scopeFilter !== 'all') {
    whereClause = {
      AND: [
        whereClause,
        { scope: scopeFilter },
      ],
    };
  }

  // Apply search filter
  if (search) {
    whereClause = {
      AND: [
        whereClause,
        {
          OR: [
            { originalName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ],
    };
  }

  const [files, total] = await Promise.all([
    prisma.knowledgeFile.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.knowledgeFile.count({ where: whereClause }),
  ]);

  return {
    data: files.map(formatFileResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single file by ID
 */
export async function getFile(fileId, user) {
  const file = await prisma.knowledgeFile.findUnique({
    where: { id: fileId },
    include: {
      uploader: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (!canAccessFile(file, user)) {
    throw new AppError('You do not have permission to access this file', 403);
  }

  return formatFileResponse(file);
}

/**
 * Get file for download (returns file path and metadata)
 */
export async function downloadFile(fileId, user) {
  const file = await prisma.knowledgeFile.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (!canAccessFile(file, user)) {
    throw new AppError('You do not have permission to download this file', 403);
  }

  const filePath = path.join(UPLOADS_DIR, file.filename);

  if (!fs.existsSync(filePath)) {
    throw new AppError('File not found on server', 404);
  }

  // Log file access activity
  logActivity({
    userId: user.id,
    organizationId: file.organizationId,
    departmentId: user.departmentId || null,
    activityType: 'file_access',
    resourceType: 'knowledge_file',
    resourceId: file.id,
    metadata: {
      fileName: file.originalName,
      fileType: file.mimeType,
      userName: user.name || user.email,
    },
  });

  return {
    filePath,
    originalName: file.originalName,
    mimeType: file.mimeType,
  };
}

/**
 * Delete a file
 */
export async function deleteFile(fileId, user) {
  const file = await prisma.knowledgeFile.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (!canDeleteFile(file, user)) {
    throw new AppError('You do not have permission to delete this file', 403);
  }

  // Delete file from filesystem
  const filePath = path.join(UPLOADS_DIR, file.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete database record
  await prisma.knowledgeFile.delete({
    where: { id: fileId },
  });

  return { success: true };
}

/**
 * Get all files linked to a session (company) for LLM context
 * @param {string} companyId - The session/company ID
 * @returns {Promise<Array>} - Array of file records with text-extractable info
 */
export async function getFilesForSession(companyId) {
  const files = await prisma.knowledgeFile.findMany({
    where: { companyId },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return files;
}

/**
 * Format file response
 */
function formatFileResponse(file) {
  return {
    id: file.id,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    scope: file.scope,
    departmentIds: file.departmentIds,
    sharedUserIds: file.sharedUserIds || [],
    description: file.description,
    uploaderId: file.uploaderId,
    uploader: file.uploader || null,
    organizationId: file.organizationId,
    organization: file.organization || null,
    companyId: file.companyId || null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}
