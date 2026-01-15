import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Cleanup Started ---');

    try {
        // Order matters for relational integrity if not using cascade
        // We'll use a transaction for safety
        await prisma.$transaction([
            // Delete dependent records first
            prisma.riskAssessment.deleteMany(),
            prisma.statusOverride.deleteMany(),
            prisma.activityLog.deleteMany(),
            prisma.attentionFlag.deleteMany(),
            // prisma.aceStatusLog.deleteMany(), // Table doesn't exist in current schema
            prisma.shipmentEvent.deleteMany(),
            prisma.containerEvent.deleteMany(),
            prisma.shipmentContainer.deleteMany(),
            prisma.rawRow.deleteMany(),

            // Delete primary operational records
            prisma.container.deleteMany(),
            prisma.shipment.deleteMany(),
            prisma.importLog.deleteMany(),
        ]);

        console.log('✅ Operational tables cleared successfully.');

        // Count remaining reference data for verification
        const carriers = await prisma.carrier.count();
        const stages = await prisma.transitStage.count();
        const ports = await prisma.port.count();

        console.log(`--- Stats Post-Cleanup ---`);
        console.log(`Carriers preserved: ${carriers}`);
        console.log(`Stages preserved: ${stages}`);
        console.log(`Ports preserved: ${ports}`);

    } catch (error) {
        console.error('❌ Data cleanup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
