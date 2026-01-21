import { prisma } from './lib/prisma';

async function checkContainer() {
    const container = await prisma.container.findUnique({
        where: { containerNumber: 'CCLU5276668' },
        select: {
            containerNumber: true,
            aiOperationalStatus: true,
            currentStatus: true,
            deliveryDate: true,
            emptyReturnDate: true,
            gateOutDate: true,
            ata: true
        }
    });

    console.log('Container CCLU5276668:');
    console.log(JSON.stringify(container, null, 2));
}

checkContainer()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
