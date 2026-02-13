import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'testlogin@test.com';
  const password = 'testpassword123';
  
  // Delete if exists
  await prisma.user.deleteMany({ where: { email } });
  
  // Create user with known password
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test Login User',
      passwordHash,
      role: 'USER',
      isPermanent: true,
    }
  });
  
  console.log('Created test user:');
  console.log('  Email:', email);
  console.log('  Password:', password);
  console.log('  ID:', user.id);
}

main().finally(() => prisma.$disconnect());
