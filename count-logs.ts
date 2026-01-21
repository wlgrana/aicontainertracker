import { prisma } from './lib/prisma';

async function countLogs() {
    const count = await prisma.importLog.count();
    console.log(`\nTotal ImportLog records: ${count}\n`);

    const all = await prisma.$queryRaw`SELECT "fileName" FROM "ImportLog" ORDER BY "importedOn" DESC`;
    console.log('All file names:', all);

    await prisma.$disconnect();
}

countLogs().catch(console.error);
