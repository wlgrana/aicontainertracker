import { prisma } from '../lib/prisma';

async function debugLogs() {
    console.log('=== DEBUGGING IMPORT LOGS ===\n');

    const logs = await prisma.importLog.findMany({
        select: {
            fileName: true,
            importedOn: true,
            simulationLog: true
        },
        orderBy: { importedOn: 'desc' },
        take: 10
    });

    console.log(`Found ${logs.length} ImportLog records:\n`);

    logs.forEach((log, index) => {
        console.log(`\n--- Log ${index + 1} ---`);
        console.log(`fileName: "${log.fileName}"`);
        console.log(`importedOn: ${log.importedOn}`);
        console.log(`simulationLog exists: ${!!log.simulationLog}`);
        console.log(`simulationLog length: ${log.simulationLog?.length || 0}`);

        if (log.simulationLog) {
            console.log(`simulationLog preview (first 200 chars):`);
            console.log(log.simulationLog.substring(0, 200));
        }
    });

    await prisma.$disconnect();
}

debugLogs().catch(console.error);
