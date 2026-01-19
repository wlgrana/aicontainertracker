
import { prisma } from '../lib/prisma';

async function main() {
    const id = "MSCU1234567";
    const c = await prisma.container.findUnique({
        where: { containerNumber: id }
    });
    console.log(JSON.stringify(c, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
