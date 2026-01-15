import { PrismaClient } from '../lib/generated/final_client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data cleanup...');

    // Delete in order of dependencies (child tables first)

    // 1. Delete specialized logs and relation tables
    await prisma.activityLog.deleteMany({});
    await prisma.attentionFlag.deleteMany({});
    await prisma.statusOverride.deleteMany({});
    await prisma.riskAssessment.deleteMany({});
    await prisma.shipmentContainer.deleteMany({});
    await prisma.aCEStatusLog.deleteMany({});
    await prisma.containerEvent.deleteMany({});
    await prisma.shipmentEvent.deleteMany({});
    await prisma.rawRow.deleteMany({}); // Access raw rows from imports

    // 2. Delete main entities
    await prisma.container.deleteMany({});
    await prisma.shipment.deleteMany({});

    // 3. Delete source logs
    await prisma.importLog.deleteMany({});

    console.log('Cleanup complete: All transactional data deleted.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
