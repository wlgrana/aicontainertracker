import { prisma } from './lib/prisma';

async function checkInTransit() {
    // Check in-transit count (matching the filter logic from actions.ts)
    const inTransitCount = await prisma.container.count({
        where: {
            OR: [
                { currentStatus: { notIn: ['DEL', 'DELIVERED', 'COMPLETED', 'MTY', 'RET', 'EMPTY_RETURN'] } },
                { currentStatus: null }
            ]
        }
    });

    console.log(`In-transit containers: ${inTransitCount}`);

    // Check all statuses
    const allStatuses = await prisma.container.groupBy({
        by: ['currentStatus'],
        _count: true
    });

    console.log('\nContainers by status:');
    allStatuses.forEach(s => {
        console.log(`  ${s.currentStatus || 'NULL'}: ${s._count}`);
    });
}

checkInTransit()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
