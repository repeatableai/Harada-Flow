/**
 * Migration Script: Setup Organization Hierarchy
 *
 * This script:
 * 1. Creates a "Default Organization" for existing users
 * 2. Assigns all existing users to the default organization
 * 3. Migrates existing ADMIN users to COMPANY_ADMIN role
 * 4. Associates existing companies with the default organization
 *
 * Run with: node scripts/migrate-org-hierarchy.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ORG_NAME = 'Default Organization';
const DEFAULT_ORG_SLUG = 'default';

async function main() {
  console.log('Starting organization hierarchy migration...\n');

  // Step 1: Check if default organization already exists
  let defaultOrg = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
  });

  if (defaultOrg) {
    console.log(`Default organization already exists: ${defaultOrg.name} (${defaultOrg.id})`);
  } else {
    // Create default organization
    defaultOrg = await prisma.organization.create({
      data: {
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
      },
    });
    console.log(`Created default organization: ${defaultOrg.name} (${defaultOrg.id})`);
  }

  // Step 2: Assign existing users without an organization to the default org
  const usersWithoutOrg = await prisma.user.findMany({
    where: {
      organizationId: null,
      role: { not: 'SUPER_ADMIN' }, // Don't assign super admins to any org
    },
    select: { id: true, email: true, role: true },
  });

  if (usersWithoutOrg.length > 0) {
    console.log(`\nAssigning ${usersWithoutOrg.length} users to default organization...`);

    const updateResult = await prisma.user.updateMany({
      where: {
        id: { in: usersWithoutOrg.map(u => u.id) },
      },
      data: {
        organizationId: defaultOrg.id,
      },
    });

    console.log(`Assigned ${updateResult.count} users to default organization`);
  } else {
    console.log('\nNo users need organization assignment');
  }

  // Step 3: Migrate ADMIN users to COMPANY_ADMIN
  // Note: We keep ADMIN in the enum for backwards compatibility, but new users should use COMPANY_ADMIN
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });

  if (adminUsers.length > 0) {
    console.log(`\nFound ${adminUsers.length} ADMIN users (keeping as ADMIN for backwards compatibility)`);
    console.log('Note: ADMIN role is treated equivalent to COMPANY_ADMIN in the permission system');
    adminUsers.forEach(u => console.log(`  - ${u.email}`));
  }

  // Step 4: Associate existing companies with the default organization
  const companiesWithoutOrg = await prisma.company.findMany({
    where: { organizationId: null },
    select: { id: true },
  });

  if (companiesWithoutOrg.length > 0) {
    console.log(`\nAssigning ${companiesWithoutOrg.length} companies to default organization...`);

    const companyUpdateResult = await prisma.company.updateMany({
      where: {
        id: { in: companiesWithoutOrg.map(c => c.id) },
      },
      data: {
        organizationId: defaultOrg.id,
      },
    });

    console.log(`Assigned ${companyUpdateResult.count} companies to default organization`);
  } else {
    console.log('\nNo companies need organization assignment');
  }

  // Print summary
  console.log('\n--- Migration Summary ---');

  const orgCount = await prisma.organization.count();
  const userCount = await prisma.user.count();
  const usersInOrg = await prisma.user.count({ where: { organizationId: { not: null } } });
  const companiesInOrg = await prisma.company.count({ where: { organizationId: { not: null } } });

  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
  });

  console.log(`Organizations: ${orgCount}`);
  console.log(`Total users: ${userCount}`);
  console.log(`Users with organization: ${usersInOrg}`);
  console.log(`Companies with organization: ${companiesInOrg}`);
  console.log('\nUsers by role:');
  usersByRole.forEach(r => {
    console.log(`  ${r.role}: ${r._count}`);
  });

  console.log('\nMigration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
