import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testForwarderDashboard() {
    console.log('Testing forwarder data in dashboard query...\n');

    // Simulate the dashboard query
    const containers = await prisma.container.findMany({
        take: 5,
        orderBy: { containerNumber: 'asc' },
        select: {
            containerNumber: true,
            carrier: true,
            currentStatus: true,
            businessUnit: true,
            shipmentContainers: {
                include: {
                    shipment: {
                        select: {
                            businessUnit: true,
                            freightCost: true,
                            forwarder: true
                        }
                    }
                }
            }
        }
    });

    console.log(`Found ${containers.length} containers:\n`);

    containers.forEach((c, index) => {
        const forwarder = c.shipmentContainers?.[0]?.shipment?.forwarder || null;
        console.log(`${index + 1}. ${c.containerNumber}`);
        console.log(`   Carrier: ${c.carrier || '(not set)'}`);
        console.log(`   Forwarder: ${forwarder || '(not set)'}`);
        console.log(`   Status: ${c.currentStatus || '(not set)'}`);
        console.log('');
    });

    await prisma.$disconnect();
}

testForwarderDashboard().catch(console.error);
