import { prisma } from './lib/prisma';

async function checkExcelContainers() {
    console.log("=== CHECKING EXCEL CONTAINERS ===\n");

    // Look for containers that were likely in the Excel file 
    // based on the previous ingestion attempt which logged 50 rows.
    // We'll check for the most recently updated containers.

    const count = await prisma.container.count();
    console.log(`Total Containers in DB: ${count}\n`);

    const recentContainers = await prisma.container.findMany({
        orderBy: { statusLastUpdated: 'desc' },
        take: 5,
        include: {
            events: {
                orderBy: { eventDateTime: 'desc' },
                take: 1
            }
        }
    });

    if (recentContainers.length === 0) {
        console.log("❌ No containers found.");
        return;
    }

    console.log("Most Recent Containers:");
    recentContainers.forEach(c => {
        console.log(`📦 ${c.containerNumber}`);
        console.log(`   Status: ${c.currentStatus}`);
        console.log(`   Location: ${c.currentLocation}`);
        console.log(`   Last Updated: ${c.statusLastUpdated?.toISOString()}`);
        console.log('');
    });

    // Check Import Log status
    const importLog = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' }
    });

    if (importLog) {
        console.log("Latest Import Log:");
        console.log(`File: ${importLog.fileName}`);
        console.log(`Status: ${importLog.status}`);
        console.log(`Rows: ${importLog.rowsProcessed} (Succeeded: ${importLog.rowsSucceeded}, Failed: ${importLog.rowsFailed})`);
    }
}

checkExcelContainers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
