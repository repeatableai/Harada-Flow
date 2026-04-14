import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = express.Router();

// Seed endpoint is disabled in production - export empty router
if (process.env.NODE_ENV === 'production') {
  // No routes registered - all requests to /api/seed/* return 404
  console.log('Seed routes disabled in production');
}

const prisma = process.env.NODE_ENV !== 'production' ? new PrismaClient() : null;
const SALT_ROUNDS = 12;

// One-time secret key for seeding (only used in development)
const SEED_SECRET = process.env.SEED_SECRET || 'harada-seed-2024';

// Helper function to generate dates in the past
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// Sample productivity matrix structure
const generateProductivityMatrix = (jobTitle, industry) => ({
  columns: [
    'Strategic Planning',
    'Financial Analysis',
    'Process Improvement',
    'Team Leadership',
    'Stakeholder Management',
    'Compliance & Risk',
    'Technology Integration',
    'Performance Metrics'
  ].map((col) => ({
    name: col,
    items: Array(8).fill(null).map((_, i) => `${col} Deliverable ${i + 1}`)
  }))
});

// Sample performance matrix structure
const generatePerformanceMatrix = () => ({
  kpis: [
    {
      name: 'Revenue Growth',
      target: '15% YoY',
      strategies: ['Expand market share', 'Launch new products', 'Improve customer retention']
    },
    {
      name: 'Cost Reduction',
      target: '10% operational savings',
      strategies: ['Process automation', 'Vendor negotiation', 'Resource optimization']
    },
    {
      name: 'Customer Satisfaction',
      target: 'NPS > 50',
      strategies: ['Improve service quality', 'Faster response times', 'Personalization']
    },
    {
      name: 'Employee Engagement',
      target: '85% satisfaction',
      strategies: ['Career development', 'Recognition programs', 'Work-life balance']
    },
    {
      name: 'Time to Market',
      target: '25% faster launches',
      strategies: ['Agile methodology', 'Cross-functional collaboration', 'Rapid prototyping']
    },
    {
      name: 'Quality Metrics',
      target: '<2% defect rate',
      strategies: ['Quality assurance protocols', 'Continuous testing', 'Feedback loops']
    },
    {
      name: 'Innovation Index',
      target: '3 new initiatives/quarter',
      strategies: ['R&D investment', 'Innovation workshops', 'Partnership development']
    },
    {
      name: 'Market Share',
      target: '20% market presence',
      strategies: ['Competitive analysis', 'Brand positioning', 'Strategic partnerships']
    }
  ]
});

// Organizations with realistic business data
const organizations = [
  {
    name: 'TechCorp Global',
    slug: 'techcorp-global',
    industry: 'Technology',
    companySize: 'enterprise',
    website: 'https://techcorp-global.example.com',
    departments: ['Engineering', 'Product Management', 'Sales & Marketing', 'Finance & Operations', 'Human Resources', 'Customer Success']
  },
  {
    name: 'FinServe Solutions',
    slug: 'finserve-solutions',
    industry: 'Financial Services',
    companySize: 'large',
    website: 'https://finserve.example.com',
    departments: ['Investment Banking', 'Risk Management', 'Compliance', 'Corporate Finance', 'IT & Security']
  },
  {
    name: 'HealthTech Innovations',
    slug: 'healthtech-innovations',
    industry: 'Healthcare',
    companySize: 'medium',
    website: 'https://healthtech-innovations.example.com',
    departments: ['Clinical Operations', 'Research & Development', 'Regulatory Affairs', 'Business Development', 'Quality Assurance']
  },
  {
    name: 'RetailPro Enterprise',
    slug: 'retailpro-enterprise',
    industry: 'Retail',
    companySize: 'large',
    website: 'https://retailpro.example.com',
    departments: ['Store Operations', 'Merchandising', 'Supply Chain', 'Digital Commerce', 'Marketing']
  },
  {
    name: 'StartupX',
    slug: 'startupx',
    industry: 'SaaS',
    companySize: 'startup',
    website: 'https://startupx.example.com',
    departments: ['Engineering', 'Growth', 'Customer Success']
  }
];

