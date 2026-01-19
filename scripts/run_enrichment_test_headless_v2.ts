
import { orchestrateImport } from '../lib/import-orchestrator';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import util from 'util';

const logFile = fs.createWriteStream('enrichment_test.log', { flags: 'w' });
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
    const filePath = path.join(process.cwd(), 'test_enrichment_verification.xlsx');
    console.log(`Running Headless Enrichment Test with file: ${filePath}`);

    try {
        console.log("Cleaning up previous test data...");
        // Delete by importLogId related to this file if possible, or by ID
        // The importLogId will be 'test_enrichment_verification.xlsx' usually?
        // Actually orchestrateImport uses fileName as ID.

        await prisma.container.deleteMany({
            where: {
                containerNumber: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
            }
        });

        console.log("Starting Import...");
        const result = await orchestrateImport(
            filePath,
            'test_enrichment_verification.xlsx', // This becomes the importLogId
            'TEST_USER',
            { enrichDuringImport: true }
        );

        console.log("Import Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await prisma.$disconnect();
        logFile.end();
    }
}

runTest();
