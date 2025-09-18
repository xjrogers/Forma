import { PrismaClient } from '@prisma/client';

// Prevent multiple instances in development
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

// Handle cleanup
process.on('beforeExit', async () => {
  await prisma.$disconnect();
}); 