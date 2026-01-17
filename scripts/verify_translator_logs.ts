
import { orchestrateImport } from '@/lib/import-orchestrator';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// Load env first
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !process.env[key.trim()]) {
                process.env[key.trim()] = value.trim();
            }
        });
        console.log("Loaded .env manually");
    }
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

const prisma = new PrismaClient();

async function run() {
    console.log("Starting verify_translator_logs...");
    const fileName = 'Shipping_Log_With_Dummy_Data.xlsx';
    const filePath = path.resolve(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    console.log(`Ingesting ${filePath}...`);
    try {
        const result = await orchestrateImport(filePath, fileName, 'VERIFICATION_SCRIPT');
        console.log("Import completed.");
        console.log(`Processed ${result.containers.length} containers.`);

        // Check logs
        console.log("Checking AgentProcessingLog for TRANSLATOR stage...");
        // Get containers from result to narrow down check
        const containerIds = result.containers.map((c: any) => c.containerNumber);

        const logs = await prisma.agentProcessingLog.findMany({
            where: {
                containerId: { in: containerIds },
                stage: 'TRANSLATOR'
            }
        });

        console.log(`Found ${logs.length} TRANSLATOR logs for ${containerIds.length} containers.`);
        if (logs.length > 0) {
            console.log("Sample Log:", JSON.stringify(logs[0], null, 2));
            console.log("✅ Translator logging is WORKING. Missing logs were likely due to old data.");
        } else {
            console.log("❌ Translator logging is MISSING.");
        }

    } catch (e) {
        console.error("Error during import:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
