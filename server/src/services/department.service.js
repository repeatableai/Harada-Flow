import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { hashPassword } from './auth.service.js';

export async function createDepartment(organizationId, data) {
  const { name, admin } = data;

  if (!name?.trim()) {
    throw new AppError('Department name is required', 400);
  }

  // Verify organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  // Check for duplicate name in org
  const existing = await prisma.department.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name: name.trim(),
      },
    },
  });

  if (existing) {
    throw new AppError('A department with this name already exists in this organization', 400);
  }

  // Validate admin data if provided
  if (admin) {
    if (!admin.name?.trim()) {
      throw new AppError('Department Admin name is required', 400);
    }
    if (!admin.email?.trim()) {
      throw new AppError('Department Admin email is required', 400);
    }
    if (!admin.password || admin.password.length < 8) {
      throw new AppError('Department Admin password must be at least 8 characters', 400);
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email.trim().toLowerCase() },
    });
    if (existingUser) {
      throw new AppError('A user with this email already exists', 400);
    }
  }

  // Use transaction to create department and admin together
  const result = await prisma.$transaction(async (tx) => {
    // Create department
    const department = await tx.department.create({
      data: {
        name: name.trim(),
        organizationId,
      },
    });

    // Create admin user if provided
    let adminUser = null;
    if (admin) {
      const passwordHash = await hashPassword(admin.password);
      adminUser = await tx.user.create({
        data: {
          email: admin.email.trim().toLowerCase(),
          name: admin.name.trim(),
          passwordHash,
          jobTitle: admin.jobTitle?.trim() || null,
          role: 'DEPARTMENT_ADMIN',
          isPermanent: true,
          organizationId,
          departmentId: department.id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          jobTitle: true,
          role: true,
        },
      });
    }

    // Get department with counts
    const deptWithCounts = await tx.department.findUnique({
      where: { id: department.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    return { department: deptWithCounts, admin: adminUser };
  });

  return {
    ...formatDepartmentResponse(result.department),
    admin: result.admin,
  };
}

export async function listDepartments(organizationId, query = {}) {
  const { search, page = 1, limit = 20, sort = 'name' } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = { organizationId };

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      where,
      orderBy,
      take: parseInt(limit),
      skip,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    }),
    prisma.department.count({ where }),
  ]);

  return {
    data: departments.map(formatDepartmentResponse),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDepartment(id) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  if (!department) {
    return null;
  }

  return formatDepartmentResponse(department);
}

export async function updateDepartment(id, data) {
  const { name } = data;

  const existing = await prisma.department.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Department not found', 404);
  }

  if (name?.trim()) {
    // Check for duplicate name in org (excluding this dept)
    const duplicate = await prisma.department.findFirst({
      where: {
        organizationId: existing.organizationId,
        name: name.trim(),
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new AppError('A department with this name already exists in this organization', 400);
    }
  }

  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  return formatDepartmentResponse(department);
}

export async function deleteDepartment(id) {
  const existing = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  if (!existing) {
    throw new AppError('Department not found', 404);
  }

  if (existing._count.users > 0) {
    throw new AppError('Cannot delete department with users. Reassign users first.', 400);
  }

  await prisma.department.delete({
    where: { id },
  });

  return { success: true };
}

export async function listDepartmentUsers(departmentId, query = {}) {
  const { search, page = 1, limit = 20, sort = '-createdAt' } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = { departmentId };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
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
        createdAt: true,
        lastLoginAt: true,
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
      jobTitle: user.jobTitle,
      role: user.role,
      isPermanent: user.isPermanent,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
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

function formatDepartmentResponse(dept) {
  return {
    id: dept.id,
    name: dept.name,
    organizationId: dept.organizationId,
    organization: dept.organization,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    usersCount: dept._count?.users || 0,
  };
}
