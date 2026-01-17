
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const container = await prisma.container.findFirst({
            include: {
                events: true,
                shipmentContainers: {
                    include: {
                        shipment: true
                    }
                }
            }
        });

        if (!container) {
            console.log("No containers found in database.");
        } else {
            console.log(">>> FIRST CONTAINER RECORD <<<");
            console.log(JSON.stringify(container, null, 2));
        }
    } catch (e) {
        console.error("Error fetching container:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
