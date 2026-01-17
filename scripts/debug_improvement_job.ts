
import { prisma } from '../lib/prisma';

async function main() {
    const jobs = await prisma.improvementJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(jobs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
