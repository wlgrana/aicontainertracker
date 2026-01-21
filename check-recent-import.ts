import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentImport() {
    console.log('Checking containers from recent import with forwarder...\n');

    // Get the import log with forwarder
    const importLog = await prisma.importLog.findFirst({
        where: {
            forwarder: { not: null }
        },
        orderBy: { importedOn: 'desc' }
    });

    if (!importLog) {
        console.log('No import logs with forwarder found.');
        await prisma.$disconnect();
        return;
    }

    console.log(`Import: ${importLog.fileName}`);
    console.log(`Forwarder: ${importLog.forwarder}`);
    console.log(`Imported: ${importLog.importedOn}\n`);

    // Get containers from this import
    const containers = await prisma.container.findMany({
        where: {
            metadata: {
                path: ['_internal', 'importLogId'],
                equals: importLog.fileName
            }
        },
        take: 5,
        select: {
            containerNumber: true,
            carrier: true,
            currentStatus: true,
            shipmentContainers: {
                include: {
                    shipment: {
                        select: {
                            shipmentReference: true,
                            forwarder: true
                        }
                    }
                }
            }
        }
    });

    console.log(`Found ${containers.length} containers from this import:\n`);

    containers.forEach((c, index) => {
        const forwarder = c.shipmentContainers?.[0]?.shipment?.forwarder || null;
        const shipmentRef = c.shipmentContainers?.[0]?.shipment?.shipmentReference || null;
        console.log(`${index + 1}. ${c.containerNumber}`);
        console.log(`   Shipment: ${shipmentRef || '(not linked)'}`);
        console.log(`   Forwarder: ${forwarder || '(not set)'}`);
        console.log('');
    });

    await prisma.$disconnect();
}

checkRecentImport().catch(console.error);
