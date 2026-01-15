
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyLCL() {
    console.log("Verifying LCL Consolidation...");

    const containerNum = 'MSCU1234567';
    const hbl1 = 'HBL001';
    const hbl2 = 'HBL002';

    // Cleanup
    await prisma.containerEvent.deleteMany({ where: { containerId: containerNum } }); // FK Constraint
    await prisma.shipmentContainer.deleteMany({
        where: {
            OR: [{ containerId: containerNum }, { shipmentId: hbl1 }, { shipmentId: hbl2 }]
        }
    });
    await prisma.container.deleteMany({ where: { containerNumber: containerNum } });
    await prisma.shipment.deleteMany({ where: { shipmentReference: { in: [hbl1, hbl2] } } });

    // 1. Create Data
    // Ensure dependencies exist
    await prisma.carrier.upsert({
        where: { carrierName: 'MSC' },
        update: {},
        create: { carrierName: 'MSC' }
    });

    // Ensure Stage exists (assuming ARR is Arrived)
    await prisma.transitStage.upsert({
        where: { stageName: 'ARR' },
        update: {},
        create: { stageName: 'ARR', sequence: 10, category: 'Arrival' }
    });

    // Create Container
    // Trying without status first to debug FK
    try {
        await prisma.container.create({
            data: {
                containerNumber: containerNum,
                containerType: '40HC',
                carrier: 'MSC',
                // currentStatus: 'ARR' // Commented out to debug
            }
        });
        console.log(`Created Container ${containerNum}`);
    } catch (e: any) {
        console.error("Failed to create container:", e.message);
        throw e;
    }

    // Create Shipments
    await prisma.shipment.create({
        data: {
            shipmentReference: hbl1,
            hbl: hbl1,
            shipmentType: 'FCL', // Usually FCL implies 1 shipment, but for testing mixing or multiple HBLs in one box
        }
    });

    await prisma.shipment.create({
        data: {
            shipmentReference: hbl2,
            hbl: hbl2,
            shipmentType: 'LCL',
        }
    });
    console.log(`Created Shipments ${hbl1}, ${hbl2}`);

    // Link them
    await prisma.shipmentContainer.create({
        data: {
            shipmentId: hbl1,
            containerId: containerNum,
            notes: 'First Shipment'
        }
    });

    await prisma.shipmentContainer.create({
        data: {
            shipmentId: hbl2,
            containerId: containerNum,
            notes: 'Second Shipment (Consolidated)'
        }
    });
    console.log("Linked both shipments to container.");

    // 2. Verify Junction Table
    const links = await prisma.shipmentContainer.findMany({
        where: { containerId: containerNum }
    });

    console.log(`\nJunction Table Records for ${containerNum}: ${links.length}`);
    links.forEach(l => console.log(` - Linked Shipment: ${l.shipmentId} (ID: ${l.id})`));

    if (links.length !== 2) {
        console.error("FAIL: Expected 2 links.");
        process.exit(1);
    }

    // 3. Verify Container View
    const container = await prisma.container.findUnique({
        where: { containerNumber: containerNum },
        include: {
            shipmentContainers: {
                include: { shipment: true }
            }
        }
    });

    if (!container) {
        console.error("FAIL: Container not found.");
        process.exit(1);
    }

    console.log(`\nContainer ${container.containerNumber} Details:`);
    console.log(`Attached Shipments: ${container.shipmentContainers.length}`);
    container.shipmentContainers.forEach(sc => {
        console.log(` - Ref: ${sc.shipment.shipmentReference} (Type: ${sc.shipment.shipmentType})`);
    });

    if (container.shipmentContainers.length === 2) {
        console.log("\nSUCCESS: LCL Consolidation Verified. Multiple shipments linked to single container.");
    } else {
        console.error("FAIL: Did not retrieve 2 shipments via container relation.");
        process.exit(1);
    }
}

verifyLCL()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
