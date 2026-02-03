import prisma from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listByUser(userId) {
  // Get all prompts for all companies owned by the user
  const prompts = await prisma.savedPrompt.findMany({
    where: {
      company: {
        userId,
      },
    },
    include: {
      company: {
        select: {
          id: true,
          jobTitle: true,
          industry: true,
          companySize: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return prompts.map(formatPromptResponse);
}

export async function listByCompany(userId, companyId) {
  // Verify ownership
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
  });

  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const prompts = await prisma.savedPrompt.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return prompts.map(formatPromptResponse);
}

export async function create(userId, companyId, data) {
  // Verify ownership
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
  });

  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const {
    deliverable_name,
    deliverableName,
    deliverable_type,
    deliverableType,
    column_name,
    columnName,
    overview,
    prompts,
  } = data;

  const prompt = await prisma.savedPrompt.create({
    data: {
      deliverableName: deliverable_name || deliverableName,
      deliverableType: deliverable_type || deliverableType,
      columnName: column_name || columnName,
      overview,
      prompts,
      companyId,
    },
    include: {
      company: {
        select: {
          id: true,
          jobTitle: true,
          industry: true,
          companySize: true,
        },
      },
    },
  });

  return formatPromptResponse(prompt);
}

export async function deletePrompt(userId, promptId) {
  // Verify ownership via company
  const prompt = await prisma.savedPrompt.findFirst({
    where: { id: promptId },
    include: {
      company: {
        select: { userId: true },
      },
    },
  });

  if (!prompt) {
    throw new AppError('Prompt not found', 404);
  }

  if (prompt.company.userId !== userId) {
    throw new AppError('Prompt not found', 404);
  }

  await prisma.savedPrompt.delete({
    where: { id: promptId },
  });

  return { success: true };
}

function formatPromptResponse(prompt) {
  const response = {
    id: prompt.id,
    deliverable_name: prompt.deliverableName,
    deliverable_type: prompt.deliverableType,
    column_name: prompt.columnName,
    overview: prompt.overview,
    prompts: prompt.prompts,
    company_id: prompt.companyId,
    created_at: prompt.createdAt.toISOString(),
  };

  // Include company info if available
  if (prompt.company) {
    response.company = {
      id: prompt.company.id,
      job_title: prompt.company.jobTitle,
      industry: prompt.company.industry,
      company_size: prompt.company.companySize,
    };
  }

  return response;
}
