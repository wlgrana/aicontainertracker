import { prisma } from './lib/prisma';

async function checkImportLogs() {
    const logs = await prisma.importLog.findMany({
        orderBy: { importedOn: 'desc' }
    });

    console.log('\n=== ALL IMPORT LOGS IN DATABASE ===');
    console.log(`Total count: ${logs.length}`);
    logs.forEach((log, index) => {
        console.log(`\n${index + 1}. fileName: "${log.fileName}"`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Imported: ${log.importedOn}`);
        console.log(`   Rows: ${log.rowsProcessed}`);
        console.log(`   importedBy: ${log.importedBy}`);
        console.log(`   fileURL: ${log.fileURL}`);
    });

    await prisma.$disconnect();
}

checkImportLogs().catch(console.error);
