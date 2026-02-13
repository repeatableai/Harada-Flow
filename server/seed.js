import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// Admin users to seed
const adminUsers = [
  {
    email: 'kevin@repeatable.ai',
    password: '123456',
    name: 'Kevin',
    role: 'SUPER_ADMIN',
  },
  // Add more admin users as needed:
  // {
  //   email: 'admin@example.com',
  //   password: 'SecurePassword456!',
  //   name: 'Admin',
  //   role: 'ADMIN',
  // },
];

async function main() {
  console.log('Starting database seed...\n');

  for (const admin of adminUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email.toLowerCase() },
    });

    if (existingUser) {
      console.log(`User ${admin.email} already exists, updating...`);

      const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);

      await prisma.user.update({
        where: { email: admin.email.toLowerCase() },
        data: {
          passwordHash,
          name: admin.name,
          role: admin.role,
          isPermanent: true,
        },
      });

      console.log(`  Updated ${admin.email} as ${admin.role}`);
    } else {
      console.log(`Creating user ${admin.email}...`);

      const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);

      await prisma.user.create({
        data: {
          email: admin.email.toLowerCase(),
          passwordHash,
          name: admin.name,
          role: admin.role,
          isPermanent: true,
        },
      });

      console.log(`  Created ${admin.email} as ${admin.role}`);
    }
  }

  console.log('\nSeed completed successfully!');
  console.log('\n⚠️  IMPORTANT: Remember to change the default passwords in seed.js before deploying to production!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
