
import { orchestrateImport } from '../lib/import-orchestrator';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

async function runTest() {
    const filePath = path.join(process.cwd(), 'test_enrichment_verification.xlsx');
    console.log(`Running Headless Enrichment Test with file: ${filePath}`);

    try {
        // 1. Clean up previous test data if any
        console.log("Cleaning up previous test data...");
        await prisma.container.deleteMany({
            where: {
                containerNumber: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
            }
        });

        // 2. Run Import
        console.log("Starting Import with Enrichment ENABLED...");
        await orchestrateImport(
            filePath,
            'test_enrichment_verification.xlsx',
            'TEST_USER',
            { enrichDuringImport: true }
        );

        console.log("Import Complete.");

        // 3. Verify Results
        console.log("\n>>> VERIFICATION <<<");
        const containers = await prisma.container.findMany({
            where: {
                containerNumber: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
            },
            select: {
                containerNumber: true,
                currentStatus: true,
                serviceType: true,
                aiDerived: true
            },
            orderBy: { containerNumber: 'asc' }
        });

        console.table(containers.map(c => ({
            ...c,
            aiDerived: c.aiDerived ? JSON.stringify(c.aiDerived).substring(0, 50) + "..." : "null"
        })));

        // Detailed checks
        console.log("\nDetailed Checks:");
        for (const c of containers) {
            console.log(`\nContainer: ${c.containerNumber}`);
            console.log(`  Canonical Status: ${c.currentStatus}`);
            console.log(`  Canonical ServiceType: ${c.serviceType}`);

            const ai = c.aiDerived as any;
            if (ai && ai.fields) {
                if (ai.fields.serviceType) {
                    console.log(`  AI Derived ServiceType: ${ai.fields.serviceType.value}`);
                    console.log(`  Source: ${ai.fields.serviceType.source}`);
                } else {
                    console.log(`  AI Derived ServiceType: NONE`);
                }
            } else {
                console.log(`  AI Derived: EMPTY/NULL`);
            }
        }

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
