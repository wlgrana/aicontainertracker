import { prisma } from '../lib/prisma';

async function clearDatabase() {
    console.log('🗑️  Clearing all database tables...');

    try {
        // Delete in order to respect foreign key constraints
        // Start with dependent tables first

        await prisma.containerEvent.deleteMany({});
        console.log('✅ Cleared ContainerEvent table');

        await prisma.shipmentEvent.deleteMany({});
        console.log('✅ Cleared ShipmentEvent table');

        await prisma.shipmentContainer.deleteMany({});
        console.log('✅ Cleared ShipmentContainer table');

        await prisma.transitStage.deleteMany({});
        console.log('✅ Cleared TransitStage table');

        await prisma.aCEStatusLog.deleteMany({});
        console.log('✅ Cleared ACEStatusLog table');

        await prisma.attentionFlag.deleteMany({});
        console.log('✅ Cleared AttentionFlag table');

        await prisma.statusOverride.deleteMany({});
        console.log('✅ Cleared StatusOverride table');

        await prisma.riskAssessment.deleteMany({});
        console.log('✅ Cleared RiskAssessment table');

        await prisma.activityLog.deleteMany({});
        console.log('✅ Cleared ActivityLog table');

        await prisma.agentProcessingLog.deleteMany({});
        console.log('✅ Cleared AgentProcessingLog table');

        await prisma.improvementJob.deleteMany({});
        console.log('✅ Cleared ImprovementJob table');

        await prisma.container.deleteMany({});
        console.log('✅ Cleared Container table');

        await prisma.shipment.deleteMany({});
        console.log('✅ Cleared Shipment table');

        await prisma.importLog.deleteMany({});
        console.log('✅ Cleared ImportLog table');

        await prisma.rawRow.deleteMany({});
        console.log('✅ Cleared RawRow table');

        console.log('✨ Database cleared successfully!');
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed:', error);
        process.exit(1);
    });
