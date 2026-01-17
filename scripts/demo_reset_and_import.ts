
import { PrismaClient } from '@prisma/client';
import { orchestrateImport } from '../lib/import-orchestrator';
import { updateStatus } from './simulation-utils';

const prisma = new PrismaClient();
const FILE_PATH = "C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\Horizon Tracking Report.xlsx";

async function main() {
    updateStatus({ step: 'RESET', progress: 5, message: 'Wiping Database...', metrics: {} });
    console.log("⚠️  RESETTING DATABASE...");

    try {
        await prisma.agentProcessingLog.deleteMany();
        await prisma.activityLog.deleteMany();
        await prisma.containerEvent.deleteMany();
        await prisma.shipmentContainer.deleteMany();
        await prisma.shipment.deleteMany();
        await prisma.container.deleteMany();
        await prisma.rawRow.deleteMany();
        await prisma.importLog.deleteMany();
    } catch (e) {
        console.error("Wipe failed", e);
    }
    console.log("✅ Database Wiped.");

    updateStatus({ step: 'BASELINE', progress: 10, message: 'Running Baseline Import (Slow)...' });
    console.log("\n--- STEP 1: INITIAL IMPORT (Baseline) ---");
    const result1 = await orchestrateImport(
        FILE_PATH,
        "Horizon Tracking Report.xlsx"
    );
    console.log(`Summary: ${result1.containersCreated} containers created.`);

    // Check Metrics
    const logs = await prisma.agentProcessingLog.findMany({
        where: { stage: 'AUDITOR', container: { importLogId: result1.importLogId } }
    });

    let totalUnmapped = 0;
    logs.forEach(l => {
        const out = l.output as any;
        const list = (l.discrepancies as any)?.unmapped || out?.unmapped || out?.unmappedFields || [];
        totalUnmapped += Array.isArray(list) ? list.length : 0;
    });

    const avg = logs.length > 0 ? Math.round(totalUnmapped / logs.length) : 0;
    const captureCount = result1.containersCreated;

    // Get Source Stats
    const totalRows = await prisma.rawRow.count({ where: { importLogId: result1.importLogId } });
    const sampleRow = await prisma.rawRow.findFirst({ where: { importLogId: result1.importLogId } });
    const totalCols = sampleRow && sampleRow.data ? Object.keys(sampleRow.data as object).length : 0;

    console.log(`METRICS [BASELINE]: ~${avg} Orphaned Fields/Record.`);

    updateStatus({
        step: 'IMPROVING',
        progress: 35,
        message: 'Baseline Complete. Starting Improvement Loop...',
        metrics: {
            baseline: { capture: captureCount, orphaned: avg },
            source: {
                filename: "Horizon Tracking Report.xlsx",
                totalRows: totalRows,
                totalCols: totalCols
            }
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
