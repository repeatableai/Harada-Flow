import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ 
    take: 5,
    select: { id: true, email: true, name: true, role: true, passwordHash: true }
  });
  console.log('Users:');
  users.forEach(u => {
    console.log('  -', u.email, '| Role:', u.role, '| Has Password:', !!u.passwordHash);
  });
}

main().finally(() => prisma.$disconnect());
