
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying Dashboard Logic update...");

    const where: any = {};

    // Mimic the new 'in_transit' logic
    if (!where.AND) where.AND = [];
    where.AND.push({
        OR: [
            { currentStatus: { notIn: ['DEL', 'DELIVERED', 'COMPLETED', 'MTY', 'RET', 'EMPTY_RETURN'] } },
            { currentStatus: null }
        ]
    });

    const count = await prisma.container.count({ where });
    console.log(`Containers matching new logic: ${count}`);

    const total = await prisma.container.count();
    console.log(`Total containers in DB: ${total}`);

    if (count === total) {
        console.log("SUCCESS: All containers matched (assuming none are actually completed/delivered yet).");
    } else {
        console.log(`Difference: ${total - count} containers (Likely legitimately delivered/completed).`);
    }

    // Verify specifically the ones with BU are included
    const buContainers = await prisma.container.count({
        where: {
            AND: [
                where, // The dashboard filter
                {
                    OR: [
                        { businessUnit: { not: null } },
                        { shipmentContainers: { some: { shipment: { businessUnit: { not: null } } } } }
                    ]
                }
            ]
        }
    });
    console.log(`Visible containers WITH BU: ${buContainers} (Should be 5)`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
