
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIngestedData() {
    console.log("Checking Ingested Data...");

    // 1. Get latest ImportLog
    const latestLog = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' },
        include: { _count: { select: { containers: true, shipments: true, rawRows: true } } }
    });

    if (!latestLog) {
        console.log("No ImportLog found!");
        return;
    }

    console.log("\n--- Latest ImportLog ---");
    console.log(`FileName: ${latestLog.fileName}`);
    console.log(`Status: ${latestLog.status}`);
    console.log(`Rows: ${latestLog.rowsProcessed}`);
    console.log(`Date: ${latestLog.importedOn}`);

    // 2. Get Containers from this log
    if (latestLog.fileName) {
        const containers = await prisma.container.findMany({
            where: { importLogId: latestLog.fileName },
            take: 5
        });

        console.log(`\n--- Containers (First 5 of ${latestLog._count.containers}) ---`);
        if (containers.length === 0) {
            console.log("No containers found for this logs.");
        } else {
            containers.forEach(c => {
                console.log(`\nContainer: ${c.containerNumber}`);
                console.log(`  Status: ${c.currentStatus}`);
                console.log(`  AI Operational Status: ${c.aiOperationalStatus}`);
                console.log(`  Health Score: ${c.healthScore}`);
                console.log(`  Days In Transit: ${c.daysInTransit}`);
                console.log(`  Has Exception: ${c.hasException}`);
                console.log(`  Metadata: ${JSON.stringify(c.metadata).substring(0, 100)}...`);
            });
        }
    }
}

checkIngestedData()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