// Job titles mapped to departments
const jobTitlesByDepartment = {
  'Engineering': ['VP Engineering', 'Engineering Manager', 'Senior Software Engineer', 'DevOps Lead'],
  'Product Management': ['Chief Product Officer', 'Senior Product Manager', 'Product Analyst'],
  'Sales & Marketing': ['CMO', 'VP Sales', 'Marketing Director', 'Sales Manager'],
  'Finance & Operations': ['CFO', 'Corporate Controller', 'Finance Manager', 'Operations Director'],
  'Human Resources': ['CHRO', 'VP People Operations', 'Talent Acquisition Manager'],
  'Customer Success': ['VP Customer Success', 'Customer Success Manager', 'Support Lead'],
  'Investment Banking': ['Managing Director', 'VP Investment Banking', 'Financial Analyst'],
  'Risk Management': ['Chief Risk Officer', 'Risk Manager', 'Compliance Analyst'],
  'Compliance': ['Chief Compliance Officer', 'Compliance Manager'],
  'Corporate Finance': ['Corporate Controller', 'Senior Financial Analyst', 'FP&A Manager'],
  'IT & Security': ['CISO', 'IT Director', 'Security Engineer'],
  'Clinical Operations': ['VP Clinical Operations', 'Clinical Manager', 'Clinical Research Associate'],
  'Research & Development': ['VP R&D', 'Research Scientist', 'Innovation Manager'],
  'Regulatory Affairs': ['Regulatory Affairs Director', 'Regulatory Manager'],
  'Business Development': ['VP Business Development', 'BD Manager'],
  'Quality Assurance': ['QA Director', 'Quality Manager', 'QA Engineer'],
  'Store Operations': ['VP Store Operations', 'Regional Manager', 'Store Manager'],
  'Merchandising': ['Chief Merchandising Officer', 'Category Manager', 'Buyer'],
  'Supply Chain': ['VP Supply Chain', 'Logistics Manager', 'Procurement Manager'],
  'Digital Commerce': ['VP E-Commerce', 'Digital Marketing Manager', 'E-Commerce Manager'],
  'Marketing': ['VP Marketing', 'Brand Manager', 'Marketing Manager'],
  'Growth': ['VP Growth', 'Growth Manager', 'Growth Analyst'],
};

// Sample deliverable prompts
const samplePrompts = [
  { step: 1, title: 'Context & Background', description: 'Establish the foundation and context', prompt: 'What is the strategic context and business objectives for this deliverable?' },
  { step: 2, title: 'Stakeholder Analysis', description: 'Identify key stakeholders', prompt: 'Who are the primary stakeholders and what are their requirements?' },
  { step: 3, title: 'Data & Research', description: 'Gather necessary information', prompt: 'What data sources and research methods should be used?' },
  { step: 4, title: 'Framework & Methodology', description: 'Define the approach', prompt: 'What framework or methodology will guide this deliverable?' },
  { step: 5, title: 'Execution Plan', description: 'Create actionable steps', prompt: 'What are the specific steps and timeline for execution?' },
  { step: 6, title: 'Success Metrics', description: 'Define measurement criteria', prompt: 'How will success be measured and reported?' },
  { step: 7, title: 'Final Deliverable', description: 'Synthesize the complete output', prompt: 'Create the final comprehensive deliverable ready for stakeholder review.' }
];

/**
 * One-time seed endpoint (DISABLED IN PRODUCTION)
 * Call this endpoint once to populate development database
 * GET /api/seed/business-data?secret=YOUR_SECRET
 */
