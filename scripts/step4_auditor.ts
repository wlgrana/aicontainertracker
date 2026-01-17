
import { PrismaClient } from '@prisma/client';
import { runAuditor } from '../agents/auditor';
import { updateStatus, getActiveFilename } from './simulation-utils';

const prisma = new PrismaClient();
const FILENAME = getActiveFilename();

async function main() {
    try {
        console.log(`>>> STEP 4: AUDITOR (File: "${FILENAME}") <<<`);
        updateStatus({ step: 'AUDITOR', progress: 60, message: 'Auditing Data Quality...' });

        // Query Containers directly instead of via ShipmentContainer to ensure we capture all imported data
        const containers = await prisma.container.findMany({
            where: { importLogId: FILENAME }
        });

        const rawRows = await prisma.rawRow.findMany({ where: { importLogId: FILENAME } });
        const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));

        let verifiedCount = 0;
        let discrepancyCount = 0;
        let sampleDiscrepancy: any = null;
        let totalUnmapped = 0;

        // User requested focused analysis on baseline, so we check a sample to save time/cost
        const sampleSize = 5;
        const containersToAudit = containers.slice(0, sampleSize);
        console.log(`Auditing sample of ${containersToAudit.length} containers (from ${containers.length} total)...`);

        // Capture a rich sample for UI "Deep Dive"
        // We prefer a container that has Unmapped fields to show "Opportunity"
        let sampleAnalysis: any = null;

        for (const container of containersToAudit) {
            const rawRowId = (container.metadata as any)?._internal?.rawRowId;
            const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

            const auditResult = await runAuditor({
                containerNumber: container.containerNumber,
                rawData: { raw: { originalRow }, mapping: {} },
                databaseRow: container as any
            });

            if (auditResult.auditResult === 'PASS') verifiedCount++;
            else {
                discrepancyCount++;
                if (!sampleDiscrepancy) sampleDiscrepancy = auditResult.summary;
            }

            const unmappedCount = (auditResult.unmapped || []).length;
            totalUnmapped += unmappedCount;

            // Pick the first interesting sample (has unmapped fields), or fallback to first ever
            if (!sampleAnalysis || (unmappedCount > 0 && sampleAnalysis.unmapped.length === 0)) {
                sampleAnalysis = {
                    container: container.containerNumber,
                    raw: originalRow, // The full raw data
                    db: container,    // The full DB record
                    unmapped: auditResult.unmapped.map(u => u.rawField), // Fields missed
                    captureRate: auditResult.summary.captureRate
                };
            }
        }

        const avgOrphaned = containers.length > 0 ? Math.round(totalUnmapped / containers.length) : 0;

        // Update ImportLog Summary
        // Update ImportLog Summary
        // WRAP IN TRY/CATCH to prevent crashing if log is missing
        try {
            await prisma.importLog.update({
                where: { fileName: FILENAME },
                data: {
                    summary: {
                        auditStats: {
                            verified: verifiedCount,
                            failed: discrepancyCount,
                            total: containers.length
                        }
                    }
                }
            });
        } catch (e) {
            console.warn(`[WARN] Could not update ImportLog "${FILENAME}": ${(e as Error).message}`);
        }

        updateStatus({
            step: 'AUDITOR_COMPLETE',
            progress: 75,
            message: `Auditor Complete. ${verifiedCount} verified, ${discrepancyCount} issues.`,
            metrics: {
                baseline: { capture: containers.length, orphaned: avgOrphaned }
            },
            agentData: {
                auditor: {
                    verifiedCount,
                    discrepancyCount,
                    sampleDiscrepancy,
                    sampleAnalysis // <--- New Field
                }
            }
        });
        console.log("STEP 4 Complete.");

    } catch (error) {
        console.error("Step 4 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
