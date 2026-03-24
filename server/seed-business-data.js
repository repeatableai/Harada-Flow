import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

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
  ].map((col, idx) => ({
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
    departments: [
      'Engineering',
      'Product Management',
      'Sales & Marketing',
      'Finance & Operations',
      'Human Resources',
      'Customer Success'
    ]
  },
  {
    name: 'FinServe Solutions',
    slug: 'finserve-solutions',
    industry: 'Financial Services',
    companySize: 'large',
    website: 'https://finserve.example.com',
    departments: [
      'Investment Banking',
      'Risk Management',
      'Compliance',
      'Corporate Finance',
      'IT & Security'
    ]
  },
  {
    name: 'HealthTech Innovations',
    slug: 'healthtech-innovations',
    industry: 'Healthcare',
    companySize: 'medium',
    website: 'https://healthtech-innovations.example.com',
    departments: [
      'Clinical Operations',
      'Research & Development',
      'Regulatory Affairs',
      'Business Development',
      'Quality Assurance'
    ]
  },
  {
    name: 'RetailPro Enterprise',
    slug: 'retailpro-enterprise',
    industry: 'Retail',
    companySize: 'large',
    website: 'https://retailpro.example.com',
    departments: [
      'Store Operations',
      'Merchandising',
      'Supply Chain',
      'Digital Commerce',
      'Marketing'
    ]
  },
  {
    name: 'StartupX',
    slug: 'startupx',
    industry: 'SaaS',
    companySize: 'startup',
    website: 'https://startupx.example.com',
    departments: [
      'Engineering',
      'Growth',
      'Customer Success'
    ]
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
  {
    step: 1,
    title: 'Context & Background',
    description: 'Establish the foundation and context',
    prompt: 'What is the strategic context and business objectives for this deliverable?'
  },
  {
    step: 2,
    title: 'Stakeholder Analysis',
    description: 'Identify key stakeholders',
    prompt: 'Who are the primary stakeholders and what are their requirements?'
  },
  {
    step: 3,
    title: 'Data & Research',
    description: 'Gather necessary information',
    prompt: 'What data sources and research methods should be used?'
  },
  {
    step: 4,
    title: 'Framework & Methodology',
    description: 'Define the approach',
    prompt: 'What framework or methodology will guide this deliverable?'
  },
  {
    step: 5,
    title: 'Execution Plan',
    description: 'Create actionable steps',
    prompt: 'What are the specific steps and timeline for execution?'
  },
  {
    step: 6,
    title: 'Success Metrics',
    description: 'Define measurement criteria',
    prompt: 'How will success be measured and reported?'
  },
  {
    step: 7,
    title: 'Final Deliverable',
    description: 'Synthesize the complete output',
    prompt: 'Create the final comprehensive deliverable ready for stakeholder review.'
  }
];

async function main() {
  console.log('🌱 Starting comprehensive business data seed...\n');

  // Keep existing admin users
  const adminUsers = [
    {
      email: 'kevin@repeatable.ai',
      password: '123456',
      name: 'Kevin',
      role: 'SUPER_ADMIN',
    },
    {
      email: 'company-admin@demo.com',
      password: 'demo123',
      name: 'Company Admin Demo',
      role: 'COMPANY_ADMIN',
    },
    {
      email: 'dept-admin@demo.com',
      password: 'demo123',
      name: 'Department Admin Demo',
      role: 'DEPARTMENT_ADMIN',
    },
    {
      email: 'user@demo.com',
      password: 'demo123',
      name: 'User Demo',
      role: 'USER',
    },
  ];

  console.log('👥 Creating super admin user...');
  const superAdmin = adminUsers.find(a => a.role === 'SUPER_ADMIN');
  const passwordHash = await bcrypt.hash(superAdmin.password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: superAdmin.email.toLowerCase() },
    update: {
      passwordHash,
      name: superAdmin.name,
      role: superAdmin.role,
      isPermanent: true,
    },
    create: {
      email: superAdmin.email.toLowerCase(),
      passwordHash,
      name: superAdmin.name,
      role: superAdmin.role,
      isPermanent: true,
    },
  });
  console.log(`  ✓ ${superAdmin.email} (${superAdmin.role})`);

  console.log('\n🏢 Creating organizations and departments...');
  const createdOrgs = [];

  for (const orgData of organizations) {
    const org = await prisma.organization.upsert({
      where: { slug: orgData.slug },
      update: {
        name: orgData.name,
        industry: orgData.industry,
        companySize: orgData.companySize,
        website: orgData.website,
      },
      create: {
        name: orgData.name,
        slug: orgData.slug,
        industry: orgData.industry,
        companySize: orgData.companySize,
        website: orgData.website,
      },
    });

    console.log(`  ✓ ${org.name}`);

    // Create departments
    const departments = [];
    for (const deptName of orgData.departments) {
      const dept = await prisma.department.upsert({
        where: {
          organizationId_name: {
            organizationId: org.id,
            name: deptName,
          },
        },
        update: {},
        create: {
          name: deptName,
          organizationId: org.id,
        },
      });
      departments.push(dept);
      console.log(`    • ${deptName}`);
    }

    createdOrgs.push({ org, departments, config: orgData });
  }

  console.log('\n👥 Assigning demo admin users to TechCorp Global...');
  // Assign demo company admin to TechCorp Global
  const techCorp = createdOrgs.find(o => o.config.slug === 'techcorp-global');
  const engineeringDept = techCorp.departments.find(d => d.name === 'Engineering');

  const demoCompanyAdmin = adminUsers.find(a => a.role === 'COMPANY_ADMIN');
  const demoCompanyAdminHash = await bcrypt.hash(demoCompanyAdmin.password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: demoCompanyAdmin.email.toLowerCase() },
    update: {
      passwordHash: demoCompanyAdminHash,
      name: demoCompanyAdmin.name,
      role: demoCompanyAdmin.role,
      organizationId: techCorp.org.id,
      jobTitle: 'VP of Operations',
      isPermanent: true,
    },
    create: {
      email: demoCompanyAdmin.email.toLowerCase(),
      passwordHash: demoCompanyAdminHash,
      name: demoCompanyAdmin.name,
      role: demoCompanyAdmin.role,
      organizationId: techCorp.org.id,
      jobTitle: 'VP of Operations',
      isPermanent: true,
    },
  });
  console.log(`  ✓ ${demoCompanyAdmin.email} → ${techCorp.org.name} (COMPANY_ADMIN)`);

  // Assign demo dept admin to TechCorp Engineering department
  const demoDeptAdmin = adminUsers.find(a => a.role === 'DEPARTMENT_ADMIN');
  const demoDeptAdminHash = await bcrypt.hash(demoDeptAdmin.password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: demoDeptAdmin.email.toLowerCase() },
    update: {
      passwordHash: demoDeptAdminHash,
      name: demoDeptAdmin.name,
      role: demoDeptAdmin.role,
      organizationId: techCorp.org.id,
      departmentId: engineeringDept.id,
      jobTitle: 'VP Engineering',
      isPermanent: true,
    },
    create: {
      email: demoDeptAdmin.email.toLowerCase(),
      passwordHash: demoDeptAdminHash,
      name: demoDeptAdmin.name,
      role: demoDeptAdmin.role,
      organizationId: techCorp.org.id,
      departmentId: engineeringDept.id,
      jobTitle: 'VP Engineering',
      isPermanent: true,
    },
  });
  console.log(`  ✓ ${demoDeptAdmin.email} → ${techCorp.org.name} / ${engineeringDept.name} (DEPARTMENT_ADMIN)`);

  // Assign demo regular user to TechCorp Engineering department
  const demoUser = adminUsers.find(a => a.role === 'USER');
  const demoUserHash = await bcrypt.hash(demoUser.password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: demoUser.email.toLowerCase() },
    update: {
      passwordHash: demoUserHash,
      name: demoUser.name,
      role: demoUser.role,
      organizationId: techCorp.org.id,
      departmentId: engineeringDept.id,
      jobTitle: 'Senior Software Engineer',
      isPermanent: true,
    },
    create: {
      email: demoUser.email.toLowerCase(),
      passwordHash: demoUserHash,
      name: demoUser.name,
      role: demoUser.role,
      organizationId: techCorp.org.id,
      departmentId: engineeringDept.id,
      jobTitle: 'Senior Software Engineer',
      isPermanent: true,
    },
  });
  console.log(`  ✓ ${demoUser.email} → ${techCorp.org.name} / ${engineeringDept.name} (USER)`);

  console.log('\n👨‍💼 Creating business users with realistic roles...');
  let totalUsersCreated = 0;
  const allUsers = [];

  for (const { org, departments, config } of createdOrgs) {
    // Create company admin for this org
    const companyAdminEmail = `admin@${config.slug}.example.com`;
    const passwordHash = await bcrypt.hash('demo123', SALT_ROUNDS);

    const companyAdmin = await prisma.user.upsert({
      where: { email: companyAdminEmail },
      update: {
        organizationId: org.id,
        role: 'COMPANY_ADMIN',
      },
      create: {
        email: companyAdminEmail,
        passwordHash,
        name: `${org.name} Admin`,
        jobTitle: 'Chief Operating Officer',
        role: 'COMPANY_ADMIN',
        organizationId: org.id,
        isPermanent: true,
        lastLoginAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
    allUsers.push(companyAdmin);
    totalUsersCreated++;

    // Create department admins and users
    for (const dept of departments) {
      // Department admin
      const deptAdminEmail = `${dept.name.toLowerCase().replace(/\s+/g, '-')}-admin@${config.slug}.example.com`;
      const deptAdmin = await prisma.user.upsert({
        where: { email: deptAdminEmail },
        update: {
          organizationId: org.id,
          departmentId: dept.id,
          role: 'DEPARTMENT_ADMIN',
        },
        create: {
          email: deptAdminEmail,
          passwordHash,
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
      totalUsersCreated++;

      // Create 2-4 regular users per department
      const userCount = Math.floor(Math.random() * 3) + 2;
      const jobTitles = jobTitlesByDepartment[dept.name] || ['Manager', 'Analyst', 'Associate'];

      for (let i = 0; i < userCount; i++) {
        const userEmail = `${dept.name.toLowerCase().replace(/\s+/g, '-')}-user${i + 1}@${config.slug}.example.com`;
        const jobTitle = jobTitles[i % jobTitles.length] || 'Analyst';

        const user = await prisma.user.upsert({
          where: { email: userEmail },
          update: {
            organizationId: org.id,
            departmentId: dept.id,
          },
          create: {
            email: userEmail,
            passwordHash,
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
        totalUsersCreated++;
      }
    }
  }
  console.log(`  ✓ Created ${totalUsersCreated} business users`);

  console.log('\n📊 Creating sessions (role deliverables matrices)...');
  let totalSessions = 0;
  const allCompanies = [];

  // Create 2-5 sessions per user for active users
  for (const user of allUsers) {
    if (user.role === 'SUPER_ADMIN') continue;

    const sessionCount = Math.floor(Math.random() * 4) + 1; // 1-4 sessions per user

    for (let i = 0; i < sessionCount; i++) {
      const daysOld = Math.floor(Math.random() * 60); // Sessions created over last 60 days
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
      totalSessions++;
    }
  }
  console.log(`  ✓ Created ${totalSessions} role deliverables sessions`);

  console.log('\n💡 Creating saved prompts for deliverables...');
  let totalPrompts = 0;

  for (const { company, user, org } of allCompanies) {
    // Create 3-8 saved prompts per session
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
          overview: `This DCE (Deliverable Creation Engine) workflow guides the creation of "${deliverableName}" for ${user.jobTitle} in the ${org?.industry || 'industry'} sector. The 7-step process ensures comprehensive coverage from strategic planning to final execution.`,
          prompts: samplePrompts,
          companyId: company.id,
          createdAt: daysAgo(daysOld),
        },
      });
      totalPrompts++;
    }
  }
  console.log(`  ✓ Created ${totalPrompts} AI-generated deliverable prompts`);

  console.log('\n⏱️  Creating time study data (productivity metrics)...');
  let totalTimeStudies = 0;

  const operationTypes = [
    { type: 'productivity_matrix', baselineMin: 180, baselineMax: 300 },
    { type: 'performance_matrix', baselineMin: 120, baselineMax: 240 },
    { type: 'deliverable_prompts', baselineMin: 60, baselineMax: 150 },
  ];

  for (const { company, user } of allCompanies) {
    // Create time studies for each operation type
    for (const opType of operationTypes) {
      const studyCount = Math.floor(Math.random() * 3) + 1; // 1-3 studies per operation

      for (let i = 0; i < studyCount; i++) {
        const baselineMinutes = Math.floor(Math.random() * (opType.baselineMax - opType.baselineMin)) + opType.baselineMin;
        const reductionPercent = Math.floor(Math.random() * 40) + 50; // 50-90% reduction
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
        totalTimeStudies++;
      }
    }
  }
  console.log(`  ✓ Created ${totalTimeStudies} time savings metrics`);

  console.log('\n📁 Creating knowledge files...');
  let totalFiles = 0;

  const fileScopes = ['self', 'departments', 'company', 'system'];
  const fileTypes = [
    { name: 'Company_Guidelines.pdf', mime: 'application/pdf', size: 2456789 },
    { name: 'Template_Budget_FY2026.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 567890 },
    { name: 'Process_Documentation.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1234567 },
    { name: 'Brand_Guidelines.pdf', mime: 'application/pdf', size: 3456789 },
    { name: 'Training_Manual.pdf', mime: 'application/pdf', size: 4567890 },
  ];

  for (const { org, departments } of createdOrgs) {
    const orgUsers = allUsers.filter(u => u.organizationId === org.id && u.role !== 'SUPER_ADMIN');

    // Create 5-10 files per organization
    const fileCount = Math.floor(Math.random() * 6) + 5;

    for (let i = 0; i < fileCount; i++) {
      const uploader = orgUsers[Math.floor(Math.random() * orgUsers.length)];
      const fileTemplate = fileTypes[i % fileTypes.length];
      const scope = fileScopes[Math.floor(Math.random() * fileScopes.length)];
      const daysOld = Math.floor(Math.random() * 90);

      const departmentIds = scope === 'departments'
        ? departments.slice(0, Math.floor(Math.random() * departments.length) + 1).map(d => d.id)
        : [];

      await prisma.knowledgeFile.create({
        data: {
          filename: `${Date.now()}-${i}-${fileTemplate.name}`,
          originalName: fileTemplate.name,
          mimeType: fileTemplate.mime,
          size: fileTemplate.size,
          uploaderId: uploader.id,
          scope,
          departmentIds,
          organizationId: org.id,
          description: `Knowledge resource for ${org.name} - ${fileTemplate.name.replace(/_/g, ' ')}`,
          createdAt: daysAgo(daysOld),
          updatedAt: daysAgo(Math.max(0, daysOld - 5)),
        },
      });
      totalFiles++;
    }
  }
  console.log(`  ✓ Created ${totalFiles} knowledge files`);

  console.log('\n🔐 Creating access requests (trial users)...');
  const accessStatuses = ['pending', 'approved', 'rejected'];
  let totalRequests = 0;

  for (let i = 0; i < 15; i++) {
    const status = accessStatuses[Math.floor(Math.random() * accessStatuses.length)];
    const daysOld = Math.floor(Math.random() * 30);
    const passwordHash = await bcrypt.hash('trial123', SALT_ROUNDS);

    await prisma.accessRequest.create({
      data: {
        name: `Trial User ${i + 1}`,
        company: `Trial Company ${i + 1}`,
        email: `trial${i + 1}@example.com`,
        jobTitle: ['Marketing Manager', 'Sales Director', 'Product Manager', 'Operations Lead'][i % 4],
        passwordHash,
        status,
        reviewedAt: status !== 'pending' ? daysAgo(Math.max(0, daysOld - 2)) : null,
        reviewedBy: status !== 'pending' ? 'kevin@repeatable.ai' : null,
        createdAt: daysAgo(daysOld),
      },
    });
    totalRequests++;
  }
  console.log(`  ✓ Created ${totalRequests} trial access requests`);

  // Summary statistics
  console.log('\n' + '='.repeat(60));
  console.log('✅ BUSINESS DATA SEED COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('\n📈 Summary Statistics:');
  console.log(`  • Organizations: ${createdOrgs.length}`);
  console.log(`  • Departments: ${createdOrgs.reduce((sum, o) => sum + o.departments.length, 0)}`);
  console.log(`  • Total Users: ${totalUsersCreated + adminUsers.length}`);
  console.log(`  • Role Sessions (Matrices): ${totalSessions}`);
  console.log(`  • Saved Prompts (DCE Workflows): ${totalPrompts}`);
  console.log(`  • Time Studies (Productivity Metrics): ${totalTimeStudies}`);
  console.log(`  • Knowledge Files: ${totalFiles}`);
  console.log(`  • Access Requests: ${totalRequests}`);

  // Calculate aggregate time savings
  const timeStats = await prisma.timeStudy.aggregate({
    _sum: {
      minutesSaved: true,
    },
    _avg: {
      percentReduction: true,
    },
  });

  const totalHoursSaved = ((timeStats._sum.minutesSaved || 0) / 60).toFixed(1);
  const avgReduction = (timeStats._avg.percentReduction || 0).toFixed(1);

  console.log('\n💰 Business Value Metrics:');
  console.log(`  • Total Time Saved: ${totalHoursSaved} hours`);
  console.log(`  • Average Productivity Gain: ${avgReduction}%`);
  console.log(`  • Deliverables Generated: ${totalPrompts}`);
  console.log(`  • Active Organizations: ${createdOrgs.length}`);

  console.log('\n🔑 Demo Credentials (Test Filtering/Sorting):');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Super Admin (sees ALL data):');
  console.log('    📧 kevin@repeatable.ai / 123456');
  console.log('');
  console.log('  Company Admin (sees TechCorp Global only):');
  console.log('    📧 company-admin@demo.com / demo123');
  console.log('    🏢 Organization: TechCorp Global');
  console.log('    📊 Sees: All departments & users in TechCorp');
  console.log('');
  console.log('  Department Admin (sees Engineering dept only):');
  console.log('    📧 dept-admin@demo.com / demo123');
  console.log('    🏢 Organization: TechCorp Global');
  console.log('    📂 Department: Engineering');
  console.log('    📊 Sees: Only Engineering department data');
  console.log('');
  console.log('  Regular User:');
  console.log('    📧 user@demo.com / demo123');
  console.log('    🏢 Organization: TechCorp Global / Engineering');
  console.log('');
  console.log('  Organization-specific admins:');
  createdOrgs.slice(0, 3).forEach(o => {
    console.log(`    📧 admin@${o.config.slug}.example.com / demo123 (${o.org.name})`);
  });

  console.log('\n⚠️  IMPORTANT: Change default passwords before production deployment!');
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
