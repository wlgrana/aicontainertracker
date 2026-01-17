
import { PrismaClient } from '@prisma/client';
import { updateStatus } from './simulation-utils';

const prisma = new PrismaClient();

async function main() {
    updateStatus({ step: 'IDLE', progress: 0, message: 'Clearing Database...', metrics: {} });
    console.log("⚠️  CLEARING DATABASE...");
    try {
        await prisma.agentProcessingLog.deleteMany();
        await prisma.activityLog.deleteMany();
        await prisma.containerEvent.deleteMany();
        await prisma.shipmentContainer.deleteMany();
        await prisma.shipment.deleteMany();
        await prisma.container.deleteMany();
        await prisma.rawRow.deleteMany();
        await prisma.importLog.deleteMany();
        console.log("✅ Database Cleared.");
        updateStatus({ step: 'IDLE', progress: 0, message: 'Database Cleared. Ready to Start.', metrics: {} });
    } catch (e) {
        console.error("Clear failed", e);
        updateStatus({ step: 'IDLE', progress: 0, message: 'Clear Failed.', metrics: {} });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
