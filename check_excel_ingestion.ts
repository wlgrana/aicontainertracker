import { prisma } from './lib/prisma';
import fs from 'fs';

async function checkRecentIngestion() {
    const logFile = 'ingestion_verification.log';
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\r\n');
    };

    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    log("=== CHECKING RECENT INGESTION ===\n");

    const latestImport = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' },
        include: {
            rawRows: { take: 5 }
        }
    });

    if (!latestImport) {
        log("❌ No import logs found.");
        return;
    }

    log(`Latest Import: ${latestImport.fileName}`);
    log(`Status: ${latestImport.status}`);
    log(`Rows Processed: ${latestImport.rowsProcessed}`);
    log(`Imported On: ${latestImport.importedOn.toISOString()}\n`);

    const recentContainers = await prisma.container.findMany({
        orderBy: { statusLastUpdated: 'desc' },
        take: 20,
        include: {
            events: {
                orderBy: { eventDateTime: 'desc' },
                take: 1
            }
        }
    });

    if (recentContainers.length === 0) {
        log("❌ No containers found in the database.");
        return;
    }

    log(`Found ${recentContainers.length} recent containers:\n`);

    recentContainers.forEach(c => {
        log(`📦 ${c.containerNumber}`);
        log(`   Status: ${c.currentStatus || 'N/A'}`);
        log(`   Location: ${c.currentLocation || 'N/A'}`);
        log(`   Carrier: ${c.carrier || 'N/A'}`);
        log(`   Last Updated: ${c.statusLastUpdated?.toISOString() || 'N/A'}`);
        if (c.events.length > 0) {
            log(`   Latest Event: ${c.events[0].stageName} at ${c.events[0].location}`);
        }
        log('');
    });
}

checkRecentIngestion()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
