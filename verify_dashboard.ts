
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log("Verifying Dashboard Data Access...");

    try {
        const attention = await prisma.container.findMany({
            where: { hasException: true },
            select: {
                containerNumber: true,
                currentStatus: true,
                statusLastUpdated: true,
                exceptionType: true,
                exceptionOwner: true,
            },
            orderBy: { manualPriority: 'desc' }
        });
        console.log(`Attention items: ${attention.length}`);

        const containers = await prisma.container.findMany({
            orderBy: { containerNumber: 'asc' },
            take: 50
        });
        console.log(`Containers items: ${containers.length}`);

        if (attention.length > 0 && containers.length > 0) {
            console.log("SUCCESS: Data retrieved successfully.");
        } else {
            console.log("WARNING: Data retrieved but empty (maybe seed failed?)");
        }

    } catch (e) {
        console.error("FAILURE: Database query threw error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
