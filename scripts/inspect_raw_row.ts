
import { prisma } from '../lib/prisma';

async function main() {
    const id = "92b011df-c31a-4136-9183-358e702710fd";
    const row = await prisma.rawRow.findUnique({
        where: { id }
    });
    console.log(JSON.stringify(row, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
