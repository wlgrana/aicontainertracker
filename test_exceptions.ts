process.loadEnvFile(); // Load .env
import { PrismaClient } from './lib/generated/final_client';
import { runExceptionClassifier } from './agents/exception-classifier';

const prisma = new PrismaClient();

async function main() {
    const now = new Date();

    // Cleanup
    await prisma.containerEvent.deleteMany({ where: { containerId: { in: ['TEST0001', 'TEST0002', 'TEST0003'] } } });
    await prisma.shipmentContainer.deleteMany({ where: { containerId: 'TEST0003' } });
    await prisma.container.deleteMany({ where: { containerNumber: { in: ['TEST0001', 'TEST0002', 'TEST0003'] } } });
    await prisma.shipment.deleteMany({ where: { shipmentReference: 'SHIP001' } });

    console.log("=== SCENARIO 1: Demurrage Risk ===");
    // LFD = Yesterday
    const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    await prisma.container.create({
        data: {
            containerNumber: 'TEST0001',
            currentStatus: 'AVL',
            lastFreeDay: yesterday,
            statusLastUpdated: now
        }
    });
    await runExceptionClassifier('TEST0001');

    console.log("=== SCENARIO 2: Stale Status (Customs) ===");
    // Updated 10 days ago
    const tenDaysAgo = new Date(); tenDaysAgo.setDate(now.getDate() - 10);
    await prisma.container.create({
        data: {
            containerNumber: 'TEST0002',
            currentStatus: 'CUS', // Customs
            statusLastUpdated: tenDaysAgo
        }
    });
    await runExceptionClassifier('TEST0002');

    console.log("=== SCENARIO 3: Payment Hold ===");
    // Container AVL, Shipment Pending
    await prisma.shipment.create({
        data: {
            shipmentReference: 'SHIP001',
            blStatus: 'Pending',
        }
    });
    await prisma.container.create({
        data: {
            containerNumber: 'TEST0003',
            currentStatus: 'AVL',
            statusLastUpdated: now,
            shipmentContainers: {
                create: {
                    shipmentId: 'SHIP001'
                }
            }
        }
    });
    await runExceptionClassifier('TEST0003');

    // REPORT
    console.log("\n=== WORK QUEUE (Needs Attention) ===");
    const exceptions = await prisma.container.findMany({
        where: { hasException: true },
        select: {
            containerNumber: true,
            exceptionType: true,
            exceptionOwner: true
        },
        orderBy: { containerNumber: 'asc' }
    });
    console.log(JSON.stringify(exceptions, null, 2));

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
