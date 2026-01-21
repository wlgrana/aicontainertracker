import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking ImportLog table for forwarder field...\n');

    // Get all import logs with their forwarder field
    const importLogs = await prisma.importLog.findMany({
        select: {
            fileName: true,
            forwarder: true,
            importedOn: true,
            status: true,
        },
        orderBy: {
            importedOn: 'desc'
        },
        take: 10
    });

    console.log(`Found ${importLogs.length} recent import logs:\n`);

    importLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.fileName}`);
        console.log(`   Forwarder: ${log.forwarder || '(not set)'}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Imported: ${log.importedOn.toISOString()}`);
        console.log('');
    });

    // Count how many have forwarder set
    const withForwarder = importLogs.filter(log => log.forwarder).length;
    const withoutForwarder = importLogs.length - withForwarder;

    console.log(`Summary:`);
    console.log(`  - With Forwarder: ${withForwarder}`);
    console.log(`  - Without Forwarder: ${withoutForwarder}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
