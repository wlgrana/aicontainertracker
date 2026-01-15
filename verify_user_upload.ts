
import { prisma } from './lib/prisma';

async function verifyUserUpload() {
    console.log("🔍 Verifying User Upload (S25030127446)...");

    const shipment = await prisma.shipment.findUnique({
        where: { shipmentReference: 'S25030127446' },
        include: { shipmentContainers: true, importLog: true }
    });

    if (!shipment) {
        console.error("❌ Shipment S25030127446 NOT FOUND");
        return;
    }

    console.log(`✅ Shipment Found: ${shipment.shipmentReference}`);
    console.log(`- Business Unit: ${shipment.businessUnit}`);
    console.log(`- Metadata: ${JSON.stringify(shipment.metadata)}`);
    console.log(`- Import Log: ${shipment.importLogId}`);

    const containerId = 'TCNU3094950'; // From user data
    const container = await prisma.container.findUnique({
        where: { containerNumber: containerId },
        include: { events: true }
    });

    if (!container) {
        console.error(`❌ Container ${containerId} NOT FOUND`);
        return;
    }

    console.log(`✅ Container Found: ${container.containerNumber}`);
    console.log(`- Status: ${container.currentStatus}`);
    console.log(`- Metadata: ${JSON.stringify(container.metadata)}`);
    console.log(`- Event Count: ${container.events.length}`);
}

verifyUserUpload()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
