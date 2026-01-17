
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Analyzing Container Data...");

    // 1. Total Count
    const total = await prisma.container.count();
    console.log(`Total Containers: ${total}`);

    // 2. Breakdown by BU Presence
    const withBU = await prisma.container.count({
        where: {
            OR: [
                { businessUnit: { not: null } },
                { shipmentContainers: { some: { shipment: { businessUnit: { not: null } } } } } // Check linked shipment
            ]
        }
    });
    const withoutBU = await prisma.container.count({
        where: {
            AND: [
                { businessUnit: null },
                { shipmentContainers: { none: { shipment: { businessUnit: { not: null } } } } }
            ]
        }
    });
    console.log(`With BU: ${withBU}, Without BU: ${withoutBU}`);

    // 3. Breakdown of "With BU" by Status
    console.log("\n--- Status Breakdown for Containers WITH BU ---");
    const buContainers = await prisma.container.findMany({
        where: {
            OR: [
                { businessUnit: { not: null } },
                { shipmentContainers: { some: { shipment: { businessUnit: { not: null } } } } }
            ]
        },
        select: { currentStatus: true }
    });

    const statusCounts: Record<string, number> = {};
    buContainers.forEach(c => {
        const s = c.currentStatus || 'NULL';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    console.table(statusCounts);

    // 4. Check excluded statuses
    const EXCLUDED = ['DEL', 'DELIVERED', 'COMPLETED', 'MTY', 'RET', 'EMPTY_RETURN'];
    const hiddenCount = buContainers.filter(c => c.currentStatus && EXCLUDED.includes(c.currentStatus)).length;
    console.log(`\nContainers with BU that are HIDDEN by default 'in_transit' filter: ${hiddenCount}`);
    console.log(`Containers with BU that SHOULD show: ${buContainers.length - hiddenCount}`);

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
