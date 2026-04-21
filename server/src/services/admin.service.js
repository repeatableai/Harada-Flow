import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { canManageUser } from '../middleware/admin.js';
import { hashPassword } from './auth.service.js';

// Build where clause based on caller's role scope
function buildScopeWhere(callerUser, baseWhere = {}) {
  const where = { ...baseWhere };

  // Super admins see everything
  if (callerUser.role === 'SUPER_ADMIN') {
    return where;
  }

  // Company admins see their organization
  if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
    where.organizationId = callerUser.organizationId;
    return where;
  }

  // Department admins see their department
  if (callerUser.role === 'DEPARTMENT_ADMIN') {
    where.organizationId = callerUser.organizationId;
    where.departmentId = callerUser.departmentId;
    return where;
  }

  // Regular users see nothing
  where.id = 'impossible-id-no-access';
  return where;
}

export async function listUsers(query = {}, callerUser = null) {
  const {
    search,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    role,
    organizationId,
    departmentId,
    isActive,
  } = query;

  // Handle sort field mapping
  let orderByField = sort.startsWith('-') ? sort.slice(1) : sort;
  const orderDirection = sort.startsWith('-') ? 'desc' : 'asc';

  // Map frontend field names to database field names
  const fieldMapping = {
    createdAt: 'createdAt',
    name: 'name',
    email: 'email',
    role: 'role',
    lastLoginAt: 'lastLoginAt',
  };

  // Handle special cases for related field sorting
  let orderBy;
  if (orderByField === 'department' || orderByField === 'departmentName') {
    // Sort by department name (related field)
    orderBy = { department: { name: orderDirection } };
  } else if (orderByField === 'organization' || orderByField === 'organizationName') {
    // Sort by organization name (related field)
    orderBy = { organization: { name: orderDirection } };
  } else {
    orderByField = fieldMapping[orderByField] || orderByField;
    orderBy = { [orderByField]: orderDirection };
  }

  const skip = (page - 1) * limit;

  let where = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Apply filters
  if (role) {
    where.role = role;
  }

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  if (isActive !== undefined && isActive !== null && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  // Apply scope based on caller's role
  if (callerUser) {
    where = buildScopeWhere(callerUser, where);
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      take: parseInt(limit),
      skip,
      select: {
        id: true,
        email: true,
        name: true,
        jobTitle: true,
        role: true,
        isPermanent: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        organizationId: true,
        departmentId: true,
        organization: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
        _count: {
          select: { companies: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      job_title: user.jobTitle,
      role: user.role,
      isPermanent: user.isPermanent,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      organization: user.organization,
      department: user.department,
      companiesCount: user._count.companies,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUser(userId, callerUser = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      companies: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      organization: {
        select: { id: true, name: true },
      },
      department: {
        select: { id: true, name: true },
      },
      _count: {
        select: { companies: true },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Check scope access
  if (callerUser && callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      if (user.organizationId !== callerUser.organizationId) {
        return null; // Not in same org
      }
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      if (user.organizationId !== callerUser.organizationId ||
          user.departmentId !== callerUser.departmentId) {
        return null; // Not in same dept
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    job_title: user.jobTitle,
    role: user.role,
    isPermanent: user.isPermanent,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    organizationId: user.organizationId,
    departmentId: user.departmentId,
    organization: user.organization,
    department: user.department,
    companiesCount: user._count.companies,
    companies: user.companies.map(formatCompanyResponse),
  };
}

export async function listAllCompanies(query = {}, callerUser = null) {
  const { search, userId, page = 1, limit = 20, sort = '-createdAt' } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = {};

  if (userId) {
    where.userId = userId;
  }

  if (search) {
    where.OR = [
      { jobTitle: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
      { createdBy: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Apply organization scoping based on caller's role
  if (callerUser && callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      // Company admins see companies created by users in their organization
      where.user = { organizationId: callerUser.organizationId };
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      // Department admins see companies created by users in their department
      where.user = {
        organizationId: callerUser.organizationId,
        departmentId: callerUser.departmentId,
      };
    } else {
      // Regular users see nothing
      where.id = 'impossible-id-no-access';
    }
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy,
      take: parseInt(limit),
      skip,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return {
    data: companies.map(company => ({
      ...formatCompanyResponse(company),
      user: company.user,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCompanyAdmin(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!company) {
    return null;
  }

  return {
    ...formatCompanyResponse(company),
    user: company.user,
  };
}

export async function getStats(callerUser = null) {
  // Build organization/department scope for users
  let userWhere = {};
  let companyWhere = {};

  if (callerUser && callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      userWhere.organizationId = callerUser.organizationId;
      companyWhere.user = { organizationId: callerUser.organizationId };
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      userWhere.organizationId = callerUser.organizationId;
      userWhere.departmentId = callerUser.departmentId;
      companyWhere.user = {
        organizationId: callerUser.organizationId,
        departmentId: callerUser.departmentId,
      };
    } else {
      // Regular users see nothing
      userWhere.id = 'impossible-id-no-access';
      companyWhere.id = 'impossible-id-no-access';
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalCompanies,
    recentUsers,
    recentCompanies,
    usersByRole,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.company.count({ where: companyWhere }),
    prisma.user.count({
      where: {
        ...userWhere,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.company.count({
      where: {
        ...companyWhere,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: userWhere,
      _count: true,
    }),
  ]);

  return {
    totalUsers,
    totalCompanies,
    recentUsers,
    recentCompanies,
    usersByRole: usersByRole.reduce((acc, item) => {
      acc[item.role] = item._count;
      return acc;
    }, {}),
  };
}

export async function listAllSavedPrompts(query = {}, callerUser = null) {
  const { search, deliverableType, companyId, userId, page = 1, limit = 20, sort = '-createdAt' } = query;

  // Handle sort field mapping
  let orderByField = sort.startsWith('-') ? sort.slice(1) : sort;
  const orderDirection = sort.startsWith('-') ? 'desc' : 'asc';

  // Map frontend field names to database field names
  const fieldMapping = {
    createdAt: 'createdAt',
    deliverableName: 'deliverableName',
    deliverable_name: 'deliverableName',
    deliverableType: 'deliverableType',
    deliverable_type: 'deliverableType',
  };

  orderByField = fieldMapping[orderByField] || orderByField;
  const orderBy = { [orderByField]: orderDirection };

  const skip = (page - 1) * limit;

  const where = {};

  if (deliverableType) {
    where.deliverableType = deliverableType;
  }

  // Filter by company (session) ID
  if (companyId) {
    where.companyId = companyId;
  }

  // Filter by user ID (through the company relation)
  if (userId) {
    where.company = {
      ...(where.company || {}),
      userId: userId,
    };
  }

  // Apply organization scoping based on caller's role
  if (callerUser && callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      // Company admins see saved prompts from their organization
      where.company = {
        ...(where.company || {}),
        user: { organizationId: callerUser.organizationId },
      };
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      // Department admins see saved prompts from their department
      where.company = {
        ...(where.company || {}),
        user: {
          organizationId: callerUser.organizationId,
          departmentId: callerUser.departmentId,
        },
      };
    } else {
      // Regular users see nothing
      where.id = 'impossible-id-no-access';
    }
  }

  if (search) {
    where.OR = [
      { deliverableName: { contains: search, mode: 'insensitive' } },
      { columnName: { contains: search, mode: 'insensitive' } },
      { overview: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [prompts, total] = await Promise.all([
    prisma.savedPrompt.findMany({
      where,
      orderBy,
      take: parseInt(limit),
      skip,
      include: {
        company: {
          select: {
            id: true,
            jobTitle: true,
            industry: true,
            createdBy: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.savedPrompt.count({ where }),
  ]);

  return {
    data: prompts.map(prompt => ({
      id: prompt.id,
      deliverable_name: prompt.deliverableName,
      deliverable_type: prompt.deliverableType,
      column_name: prompt.columnName,
      overview: prompt.overview,
      prompts: prompt.prompts,
      company_id: prompt.companyId,
      created_at: prompt.createdAt.toISOString(),
      company: prompt.company ? {
        id: prompt.company.id,
        job_title: prompt.company.jobTitle,
        industry: prompt.company.industry,
        created_by: prompt.company.createdBy,
        user: prompt.company.user,
      } : null,
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSavedPromptStats(callerUser = null) {
  // Build organization scope for saved prompts (through company -> user)
  let where = {};

  if (callerUser && callerUser.role !== 'SUPER_ADMIN') {
    if (['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      where.company = { user: { organizationId: callerUser.organizationId } };
    } else if (callerUser.role === 'DEPARTMENT_ADMIN') {
      where.company = {
        user: {
          organizationId: callerUser.organizationId,
          departmentId: callerUser.departmentId,
        },
      };
    } else {
      // Regular users see nothing
      where.id = 'impossible-id-no-access';
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    byType,
    recentCount,
    customCount,
  ] = await Promise.all([
    prisma.savedPrompt.count({ where }),
    prisma.savedPrompt.groupBy({
      by: ['deliverableType'],
      where,
      _count: true,
    }),
    prisma.savedPrompt.count({
      where: {
        ...where,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.savedPrompt.count({
      where: {
        ...where,
        isCustom: true,
      },
    }),
  ]);

  return {
    total,
    recentCount,
    customCount,
    byType: byType.reduce((acc, item) => {
      acc[item.deliverableType] = item._count;
      return acc;
    }, {}),
  };
}

function formatCompanyResponse(company) {
  return {
    id: company.id,
    job_title: company.jobTitle,
    industry: company.industry,
    company_size: company.companySize,
    company_url: company.companyUrl,
    productivity_matrix: company.productivityMatrix,
    performance_matrix: company.performanceMatrix,
    created_by: company.createdBy,
    created_date: company.createdAt.toISOString(),
    updated_at: company.updatedAt.toISOString(),
  };
}

// ============ User Management Functions ============

export async function updateUserRole(userId, newRole, callerUser) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if caller can manage this user
  const sameOrg = callerUser.role === 'SUPER_ADMIN' ||
                  user.organizationId === callerUser.organizationId;
  const sameDept = callerUser.role === 'SUPER_ADMIN' ||
                   ['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role) ||
                   user.departmentId === callerUser.departmentId;

  if (!canManageUser(callerUser.role, user.role, sameOrg, sameDept)) {
    throw new AppError('Cannot manage this user', 403);
  }

  // Check if caller can assign the new role
  if (!canManageUser(callerUser.role, newRole, true, true)) {
    throw new AppError('Cannot assign this role', 403);
  }

  // Validate role
  const validRoles = ['USER', 'DEPARTMENT_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(newRole)) {
    throw new AppError('Invalid role', 400);
  }

  // Only super admin can create super admins
  if (newRole === 'SUPER_ADMIN' && callerUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only super admins can create super admins', 403);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      departmentId: true,
    },
  });

  return updated;
}

export async function assignUserToOrganization(userId, organizationId, callerUser) {
  // Only super admin can assign users to organizations
  if (callerUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only super admins can assign users to organizations', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify organization exists if not null
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      organizationId,
      // Clear department if org changes
      departmentId: organizationId !== user.organizationId ? null : user.departmentId,
    },
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    organization: updated.organization,
    department: updated.department,
  };
}

export async function assignUserToDepartment(userId, departmentId, callerUser) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check permissions
  if (callerUser.role !== 'SUPER_ADMIN') {
    if (!['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role)) {
      throw new AppError('Only company admins can assign users to departments', 403);
    }
    if (user.organizationId !== callerUser.organizationId) {
      throw new AppError('Cannot manage users in other organizations', 403);
    }
  }

  // Verify department exists and is in the same org if not null
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new AppError('Department not found', 404);
    }
    if (dept.organizationId !== user.organizationId) {
      throw new AppError('Department must be in the same organization as the user', 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { departmentId },
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    organization: updated.organization,
    department: updated.department,
  };
}

export async function inviteUser(data, callerUser) {
  let { name, email, password, jobTitle, organizationId, departmentId, role } = data;

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new AppError('User with this email already exists', 400);
  }

  // Validate role assignment permissions
  if (role === 'SUPER_ADMIN' && callerUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only super admins can invite super admins', 403);
  }

  if (['COMPANY_ADMIN', 'ADMIN'].includes(role) && callerUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only super admins can invite company admins', 403);
  }

  // Department admins can only invite regular users
  if (callerUser.role === 'DEPARTMENT_ADMIN' && role && role !== 'USER') {
    throw new AppError('Department admins can only invite regular users', 403);
  }

  // Check organization access
  if (callerUser.role !== 'SUPER_ADMIN') {
    if (organizationId && organizationId !== callerUser.organizationId) {
      throw new AppError('Cannot invite users to other organizations', 403);
    }
    organizationId = callerUser.organizationId;
  }

  // Verify organization exists
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }
  }

  // Verify department exists and is in the org
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      throw new AppError('Department not found', 404);
    }
    if (organizationId && dept.organizationId !== organizationId) {
      throw new AppError('Department must be in the specified organization', 400);
    }
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create the user WITH password (admin sets it directly)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: trimmedName,
      passwordHash,
      jobTitle: jobTitle?.trim() || null,
      role: role || 'USER',
      organizationId,
      departmentId,
      isPermanent: true, // Invited users are permanent
    },
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  // Send invite email so the user knows they have an account
  try {
    const { createInviteToken } = await import('./auth.service.js');
    await createInviteToken(user.id);
  } catch (emailErr) {
    console.error('Failed to send invite email (user was still created):', emailErr);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: user.jobTitle,
    role: user.role,
    organization: user.organization,
    department: user.department,
    createdAt: user.createdAt,
  };
}

export async function resetUserPassword(userId, newPassword, callerUser) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  console.log(`Password reset for ${user.email} by ${callerUser.email}`);
  return { success: true, email: user.email };
}

// ============ User Edit/Delete/Status Functions ============

export async function updateUser(userId, data, callerUser) {
  const { name, email, jobTitle } = data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if caller can manage this user
  const sameOrg = callerUser.role === 'SUPER_ADMIN' ||
                  user.organizationId === callerUser.organizationId;
  const sameDept = callerUser.role === 'SUPER_ADMIN' ||
                   ['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role) ||
                   user.departmentId === callerUser.departmentId;

  if (!canManageUser(callerUser.role, user.role, sameOrg, sameDept)) {
    throw new AppError('Cannot manage this user', 403);
  }

  // If email is being changed, check it's not already in use
  if (email && email.toLowerCase().trim() !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(email !== undefined && { email: email.toLowerCase().trim() }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle?.trim() || null }),
    },
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    jobTitle: updated.jobTitle,
    role: updated.role,
    isActive: updated.isActive,
    organization: updated.organization,
    department: updated.department,
  };
}

export async function deleteUser(userId, callerUser) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent self-deletion
  if (userId === callerUser.id) {
    throw new AppError('Cannot delete your own account', 400);
  }

  // Check if caller can manage this user
  const sameOrg = callerUser.role === 'SUPER_ADMIN' ||
                  user.organizationId === callerUser.organizationId;
  const sameDept = callerUser.role === 'SUPER_ADMIN' ||
                   ['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role) ||
                   user.departmentId === callerUser.departmentId;

  if (!canManageUser(callerUser.role, user.role, sameOrg, sameDept)) {
    throw new AppError('Cannot manage this user', 403);
  }

  // Delete user (cascades to sessions, companies, etc.)
  await prisma.user.delete({
    where: { id: userId },
  });

  return { success: true };
}

export async function toggleUserActive(userId, isActive, callerUser) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent self-deactivation
  if (userId === callerUser.id && !isActive) {
    throw new AppError('Cannot deactivate your own account', 400);
  }

  // Check if caller can manage this user
  const sameOrg = callerUser.role === 'SUPER_ADMIN' ||
                  user.organizationId === callerUser.organizationId;
  const sameDept = callerUser.role === 'SUPER_ADMIN' ||
                   ['COMPANY_ADMIN', 'ADMIN'].includes(callerUser.role) ||
                   user.departmentId === callerUser.departmentId;

  if (!canManageUser(callerUser.role, user.role, sameOrg, sameDept)) {
    throw new AppError('Cannot manage this user', 403);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  // If deactivating, also delete their sessions to log them out
  if (!isActive) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isActive: updated.isActive,
    organization: updated.organization,
    department: updated.department,
  };
}
