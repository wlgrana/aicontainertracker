import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prismaRefreshed: PrismaClient }

console.log('[DB] Initializing Prisma client...');
console.log('[DB] Database URL exists:', !!process.env.DATABASE_URL);
console.log('[DB] Database URL length:', process.env.DATABASE_URL?.length || 0);

export const prisma = globalForPrisma.prismaRefreshed || new PrismaClient({
    log: ['query', 'error', 'warn'],
})

// Test connection
prisma.$connect()
    .then(() => console.log('[DB] Connection successful'))
    .catch(err => {
        console.error('[DB] Connection failed:', err);
        console.error('[DB] Error message:', err.message);
        console.error('[DB] Error stack:', err.stack);
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaRefreshed = prisma
