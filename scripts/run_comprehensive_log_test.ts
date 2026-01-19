
import { orchestrateImport } from '../lib/import-orchestrator';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import util from 'util';

const logFile = fs.createWriteStream('logs/comprehensive_test_run.log', { flags: 'w' });
const logStdout = process.stdout;

console.log = function (...args) {
    logFile.write(util.format.apply(null, args) + '\n');
    logStdout.write(util.format.apply(null, args) + '\n');
};
console.error = function (...args) {
    logFile.write(util.format.apply(null, args) + '\n');
    logStdout.write(util.format.apply(null, args) + '\n');
};

const prisma = new PrismaClient();

async function runTest() {
    // Enable Trace Logging
    process.env.LOG_LEVEL = 'trace';

    const filePath = path.join(process.cwd(), 'test_enrichment_verification.xlsx');
    console.log(`Running Comprehensive Logging Test with file: ${filePath}`);

    try {
        console.log("Cleaning up previous test data...");
        // Cleanup specific to this test file
        // 0. Delete AgentProcessingLogs first (Foreign Key Constraint)
        await prisma.agentProcessingLog.deleteMany({
            where: {
                containerId: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
            }
        });

        // 1. Delete containers
        await prisma.container.deleteMany({
            where: {
                containerNumber: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
            }
        });
        // 1.5 Delete RawRows (Foreign Key Constraint)
        await prisma.rawRow.deleteMany({
            where: { importLogId: 'test_enrichment_verification.xlsx' }
        });

        // 2. Clear import log entry to look fresh
        await prisma.importLog.deleteMany({
            where: { fileName: 'test_enrichment_verification.xlsx' }
        });

        console.log("Starting Import...");
        const result = await orchestrateImport(
            filePath,
            'test_enrichment_verification.xlsx',
            'TEST_USER_COMPREHENSIVE',
            { enrichDuringImport: true }
        );

        console.log("Import Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await prisma.$disconnect();
        console.log("Log file closed. saved to logs/comprehensive_test_run.log");
        logFile.end();
    }
}

runTest();
