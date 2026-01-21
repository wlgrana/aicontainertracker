import { prisma } from './lib/prisma';

async function checkImportLogs() {
    const logs = await prisma.importLog.findMany({
        select: {
            fileName: true,
            importedOn: true,
            rowsProcessed: true
        },
        orderBy: { importedOn: 'desc' },
        take: 10
    });

    console.log(`Found ${logs.length} import logs:`);
    logs.forEach((log, i) => {
        console.log(`${i + 1}. "${log.fileName}" - ${log.importedOn.toLocaleString()} - ${log.rowsProcessed} rows`);
    });
}

checkImportLogs()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
