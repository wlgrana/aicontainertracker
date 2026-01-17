
import { PrismaClient } from '@prisma/client';
import { archiveExcelFile } from '../agents/archivist';
import { runTranslator } from '../agents/translator';
import { runAuditor } from '../agents/auditor';
import { persistMappedData } from '../lib/import-orchestrator';
import { updateStatus } from './simulation-utils';
import { AuditorOutput } from '../types/agents';

const prisma = new PrismaClient();
const FILE_PATH = "C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\Horizon Tracking Report.xlsx";

async function main() {
    // --- RESET ---
    updateStatus({ step: 'RESET', progress: 5, message: 'Wiping Database...' });
    console.log("⚠️  RESETTING DATABASE...");
    await prisma.agentProcessingLog.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.containerEvent.deleteMany();
    await prisma.shipmentContainer.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.container.deleteMany();
    await prisma.rawRow.deleteMany();
    await prisma.importLog.deleteMany();
    console.log("✅ Database Wiped.");


    // --- ARCHIVIST ---
    updateStatus({ step: 'ARCHIVIST', progress: 10, message: 'Ingesting Raw Excel Data...', agentData: {} });
    console.log("[Archivist] Running...");

    const archiveResult = await archiveExcelFile({
        filePath: FILE_PATH,
        fileName: "Horizon Tracking Report.xlsx",
        uploadedBy: "SIMULATION"
    });

    const rawRows = await prisma.rawRow.findMany({
        where: { importLogId: archiveResult.importLogId },
        orderBy: { rowNumber: 'asc' }
    });

    // Extract info for dashboard
    const sampleRow = rawRows.length > 0 ? JSON.parse(rawRows[0].data) : {};
    const rowCount = rawRows.length;
    const headers = archiveResult.headers || Object.keys(sampleRow);
    const totalCols = headers.length;

    updateStatus({
        step: 'TRANSLATOR', // Ready for next step
        progress: 25,
        message: `Ingested ${rowCount} rows. Starting Translation...`,
        metrics: { source: { filename: "Horizon Tracking Report.xlsx", totalRows: rowCount, totalCols: totalCols } },
        agentData: {
            archivist: {
                filename: "Horizon Tracking Report.xlsx",
                rowCount: rowCount,
                headers: headers.slice(0, 5), // Show first 5
                sampleRow: sampleRow // Pass one raw row
            }
        }
    });


    // --- TRANSLATOR ---
    console.log("[Translator] Running...");

    // Prep args
    const containerFields = [
        "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod",
        "eta", "ata", "etd", "atd", "lastFreeDay", "pieces", "weight",
        "volume", "sealNumber"
    ];
    const transitStages = await prisma.transitStage.findMany();

    const translatorOutput = await runTranslator({
        importLogId: archiveResult.importLogId,
        headers: headers,
        rawRows: rawRows.map(r => ({
            id: r.id,
            rowIndex: r.rowNumber,
            rawData: JSON.parse(r.data)
        })),
        existingSchemaFields: containerFields,
        transitStages: transitStages.map(s => s.stageName)
    });

    // Create a sample container view for dashboard
    const firstMapped = translatorOutput.containers.length > 0 ? translatorOutput.containers[0] : null;

    updateStatus({
        step: 'TRANSLATOR', // Still Translator, but persisting
        progress: 50,
        message: `Mapped ${translatorOutput.containers.length} containers. Persisting...`,
        agentData: {
            translator: {
                mappedCount: translatorOutput.containers.length,
                sampleContainer: firstMapped ? {
                    containerNumber: firstMapped.fields.containerNumber?.value || 'MISSING',
                    carrier: firstMapped.fields.carrier?.value,
                    status: firstMapped.fields.currentStatus?.value
                } : null
            }
        }
    });

    // Persist
    console.log("[Orchestrator] Persisting...");
    const persistResult = await persistMappedData(archiveResult.importLogId, translatorOutput);
    const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));


    // --- AUDITOR ---
    updateStatus({ step: 'AUDITOR', progress: 60, message: 'Auditing Data Quality...' });
    console.log("[Auditor] Running...");

    const simpleMapping: Record<string, string> = {};
    if (translatorOutput.schemaMapping && translatorOutput.schemaMapping.fieldMappings) {
        Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
            simpleMapping[m.sourceHeader] = m.targetField;
        });
    }

    let verifiedCount = 0;
    let discrepancyCount = 0;
    let sampleDiscrepancy: any = null;
    let totalUnmapped = 0;

    for (const container of persistResult.containers) {
        const metadata = container.metadata as any;
        const rawRowId = metadata?._internal?.rawRowId;
        const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

        const auditResult = await runAuditor({
            containerNumber: container.containerNumber,
            rawData: { raw: { originalRow }, mapping: simpleMapping },
            databaseRow: container
        });

        if (auditResult.auditResult === 'PASS') {
            verifiedCount++;
        } else {
            discrepancyCount++;
            if (!sampleDiscrepancy) sampleDiscrepancy = auditResult.summary; // Capture first fail
        }

        // Sum unmapped for global metric
        const unmapped = (auditResult.discrepancies?.unmapped || []).length;
        totalUnmapped += unmapped;
    }

    const avgOrphaned = persistResult.containers.length > 0 ? Math.round(totalUnmapped / persistResult.containers.length) : 0;

    updateStatus({
        step: 'IMPROVING', // Baseline done
        progress: 75,
        message: 'Auditor Complete. Baseline Metrics Established.',
        metrics: {
            baseline: { capture: persistResult.containers.length, orphaned: avgOrphaned }
        },
        agentData: {
            auditor: {
                verifiedCount: verifiedCount,
                discrepancyCount: discrepancyCount,
                sampleDiscrepancy: sampleDiscrepancy
            }
        }
    });

    console.log("STEP 1 Complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