if (process.env.NODE_ENV !== 'production') {
router.get('/business-data', async (req, res) => {
  try {
    const { secret } = req.query;

    // Verify secret
    if (secret !== SEED_SECRET) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    const results = {
      organizations: 0,
      departments: 0,
      users: 0,
      sessions: 0,
      prompts: 0,
      timeStudies: 0,
      knowledgeFiles: 0,
      accessRequests: 0,
    };

    // Create super admin
    const superAdminHash = await bcrypt.hash('123456', SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: 'kevin@repeatable.ai' },
      update: { passwordHash: superAdminHash, role: 'SUPER_ADMIN', isPermanent: true },
      create: {
        email: 'kevin@repeatable.ai',
        passwordHash: superAdminHash,
        name: 'Kevin',
        role: 'SUPER_ADMIN',
        isPermanent: true,
      },
    });

    // Create organizations and departments
    const createdOrgs = [];
    for (const orgData of organizations) {
      const org = await prisma.organization.upsert({
        where: { slug: orgData.slug },
        update: { name: orgData.name, industry: orgData.industry, companySize: orgData.companySize, website: orgData.website },
        create: { name: orgData.name, slug: orgData.slug, industry: orgData.industry, companySize: orgData.companySize, website: orgData.website },
      });
      results.organizations++;

      const departments = [];
      for (const deptName of orgData.departments) {
        const dept = await prisma.department.upsert({
          where: { organizationId_name: { organizationId: org.id, name: deptName } },
          update: {},
          create: { name: deptName, organizationId: org.id },
        });
        departments.push(dept);
        results.departments++;
      }
      createdOrgs.push({ org, departments, config: orgData });
    }

    // Create demo admins for TechCorp
    const techCorp = createdOrgs[0];
    const engineeringDept = techCorp.departments[0];
    const demoHash = await bcrypt.hash('demo123', SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email: 'company-admin@demo.com' },
      update: { organizationId: techCorp.org.id, role: 'COMPANY_ADMIN', jobTitle: 'VP of Operations' },
      create: {
        email: 'company-admin@demo.com',
        passwordHash: demoHash,
        name: 'Company Admin Demo',
        role: 'COMPANY_ADMIN',
        organizationId: techCorp.org.id,
        jobTitle: 'VP of Operations',
        isPermanent: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'dept-admin@demo.com' },
      update: { organizationId: techCorp.org.id, departmentId: engineeringDept.id, role: 'DEPARTMENT_ADMIN' },
      create: {
        email: 'dept-admin@demo.com',
        passwordHash: demoHash,
        name: 'Department Admin Demo',
        role: 'DEPARTMENT_ADMIN',
        organizationId: techCorp.org.id,
        departmentId: engineeringDept.id,
        jobTitle: 'VP Engineering',
        isPermanent: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'user@demo.com' },
      update: { organizationId: techCorp.org.id, departmentId: engineeringDept.id },
      create: {
        email: 'user@demo.com',
        passwordHash: demoHash,
        name: 'User Demo',
        role: 'USER',
        organizationId: techCorp.org.id,
        departmentId: engineeringDept.id,
        jobTitle: 'Senior Software Engineer',
        isPermanent: true,
      },
    });

    // Create business users
    const allUsers = [];
    for (const { org, departments, config } of createdOrgs) {
      const companyAdminEmail = `admin@${config.slug}.example.com`;
      const companyAdmin = await prisma.user.upsert({
        where: { email: companyAdminEmail },
        update: { organizationId: org.id, role: 'COMPANY_ADMIN' },
        create: {
          email: companyAdminEmail,
          passwordHash: demoHash,
          name: `${org.name} Admin`,
          jobTitle: 'Chief Operating Officer',
          role: 'COMPANY_ADMIN',
          organizationId: org.id,
          isPermanent: true,
          lastLoginAt: daysAgo(Math.floor(Math.random() * 30)),
        },
      });
      allUsers.push(companyAdmin);
      results.users++;

      for (const dept of departments) {
        const deptAdminEmail = `${dept.name.toLowerCase().replace(/\s+/g, '-')}-admin@${config.slug}.example.com`;
        const deptAdmin = await prisma.user.upsert({
          where: { email: deptAdminEmail },
          update: { organizationId: org.id, departmentId: dept.id },
          create: {
            email: deptAdminEmail,
            passwordHash: demoHash,
            name: `${dept.name} Admin`,
            jobTitle: jobTitlesByDepartment[dept.name]?.[0] || 'Department Head',
            role: 'DEPARTMENT_ADMIN',
            organizationId: org.id,
            departmentId: dept.id,
            isPermanent: true,
            lastLoginAt: daysAgo(Math.floor(Math.random() * 14)),
          },
        });
        allUsers.push(deptAdmin);
        results.users++;

        const userCount = Math.floor(Math.random() * 3) + 2;
        const jobTitles = jobTitlesByDepartment[dept.name] || ['Manager', 'Analyst'];

        for (let i = 0; i < userCount; i++) {
          const userEmail = `${dept.name.toLowerCase().replace(/\s+/g, '-')}-user${i + 1}@${config.slug}.example.com`;
          const jobTitle = jobTitles[i % jobTitles.length] || 'Analyst';

          const user = await prisma.user.upsert({
            where: { email: userEmail },
            update: { organizationId: org.id, departmentId: dept.id },
            create: {
              email: userEmail,
              passwordHash: demoHash,
              name: `${jobTitle.split(' ').pop()} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][i % 5]}`,
              jobTitle,
              role: 'USER',
              organizationId: org.id,
              departmentId: dept.id,
              isPermanent: true,
              lastLoginAt: daysAgo(Math.floor(Math.random() * 7)),
            },
          });
          allUsers.push(user);
          results.users++;
        }
      }
    }

    // Create sessions
    const allCompanies = [];
    for (const user of allUsers) {
      if (user.role === 'SUPER_ADMIN') continue;

      const sessionCount = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < sessionCount; i++) {
        const daysOld = Math.floor(Math.random() * 60);
        const org = createdOrgs.find(o => o.org.id === user.organizationId);

        const company = await prisma.company.create({
          data: {
            jobTitle: user.jobTitle || 'Manager',
            industry: org?.config.industry || 'Technology',
            companySize: org?.config.companySize || 'medium',
            companyUrl: org?.config.website,
            productivityMatrix: generateProductivityMatrix(user.jobTitle, org?.config.industry),
            performanceMatrix: generatePerformanceMatrix(),
            userId: user.id,
            createdBy: user.email,
            organizationId: user.organizationId,
            createdAt: daysAgo(daysOld),
            updatedAt: daysAgo(Math.max(0, daysOld - Math.floor(Math.random() * 5))),
          },
        });
        allCompanies.push({ company, user, org: org?.config });
        results.sessions++;
      }
    }

    // Create saved prompts
    for (const { company, user, org } of allCompanies) {
      const promptCount = Math.floor(Math.random() * 6) + 3;
      const matrix = company.productivityMatrix;

      for (let i = 0; i < promptCount; i++) {
        const columnIdx = Math.floor(Math.random() * 8);
        const itemIdx = Math.floor(Math.random() * 8);
        const deliverableType = Math.random() > 0.4 ? 'productivity' : 'performance';

        const column = matrix.columns[columnIdx];
        const deliverableName = column.items[itemIdx];
        const daysOld = Math.floor(Math.random() * 45);

        await prisma.savedPrompt.create({
          data: {
            deliverableName,
            deliverableType,
            columnName: column.name,
            overview: `This DCE workflow guides "${deliverableName}" for ${user.jobTitle} in ${org?.industry || 'industry'}.`,
            prompts: samplePrompts,
            companyId: company.id,
            createdAt: daysAgo(daysOld),
          },
        });
        results.prompts++;
      }
    }

    // Create time studies
    const operationTypes = [
      { type: 'productivity_matrix', baselineMin: 180, baselineMax: 300 },
      { type: 'performance_matrix', baselineMin: 120, baselineMax: 240 },
      { type: 'deliverable_prompts', baselineMin: 60, baselineMax: 150 },
    ];

    for (const { company, user } of allCompanies) {
      for (const opType of operationTypes) {
        const studyCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < studyCount; i++) {
          const baselineMinutes = Math.floor(Math.random() * (opType.baselineMax - opType.baselineMin)) + opType.baselineMin;
          const reductionPercent = Math.floor(Math.random() * 40) + 50;
          const actualMinutes = baselineMinutes * (1 - reductionPercent / 100);
          const minutesSaved = baselineMinutes - actualMinutes;
          const daysOld = Math.floor(Math.random() * 50);

          await prisma.timeStudy.create({
            data: {
              operationType: opType.type,
              operationName: `${user.jobTitle} - ${opType.type.replace('_', ' ')}`,
              baselineManualMinutes: baselineMinutes,
              actualMinutes: parseFloat(actualMinutes.toFixed(2)),
              minutesSaved: parseFloat(minutesSaved.toFixed(2)),
              percentReduction: parseFloat(reductionPercent.toFixed(2)),
              companyId: company.id,
              userId: user.id,
              createdAt: daysAgo(daysOld),
            },
          });
          results.timeStudies++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Production database seeded successfully!',
      results,
    });

  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Seed failed', details: error.message });
  }
});
} // End of production check

export default router;
