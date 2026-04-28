import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listCompanies(userId, query = {}) {
  const { sort = '-createdAt', limit = 50, page = 1 } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where: { userId },
      orderBy,
      take: parseInt(limit),
      skip,
    }),
    prisma.company.count({ where: { userId } }),
  ]);

  return {
    data: companies.map(formatCompanyResponse),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getLatestCompany(userId) {
  const company = await prisma.company.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return company ? formatCompanyResponse(company) : null;
}

export async function filterCompanies(userId, filter = {}, sort = '-createdAt', limit = 1) {
  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1) === 'created_date' ? 'createdAt' : sort.slice(1)]: 'desc' }
    : { [sort === 'created_date' ? 'createdAt' : sort]: 'asc' };

  const where = { userId };

  // Handle created_by filter for backwards compatibility
  if (filter.created_by) {
    where.createdBy = filter.created_by;
  }

  const companies = await prisma.company.findMany({
    where,
    orderBy,
    take: parseInt(limit),
  });

  return companies.map(formatCompanyResponse);
}

export async function getCompany(userId, companyId) {
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId,
    },
  });

  if (!company) {
    throw new AppError('Company not found', 404);
  }

  return formatCompanyResponse(company);
}

export async function createCompany(userId, userEmail, data) {
  const {
    job_title,
    jobTitle,
    industry,
    company_size,
    companySize,
    company_url,
    companyUrl,
  } = data;

  const company = await prisma.company.create({
    data: {
      jobTitle: job_title || jobTitle,
      industry,
      companySize: company_size || companySize,
      companyUrl: company_url || companyUrl,
      userId,
      createdBy: userEmail,
    },
  });

  return formatCompanyResponse(company);
}

export async function updateCompany(userId, companyId, data) {
  // Verify ownership
  const existing = await prisma.company.findFirst({
    where: { id: companyId, userId },
  });

  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  const {
    job_title,
    jobTitle,
    industry,
    company_size,
    companySize,
    company_url,
    companyUrl,
    productivity_matrix,
    productivityMatrix,
    performance_matrix,
    performanceMatrix,
  } = data;

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(job_title !== undefined || jobTitle !== undefined) && {
        jobTitle: job_title || jobTitle,
      },
      ...(industry !== undefined && { industry }),
      ...(company_size !== undefined || companySize !== undefined) && {
        companySize: company_size || companySize,
      },
      ...(company_url !== undefined || companyUrl !== undefined) && {
        companyUrl: company_url || companyUrl,
      },
      ...(productivity_matrix !== undefined || productivityMatrix !== undefined) && {
        productivityMatrix: productivity_matrix || productivityMatrix,
      },
      ...(performance_matrix !== undefined || performanceMatrix !== undefined) && {
        performanceMatrix: performance_matrix || performanceMatrix,
      },
    },
  });

  return formatCompanyResponse(company);
}

export async function deleteCompany(userId, companyId) {
  // Verify ownership
  const existing = await prisma.company.findFirst({
    where: { id: companyId, userId },
  });

  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  await prisma.company.delete({
    where: { id: companyId },
  });

  return { success: true };
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
    dossier_status: company.dossierStatus,
    dossier_filename: company.dossierFilename,
    dossier_content: company.dossierContent,
    session_mode_override: company.sessionModeOverride,
    created_by: company.createdBy,
    created_date: company.createdAt.toISOString(),
    updated_at: company.updatedAt.toISOString(),
  };
}
