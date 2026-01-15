
import 'dotenv/config';
import { analyzeContainer } from '../app/actions/analyzeContainer';
import { prisma } from '../lib/prisma';

async function runTest() {
    const containerNum = 'SEKU9074543';
    console.log(`Running analysis for ${containerNum}...`);

    try {
        const result = await analyzeContainer(containerNum);
        console.log("Analysis Result JSON Keys:", Object.keys(result));
        if (result.structured_metadata) {
            console.log("Structured Metadata generated:", result.structured_metadata);
        } else {
            console.log("❌ NO structured_metadata in response!");
        }

        console.log("\nChecking Database Storage...");

        // Wait a moment for persistence if async (though it's awaited in the action)

        const rawContainer = await prisma.$queryRaw`
            SELECT "containerNumber", "healthScore", "daysInTransit", "demurrageExposure", "aiLastUpdated" 
            FROM "Container" 
            WHERE "containerNumber" = ${containerNum}
        `;

        console.log("DB Row:", rawContainer);

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

runTest()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
