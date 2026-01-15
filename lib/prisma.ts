import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prismaRefreshed: PrismaClient }

export const prisma = globalForPrisma.prismaRefreshed || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaRefreshed = prisma
