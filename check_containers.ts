import { prisma } from './lib/prisma';

async function checkContainers() {
    // Get all containers from the latest import
    const containers = await prisma.container.findMany({
        where: {
            containerNumber: {
                in: ['CONT1001', 'CONT1002', 'CONT1003', 'CONT1004', 'CONT1005']
            }
        },
        include: {
            events: {
                orderBy: { eventDateTime: 'desc' },
                take: 1
            }
        }
    });

    console.log(`Found ${containers.length} test containers\n`);

    containers.forEach(c => {
        console.log(`Container: ${c.containerNumber}`);
        console.log(`  Status: ${c.currentStatus || 'N/A'}`);
        console.log(`  Location: ${c.currentLocation || 'N/A'}`);
        console.log(`  Carrier: ${c.carrier || 'N/A'}`);
        console.log(`  Type: ${c.containerType || 'N/A'}`);
        console.log(`  Exception: ${c.hasException}`);
        console.log(`  Events: ${c.events.length}`);
        if (c.events.length > 0) {
            console.log(`  Latest Event: ${c.events[0].stageName} at ${c.events[0].location}`);
        }
        console.log('');
    });
}

checkContainers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
