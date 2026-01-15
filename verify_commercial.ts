import { prisma } from './lib/prisma';

async function verify() {
    console.log("Verifying Commercial Data...");

    // Check Shipments
    const shipments = await prisma.shipment.findMany({
        where: { shipmentReference: { in: ['SHP-2024-001'] } },
        include: { shipmentContainers: true }
    });

    console.log(`Found ${shipments.length} shipments.`);
    shipments.forEach(s => {
        console.log(`\nShipment: ${s.shipmentReference}`);
        console.log(`- Business Unit: ${s.businessUnit}`);
        console.log(`- Freight Cost: ${s.freightCost}`);
        console.log(`- Volume: ${s.shipmentVolume || s.totalVolume}`);
        console.log(`- Shipper: ${s.shipper}`);
        console.log(`- Consignee: ${s.consignee}`);
        console.log(`- MBL: ${s.mbl}`);
        console.log(`- Pieces: ${s.totalPieces}`);
        console.log(`- Weight: ${s.totalWeight}`);
        console.log(`- Notes: ${s.notes}`);
        console.log(`- ImportLogId: ${s.importLogId}`);
        console.log(`- Metadata: ${JSON.stringify(s.metadata)}`);
    });

    // Check Containers
    const containers = await prisma.container.findMany({
        where: { containerNumber: { in: ['CONTNEW001'] } }
    });

    console.log(`\nFound ${containers.length} containers.`);
    containers.forEach(c => {
        console.log(`\nContainer: ${c.containerNumber}`);
        console.log(`- Gate Out: ${c.gateOutDate}`);
        console.log(`- Carrier: ${c.carrier}`);
        console.log(`- ImportLogId: ${c.importLogId}`);
        console.log(`- Metadata: ${JSON.stringify(c.metadata)}`);
    });

    await prisma.$disconnect();
}

verify().catch(console.error);
