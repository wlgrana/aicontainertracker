
import { prisma } from '../lib/prisma';

async function clearDatabase() {
    console.log("⚠️  CLEARING DATABASE...");

    // 1. Delete dependent tables first (Child tables)
    console.log("Deleting ShipmentContainer...");
    await prisma.shipmentContainer.deleteMany({});

    console.log("Deleting ContainerEvent...");
    await prisma.containerEvent.deleteMany({});

    console.log("Deleting RiskAssessment...");
    await prisma.riskAssessment.deleteMany({});

    console.log("Deleting StatusOverride...");
    await prisma.statusOverride.deleteMany({});

    console.log("Deleting AttentionFlag...");
    await prisma.attentionFlag.deleteMany({});

    console.log("Deleting ACEStatusLog...");
    await prisma.aCEStatusLog.deleteMany({});

    console.log("Deleting ShipmentEvent...");
    await prisma.shipmentEvent.deleteMany({});

    console.log("Deleting ImprovementJob...");
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "ImprovementJob";`);
    } catch { }

    // 1.5 Delete Agent Logs (New)
    console.log("Deleting AgentProcessingLog...");
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "AgentProcessingLog";`);
    } catch { }

    // 2. Delete main entities
    console.log("Deleting Container...");
    await prisma.container.deleteMany({});

    console.log("Deleting Shipment...");
    await prisma.shipment.deleteMany({});

    // 3. Delete Logs
    console.log("Deleting RawRow...");
    await prisma.rawRow.deleteMany({});

    console.log("Deleting ImportLog...");
    await prisma.importLog.deleteMany({});

    console.log("Deleting ActivityLog...");
    await prisma.activityLog.deleteMany({});

    // 4. Delete Cache/Config that affects imports
    console.log("Deleting CarrierFormat (Cache)...");
    await prisma.carrierFormat.deleteMany({});

    console.log("✅ Database cleared successfully.");
}

clearDatabase()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
