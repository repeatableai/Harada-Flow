import prisma from '../db.js';

/**
 * Dynamic baseline estimates for manual task completion (in minutes)
 *
 * Sources:
 * - ATD Training Development: 38-43 hrs to develop 1 hr of training content
 *   https://www.td.org/content/atd-blog/how-long-does-it-take-to-develop-training-new-question-new-answers
 * - Technical Writing Standards: 3-7 hrs per page (TechScribe, Indoition)
 *   https://www.techscribe.co.uk/techw/documentation-project-metrics.htm
 * - McKinsey Knowledge Work: 20-28% of workweek spent on info gathering
 *   https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/rethinking-knowledge-work-a-strategic-approach
 *
 * Calculation Model:
 * baselineMinutes = (baseTimePerDeliverable × numberOfDeliverables) × industryMultiplier × sizeMultiplier × complexityMultiplier
 */

// Base time per item (in minutes) - research-backed
const BASE_TIME_PER_ITEM = {
  productivity_matrix: 6.3,    // Per deliverable (405 min ÷ 64)
  performance_matrix: 11.25,   // Per strategy (720 min ÷ 64)
  deliverable_prompts: 33,     // Per prompt (230 min ÷ 7)
};

// Number of items generated per operation
const ITEMS_PER_OPERATION = {
  productivity_matrix: 64,     // 8 columns × 8 deliverables
  performance_matrix: 64,      // 8 columns × 8 strategies
  deliverable_prompts: 7,      // 7-step DCE workflow
};

// Industry categories with keyword matching
const INDUSTRY_CATEGORIES = {
  highly_regulated: {
    multiplier: 1.40,
    keywords: ['healthcare', 'medical', 'hospital', 'pharmaceutical', 'biotech', 'clinical', 'patient'],
  },
  regulated: {
    multiplier: 1.30,
    keywords: ['finance', 'banking', 'bank', 'insurance', 'legal', 'law', 'government', 'federal', 'state'],
  },
  moderately_regulated: {
    multiplier: 1.15,
    keywords: ['manufacturing', 'energy', 'utilities', 'aerospace', 'defense', 'construction', 'automotive'],
  },
  standard: {
    multiplier: 1.00,
    keywords: ['technology', 'software', 'saas', 'consulting', 'professional', 'services', 'media'],
  },
  simple: {
    multiplier: 0.90,
    keywords: ['retail', 'hospitality', 'food', 'restaurant', 'entertainment', 'ecommerce'],
  },
};

// Company size multipliers
const SIZE_MULTIPLIERS = {
  startup: 0.90,
  small: 0.95,
  medium: 1.00,
  large: 1.10,
  enterprise: 1.20,
};

// Complexity keywords and their multipliers
const COMPLEXITY_KEYWORDS = {
  compliance: {
    keywords: ['compliance', 'audit', 'regulatory', 'policy', 'governance', 'hipaa', 'sox', 'gdpr'],
    multiplier: 1.30,
  },
  technical: {
    keywords: ['technical', 'architecture', 'system', 'integration', 'security', 'infrastructure', 'api'],
    multiplier: 1.20,
  },
  financial: {
    keywords: ['budget', 'forecast', 'financial', 'revenue', 'cost', 'pricing', 'roi'],
    multiplier: 1.15,
  },
  strategic: {
    keywords: ['strategy', 'roadmap', 'initiative', 'transformation', 'planning'],
    multiplier: 1.10,
  },
};

/**
 * Get industry multiplier based on keyword matching
 */
function getIndustryMultiplier(industry) {
  if (!industry) return 1.0;
  const lower = industry.toLowerCase();

  for (const category of Object.values(INDUSTRY_CATEGORIES)) {
    if (category.keywords.some(kw => lower.includes(kw))) {
      return category.multiplier;
    }
  }
  return 1.0; // Default for unknown industries
}

/**
 * Normalize company size to a standard key
 */
function normalizeSize(size) {
  if (!size) return 'medium';
  const lower = size.toLowerCase();
  if (lower.includes('startup')) return 'startup';
  if (lower.includes('small')) return 'small';
  if (lower.includes('large')) return 'large';
  if (lower.includes('enterprise')) return 'enterprise';
  return 'medium';
}

/**
 * Detect complexity from deliverable name keywords
 */
function detectComplexity(deliverableName) {
  if (!deliverableName) return 1.0;
  const lower = deliverableName.toLowerCase();

  for (const category of Object.values(COMPLEXITY_KEYWORDS)) {
    if (category.keywords.some(kw => lower.includes(kw))) {
      return category.multiplier;
    }
  }
  return 1.0;
}

