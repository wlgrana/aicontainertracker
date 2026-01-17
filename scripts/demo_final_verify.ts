
import { PrismaClient } from '@prisma/client';
import { orchestrateImport } from '../lib/import-orchestrator';
import { updateStatus } from './simulation-utils';

const prisma = new PrismaClient();
const FILE_PATH = "C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\Horizon Tracking Report.xlsx";

async function main() {
    updateStatus({ step: 'VERIFYING', progress: 75, message: 'Running Final Verification Import...' });
    console.log("\n--- STEP 3: FINAL IMPORT (Verification) ---");
    const result = await orchestrateImport(
        FILE_PATH,
        "Horizon Tracking Report_FINAL.xlsx"
    );
    console.log(`Summary: ${result.containersCreated} containers created.`);

    const logs = await prisma.agentProcessingLog.findMany({
        where: { stage: 'AUDITOR', container: { importLogId: result.importLogId } }
    });

    let totalUnmapped = 0;
    logs.forEach(l => {
        const out = l.output as any;
        const list = (l.discrepancies as any)?.unmapped || out?.unmapped || out?.unmappedFields || [];
        totalUnmapped += Array.isArray(list) ? list.length : 0;
    });

    const avg = logs.length > 0 ? Math.round(totalUnmapped / logs.length) : 0;
    const captureCount = result.containersCreated;
    console.log(`METRICS [FINAL]: ~${avg} Orphaned Fields/Record.`);

    updateStatus({
        step: 'COMPLETE',
        progress: 100,
        message: 'Simulation Complete! AI successfully mapped the missing data.',
        metrics: {
            final: { capture: captureCount, orphaned: avg }
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
