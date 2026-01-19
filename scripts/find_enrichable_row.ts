
import { prisma } from '../lib/prisma';

async function main() {
    console.log("Searching for rows with 'FCL' or 'LCL'...");
    const rows = await prisma.rawRow.findMany({
        where: {
            data: { contains: 'FCL', mode: 'insensitive' }
        },
        take: 5
    });

    if (rows.length === 0) {
        console.log("No FCL rows found. checking LCL...");
        const lclRows = await prisma.rawRow.findMany({
            where: {
                data: { contains: 'LCL', mode: 'insensitive' }
            },
            take: 5
        });
        if (lclRows.length === 0) console.log("No LCL rows found either.");
        else console.log("LCL Rows:", JSON.stringify(lclRows, null, 2));
    } else {
        console.log("FCL Rows:", JSON.stringify(rows, null, 2));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
