
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning transactional data from database...');

    try {
        console.log('Deleting AgentProcessingLog...');
        await prisma.agentProcessingLog.deleteMany({});

        console.log('Deleting RiskAssessment...');
        await prisma.riskAssessment.deleteMany({});

        console.log('Deleting StatusOverride...');
        await prisma.statusOverride.deleteMany({});

        console.log('Deleting ActivityLog...');
        await prisma.activityLog.deleteMany({});

        console.log('Deleting AttentionFlag...');
        await prisma.attentionFlag.deleteMany({});

        console.log('Deleting ACEStatusLog...');
        await prisma.aCEStatusLog.deleteMany({});

        console.log('Deleting ShipmentEvent...');
        await prisma.shipmentEvent.deleteMany({});

        console.log('Deleting ContainerEvent...');
        await prisma.containerEvent.deleteMany({});

        console.log('Deleting ShipmentContainer...');
        await prisma.shipmentContainer.deleteMany({});

        console.log('Deleting RawRow...');
        await prisma.rawRow.deleteMany({});

        console.log('Deleting Container...');
        await prisma.container.deleteMany({});

        console.log('Deleting Shipment...');
        await prisma.shipment.deleteMany({});

        console.log('Deleting ImprovementJob...');
        await prisma.improvementJob.deleteMany({});

        console.log('Deleting ImportLog...');
        await prisma.importLog.deleteMany({});

        console.log('✅ Database cleaned successfully!');
    } catch (e) {
        console.error('❌ Failed to clean database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
