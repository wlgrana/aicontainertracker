import { prisma } from './lib/prisma';

async function checkCount() {
    const total = await prisma.container.count();
    console.log(`Total containers in database: ${total}`);

    const containers = await prisma.container.findMany({
        select: { containerNumber: true },
        take: 100
    });

    console.log(`First 100 container numbers:`);
    containers.forEach((c, i) => console.log(`${i + 1}. ${c.containerNumber}`));
}

checkCount()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
