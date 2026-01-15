import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const stats = {
            importLogs: await prisma.importLog.count(),
            containers: await prisma.container.count(),
            shipments: await prisma.shipment.count(),
            rawRows: await prisma.rawRow.count(),
            events: await prisma.containerEvent.count(),
            carriers: await prisma.carrier.count(),
            stages: await prisma.transitStage.count()
        };
        console.log('--- DATABASE STATS ---');
        console.log(JSON.stringify(stats, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main();
