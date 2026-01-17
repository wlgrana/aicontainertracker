
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.importLog.findMany({
        where: { fileName: { contains: 'messy' } },
        include: { rawRows: { take: 1 } }
    });

    for (const log of logs) {
        console.log(`\n📄 File: ${log.fileName}`);
        if (log.rawRows.length > 0) {
            console.log(`Headers: ${log.rawRows[0].originalHeaders}`);
            console.log(`Sample Data: ${log.rawRows[0].data}`);
        } else {
            console.log("No rows found.");
        }
    }
}

main();
