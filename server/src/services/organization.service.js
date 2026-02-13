import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { hashPassword } from './auth.service.js';

// Generate URL-friendly slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Ensure slug is unique by appending number if needed
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!existing || existing.id === excludeId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function createOrganization(data) {
  const { name, url, industry, companySize, website, admin } = data;

  if (!name?.trim()) {
    throw new AppError('Organization name is required', 400);
  }

  // Validate admin data if provided
  if (admin) {
    if (!admin.name?.trim()) {
      throw new AppError('Admin name is required', 400);
    }
    if (!admin.email?.trim()) {
      throw new AppError('Admin email is required', 400);
    }
    if (!admin.password || admin.password.length < 8) {
      throw new AppError('Admin password must be at least 8 characters', 400);
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email.trim().toLowerCase() },
    });
    if (existingUser) {
      throw new AppError('A user with this email already exists', 400);
    }
  }

  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);

  // Use transaction to create organization and admin together
  const result = await prisma.$transaction(async (tx) => {
    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: name.trim(),
        slug,
        industry: industry?.trim() || null,
        companySize: companySize || null,
        website: website?.trim() || null,
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
          role: 'COMPANY_ADMIN',
          isPermanent: true,
          organizationId: organization.id,
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

    // Get counts
    const orgWithCounts = await tx.organization.findUnique({
      where: { id: organization.id },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            companies: true,
          },
        },
      },
    });

    return { organization: orgWithCounts, admin: adminUser };
  });

  return {
    ...formatOrganizationResponse(result.organization),
    admin: result.admin,
  };
}

export async function listOrganizations(query = {}) {
  const { search, page = 1, limit = 20, sort = '-createdAt' } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy,
      take: parseInt(limit),
      skip,
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            companies: true,
          },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    data: organizations.map(formatOrganizationResponse),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getOrganization(id) {
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      departments: {
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { users: true },
          },
        },
      },
      _count: {
        select: {
          users: true,
          departments: true,
          companies: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  return {
    ...formatOrganizationResponse(organization),
    departments: organization.departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      createdAt: dept.createdAt,
      usersCount: dept._count.users,
    })),
  };
}

export async function updateOrganization(id, data) {
  const { name, industry, companySize, website } = data;

  const existing = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Organization not found', 404);
  }

  const updateData = {};

  if (name?.trim()) {
    updateData.name = name.trim();
    // Update slug if name changed
    const baseSlug = generateSlug(name);
    updateData.slug = await ensureUniqueSlug(baseSlug, id);
  }

  // Handle optional fields - allow setting to null or updating
  if (industry !== undefined) {
    updateData.industry = industry?.trim() || null;
  }
  if (companySize !== undefined) {
    updateData.companySize = companySize || null;
  }
  if (website !== undefined) {
    updateData.website = website?.trim() || null;
  }

  const organization = await prisma.organization.update({
    where: { id },
    data: updateData,
    include: {
      _count: {
        select: {
          users: true,
          departments: true,
          companies: true,
        },
      },
    },
  });

  return formatOrganizationResponse(organization);
}

export async function deleteOrganization(id) {
  const existing = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  if (!existing) {
    throw new AppError('Organization not found', 404);
  }

  if (existing._count.users > 0) {
    throw new AppError('Cannot delete organization with users. Reassign users first.', 400);
  }

  await prisma.organization.delete({
    where: { id },
  });

  return { success: true };
}

export async function listOrganizationUsers(organizationId, query = {}) {
  const { search, page = 1, limit = 20, sort = '-createdAt', role } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = { organizationId };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
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
        department: {
          select: {
            id: true,
            name: true,
          },
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
      jobTitle: user.jobTitle,
      role: user.role,
      isPermanent: user.isPermanent,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
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

export async function toggleOrganizationActive(id, isActive) {
  const existing = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Organization not found', 404);
  }

  // Use transaction to update organization and all its users
  const result = await prisma.$transaction(async (tx) => {
    // Update organization status
    const organization = await tx.organization.update({
      where: { id },
      data: { isActive },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            companies: true,
          },
        },
      },
    });

    // Update all users in this organization to match the org status
    await tx.user.updateMany({
      where: { organizationId: id },
      data: { isActive },
    });

    // If deactivating, delete all sessions for users in this organization
    if (!isActive) {
      await tx.session.deleteMany({
        where: {
          user: {
            organizationId: id,
          },
        },
      });
    }

    return organization;
  });

  return formatOrganizationResponse(result);
}

function formatOrganizationResponse(org) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry,
    companySize: org.companySize,
    website: org.website,
    isActive: org.isActive,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    usersCount: org._count?.users || 0,
    departmentsCount: org._count?.departments || 0,
    companiesCount: org._count?.companies || 0,
  };
}
