import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Cleanup Started (Step-by-Step) ---');

    const tables = [
        'riskAssessment',
        'statusOverride',
        'activityLog',
        'attentionFlag',
        'aceStatusLog',
        'shipmentEvent',
        'containerEvent',
        'shipmentContainer',
        'rawRow',
        'container',
        'shipment',
        'importLog'
    ];

    for (const table of tables) {
        try {
            const result = await (prisma as any)[table].deleteMany();
            console.log(`✅ ${table}: Deleted ${result.count} records.`);
        } catch (error: any) {
            console.error(`❌ ${table}: Failed - ${error.message}`);
        }
    }

    console.log('--- Cleanup Verification ---');
    const containerCount = await prisma.container.count();
    const eventCount = await prisma.containerEvent.count();
    console.log(`Containers remaining: ${containerCount}`);
    console.log(`Events remaining: ${eventCount}`);

    await prisma.$disconnect();
}

main();
