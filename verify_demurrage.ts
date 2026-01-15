
import { PrismaClient } from '@prisma/client';
import { getDashboardData } from './app/actions/entry/actions';

const prisma = new PrismaClient();

async function verify() {
    console.log("Verifying Demurrage Logic...");

    // 1. Setup Data
    const cId = "TEST_DEM_CALC";
    const now = new Date();
    const daysHeld = 5;
    const daysOver = 3;

    const lastFreeDay = new Date(now.getTime() - (daysOver * 24 * 60 * 60 * 1000));
    // Making sure the ms don't mess up floor calc, subtracting slightly more than 3 days ensures it's definitely 3 days ago? 
    // Actually, if we want "3 days over free", LFD was 3 days ago.

    const statusUpdated = new Date(now.getTime() - (daysHeld * 24 * 60 * 60 * 1000));

    // Delete existing
    await prisma.container.deleteMany({ where: { containerNumber: cId } });
    await prisma.demurrageRate.deleteMany({ where: { name: 'TEST_RATE' } });
    // Ensure carrier exists for FK constraint
    try {
        await prisma.carrier.create({ data: { carrierName: 'TestCarrier' } });
    } catch {
        // Ignore if exists
    }

    // Create Rate
    await prisma.demurrageRate.create({
        data: {
            name: 'TEST_RATE',
            carrierId: 'TestCarrier',
            containerType: '40HC',
            dailyRate: 150.0
        }
    });

    // Create Container
    await prisma.container.create({
        data: {
            containerNumber: cId,
            currentStatus: 'DIS',
            statusLastUpdated: statusUpdated,
            lastFreeDay: lastFreeDay,
            carrier: 'TestCarrier',
            containerType: '40HC',
            hasException: true,
            exceptionType: 'Test Calc',
            exceptionOwner: 'System'
        }
    });

    // 2. Call Action
    const result = await getDashboardData();

    // 3. Verify
    const item = result.attention.find((x: any) => x.containerNumber === cId);
    if (!item) {
        console.error("FAILED: Container not found in attention list");
        process.exit(1);
    }

    console.log("Container Data:", item);

    let success = true;
    if (item.daysAtStage !== 5) {
        console.error(`FAIL: Expected 5 days at stage, got ${item.daysAtStage}`);
        success = false;
    }

    if (item.daysOverFree !== 3) {
        console.error(`FAIL: Expected 3 days over free, got ${item.daysOverFree}`);
        success = false;
    }

    if (item.estimatedDemurrage !== 450) {
        console.error(`FAIL: Expected 450 demurrage, got ${item.estimatedDemurrage}`);
        success = false;
    }

    if (success) {
        console.log("SUCCESS: All calculations correct!");
    } else {
        console.error("FAILED: Calculations incorrect.");
        process.exit(1);
    }
}

verify()
    .catch(e => {
        console.error("Script Error:", e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
