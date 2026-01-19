
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.container.count();
    console.log(`Total Containers in DB: ${count}`);

    const all = await prisma.container.findMany({
        take: 10,
        select: {
            containerNumber: true,
            currentStatus: true,
            aiDerived: true,
            metadata: true
        }
    });
    console.log(JSON.stringify(all, null, 2));
}

main().finally(() => prisma.$disconnect());
