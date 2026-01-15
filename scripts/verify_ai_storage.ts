
import { prisma } from '../lib/prisma';

async function verifyStorage() {
    console.log("Verifying AI Storage in Neon DB...");

    // Find any container that has an AI assessment
    const container = await prisma.container.findFirst({
        where: {
            aiAnalysis: {
                not: null
            }
        },
        select: {
            containerNumber: true,
            aiAnalysis: true,
            aiLastUpdated: true,
            // Cast to any in case types aren't generated yet via 'prisma generate'
            // We use 'select' specifically to check if these columns exist and return data
        }
    });

    if (!container) {
        console.log("No containers found with AI Analysis. Try generating one in the UI first.");
        return;
    }

    console.log(`\nFound Container: ${container.containerNumber}`);
    console.log(`Last Updated: ${container.aiLastUpdated}`);

    // We need to query raw to see columns that might not be in the strictly typed client yet
    const rawContainer = await prisma.$queryRaw`
        SELECT container_number, health_score, days_in_transit, demurrage_exposure, ai_analysis 
        FROM "Container" 
        WHERE "containerNumber" = ${container.containerNumber}
    `;

    console.log("\n--- RAW DATABASE ROW ---");
    console.log(JSON.stringify(rawContainer, null, 2));

    const row = (rawContainer as any[])[0];

    if (row.health_score !== null || row.days_in_transit !== null) {
        console.log("\n✅ SUCCESS: Structured metadata columns are populated!");
    } else {
        console.log("\n⚠️ WARNING: Structured metadata columns seem empty. Check if the 'Mission Oracle' prompt has been run recently.");
    }
}

verifyStorage()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