/**
 * Calculate dynamic baseline estimate
 */
export function getBaselineEstimate(operationType, { industry, companySize, deliverableName } = {}) {
  const baseTime = BASE_TIME_PER_ITEM[operationType];
  const itemCount = ITEMS_PER_OPERATION[operationType];

  if (!baseTime || !itemCount) {
    return 120; // Default 2 hours for unknown operation types
  }

  // Get multipliers
  const industryMultiplier = getIndustryMultiplier(industry);
  const sizeKey = normalizeSize(companySize);
  const sizeMultiplier = SIZE_MULTIPLIERS[sizeKey] || 1.0;
  const complexityMultiplier = detectComplexity(deliverableName);

  // Calculate final baseline
  const baseline = baseTime * itemCount * industryMultiplier * sizeMultiplier * complexityMultiplier;

  return Math.round(baseline);
}

/**
 * Create a new time study record
 */
export async function createTimeStudy({
  operationType,
  operationName,
  actualMinutes,
  companyId,
  userId,
  // Dynamic baseline parameters
  industry,
  companySize,
  deliverableName,
}) {
  const baselineManualMinutes = getBaselineEstimate(operationType, {
    industry,
    companySize,
    deliverableName,
  });
  const minutesSaved = baselineManualMinutes - actualMinutes;
  const percentReduction = baselineManualMinutes > 0
    ? ((minutesSaved / baselineManualMinutes) * 100)
    : 0;

  const timeStudy = await prisma.timeStudy.create({
    data: {
      operationType,
      operationName,
      baselineManualMinutes,
      actualMinutes,
      minutesSaved,
      percentReduction,
      companyId,
      userId,
    },
  });

  return formatTimeStudyResponse(timeStudy);
}

/**
 * List time studies with pagination and filtering
 */
export async function listTimeStudies(query = {}) {
  const {
    userId,
    companyId,
    operationType,
    page = 1,
    limit = 20,
    sort = '-createdAt'
  } = query;

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const skip = (page - 1) * limit;

  const where = {};
  if (userId) where.userId = userId;
  if (companyId) where.companyId = companyId;
  if (operationType) where.operationType = operationType;

  const [timeStudies, total] = await Promise.all([
    prisma.timeStudy.findMany({
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
        company: {
          select: {
            id: true,
            jobTitle: true,
            industry: true,
          },
        },
      },
    }),
    prisma.timeStudy.count({ where }),
  ]);

  return {
    data: timeStudies.map(ts => ({
      ...formatTimeStudyResponse(ts),
      user: ts.user,
      company: {
        id: ts.company.id,
        job_title: ts.company.jobTitle,
        industry: ts.company.industry,
      },
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get aggregate statistics for time studies
 */
export async function getTimeStudyStats(query = {}) {
  const { userId, companyId } = query;

  const where = {};
  if (userId) where.userId = userId;
  if (companyId) where.companyId = companyId;

  const [
    aggregates,
    thisWeekCount,
    byOperationType,
  ] = await Promise.all([
    prisma.timeStudy.aggregate({
      where,
      _sum: {
        minutesSaved: true,
        actualMinutes: true,
        baselineManualMinutes: true,
      },
      _avg: {
        percentReduction: true,
      },
      _count: true,
    }),
    prisma.timeStudy.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.timeStudy.groupBy({
      by: ['operationType'],
      where,
      _sum: {
        minutesSaved: true,
      },
      _count: true,
    }),
  ]);

  return {
    totalTimeSavedMinutes: aggregates._sum.minutesSaved || 0,
    totalTimeSavedHours: ((aggregates._sum.minutesSaved || 0) / 60).toFixed(1),
    averagePercentReduction: (aggregates._avg.percentReduction || 0).toFixed(1),
    totalOperations: aggregates._count || 0,
    operationsThisWeek: thisWeekCount,
    byOperationType: byOperationType.reduce((acc, item) => {
      acc[item.operationType] = {
        count: item._count,
        minutesSaved: item._sum.minutesSaved || 0,
      };
      return acc;
    }, {}),
  };
}

function formatTimeStudyResponse(timeStudy) {
  return {
    id: timeStudy.id,
    operationType: timeStudy.operationType,
    operationName: timeStudy.operationName,
    baselineManualMinutes: timeStudy.baselineManualMinutes,
    actualMinutes: timeStudy.actualMinutes,
    minutesSaved: timeStudy.minutesSaved,
    percentReduction: timeStudy.percentReduction,
    companyId: timeStudy.companyId,
    userId: timeStudy.userId,
    createdAt: timeStudy.createdAt?.toISOString(),
  };
}
