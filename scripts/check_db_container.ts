
import { prisma } from '../lib/prisma';

async function checkContainer() {
    const containerNum = 'CXRU1180200';
    console.log(`Checking Database for ${containerNum}...`);

    try {
        const rawContainer = await prisma.$queryRaw`
            SELECT "containerNumber", "healthScore", "daysInTransit", "demurrageExposure", "aiLastUpdated" 
            FROM "Container" 
            WHERE "containerNumber" = ${containerNum}
        `;

        if (Array.isArray(rawContainer) && rawContainer.length > 0) {
            const row = rawContainer[0];
            console.log("\n--- Database Record ---");
            console.log(`Container: ${row.containerNumber}`);
            console.log(`Health Score: ${row.healthScore}`);
            console.log(`Days in Transit: ${row.daysInTransit}`);
            console.log(`Demurrage Exposure: ${row.demurrageExposure}`);
            console.log(`Last Updated: ${row.aiLastUpdated}`);
        } else {
            console.log("Container not found in DB.");
        }

    } catch (e) {
        console.error("Query Failed:", e);
    }
}

checkContainer()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
