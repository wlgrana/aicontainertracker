import { prisma } from './lib/prisma';

async function checkActualContainers() {
    // Get the actual containers from test_import_oracle.csv
    const containers = await prisma.container.findMany({
        where: {
            containerNumber: {
                in: ['MAEU6057620', 'MAEU2162211', 'MAEU6316150', 'MAEU4334348', 'MAEU3571037']
            }
        },
        include: {
            events: {
                orderBy: { eventDateTime: 'desc' },
                take: 2
            }
        }
    });

    console.log(`\n=== FOUND ${containers.length} CONTAINERS ===\n`);

    containers.forEach(c => {
        console.log(`📦 ${c.containerNumber}`);
        console.log(`   Status: ${c.currentStatus || 'N/A'}`);
        console.log(`   Location: ${c.currentLocation || 'N/A'}`);
        console.log(`   Carrier: ${c.carrier || 'N/A'}`);
        console.log(`   Type: ${c.containerType || 'N/A'}`);
        console.log(`   Exception: ${c.hasException ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`   Last Updated: ${c.statusLastUpdated?.toISOString() || 'N/A'}`);
        console.log(`   Events Recorded: ${c.events.length}`);
        if (c.events.length > 0) {
            c.events.forEach(e => {
                console.log(`     - ${e.stageName} @ ${e.location} (${e.eventDateTime.toISOString()})`);
            });
        }
        console.log('');
    });

    // Also check the import log
    const importLog = await prisma.importLog.findFirst({
        where: {
            fileName: { contains: 'test_sim' }
        },
        orderBy: { importedOn: 'desc' }
    });

    if (importLog) {
        console.log('=== IMPORT LOG ===');
        console.log(`File: ${importLog.fileName}`);
        console.log(`Status: ${importLog.status}`);
        console.log(`Rows Processed: ${importLog.rowsProcessed}`);
        console.log(`AI Analysis Available: ${importLog.aiAnalysis ? 'YES' : 'NO'}`);
    }
}

checkActualContainers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
