import prisma from '../db.js';

export async function listUsers(query = {}) {
  const { search, page = 1, limit = 20, sort = '-createdAt' } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

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
      job_title: user.jobTitle,
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

export async function getUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      companies: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: { companies: true },
      },
    },
  });

  if (!user) {
    return null;
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
    companiesCount: user._count.companies,
    companies: user.companies.map(formatCompanyResponse),
  };
}

export async function listAllCompanies(query = {}) {
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

export async function getStats() {
  const [
    totalUsers,
    totalCompanies,
    recentUsers,
    recentCompanies,
    usersByRole,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    }),
    prisma.company.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.user.groupBy({
      by: ['role'],
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
