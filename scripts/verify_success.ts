
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log("\n>>> VERIFYING SIMULATION RESULTS <<<\n");

    // 1. Check Container Data (Imports)
    const containers = await prisma.container.findMany();
    console.log(`[Database] Total Containers: ${containers.length}`);

    if (containers.length === 0) {
        console.error("❌ FAILURE: No containers found in database. Import failed.");
    } else {
        console.log("✅ SUCCESS: Data Import Verified.");
        console.log("Sample Container:");
        const sample = containers[0];
        console.log(`- Number: ${sample.containerNumber}`);
        console.log(`- Status: ${sample.currentStatus}`);
        console.log(`- BU: ${sample.businessUnit}`);
    }

    // 2. Check Unmapped Fields (Learner Verification)
    // We expect the Learner to have identified "SERV TYPE", "TRUCKER APPT", etc.
    // Check if new dictionary entries were created OR if AgentProcessingLog has new learnings.

    // Check AgentProcessingLog for 'LEARNER' or 'IMPROVEMENT'
    // Actually our simulation step 5 logs to 'IMPROVEMENT_REVIEW' status but doesn't explicitly save to AgentProcessingLog in that script (it updates dictionaries directly).
    // Let's check the logs/simulation.log for learner output.

    const logPath = path.join(process.cwd(), 'logs', 'simulation.log');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8');
        if (content.includes("Learned") || content.includes("new synonyms")) {
            console.log("✅ SUCCESS: Learning Engine Verified (Found learning logs).");
        } else if (content.includes("No unmapped fields found")) {
            console.log("⚠️ NOTICE: Learning Engine ran but found no new fields.");
        } else {
            console.log("⚠️ CHECK: Review logs manually for Step 5 output.");
        }
    } else {
        console.log("⚠️ Log file missing, cannot verify learning text.");
    }

    await prisma.$disconnect();
}

main().catch(console.error);
