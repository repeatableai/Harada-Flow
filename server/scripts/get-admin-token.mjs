import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  // Find or create a super admin
  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }});
  
  if (!admin) {
    const passwordHash = await bcrypt.hash('adminpass123', 12);
    admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Test Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        isPermanent: true,
      }
    });
  }
  
  // Generate a JWT token
  const token = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET || 'dev-secret-change-in-production');
  console.log('Admin ID:', admin.id);
  console.log('Admin Email:', admin.email);
  console.log('Token:', token);
}

main().finally(() => prisma.$disconnect());
