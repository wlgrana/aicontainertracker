import { prisma } from './lib/prisma';

async function verifyUpload() {
    console.log("=== VERIFYING TEST UPLOAD ===\n");

    // Get the 5 test containers
    const testContainers = ['CONT1001', 'CONT1002', 'CONT1003', 'CONT1004', 'CONT1005'];

    for (const containerId of testContainers) {
        const container = await prisma.container.findUnique({
            where: { containerNumber: containerId },
            include: {
                events: {
                    orderBy: { eventDateTime: 'desc' }
                }
            }
        });

        if (container) {
            console.log(`✅ ${containerId} FOUND`);
            console.log(`   Status: ${container.currentStatus}`);
            console.log(`   Location: ${container.currentLocation}`);
            console.log(`   Carrier: ${container.carrier || 'N/A'}`);
            console.log(`   Type: ${container.containerType || 'N/A'}`);
            console.log(`   Events: ${container.events.length}`);
            console.log(`   Exception: ${container.hasException ? 'YES' : 'NO'}`);
            console.log('');
        } else {
            console.log(`❌ ${containerId} NOT FOUND\n`);
        }
    }

    // Check the import log
    const latestImport = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' },
        include: { rawRows: true }
    });

    if (latestImport) {
        console.log("=== LATEST IMPORT LOG ===");
        console.log(`File: ${latestImport.fileName}`);
        console.log(`Status: ${latestImport.status}`);
        console.log(`Rows: ${latestImport.rowsProcessed}`);
        console.log(`Raw Rows Saved: ${latestImport.rawRows.length}`);
        console.log(`AI Analysis: ${latestImport.aiAnalysis ? 'YES' : 'NO'}`);
    }
}

verifyUpload()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
