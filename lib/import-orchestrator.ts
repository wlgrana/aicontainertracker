

import { archiveExcelFile } from '@/agents/archivist';
import { runTranslator } from '@/agents/translator';
import { runAuditor } from '@/agents/auditor';
import { PrismaClient } from '@prisma/client';
import { TranslatorInput, AuditorOutput, TranslatorOutput, AuditorInput } from '@/types/agents';
import { runImprovementLoop } from '@/agents/improvement-orchestrator';
import { persistMappedData, applyAuditorCorrections, updateContainerAuditMeta } from '@/lib/persistence';


const prisma = new PrismaClient();

export async function orchestrateImport(
    filePath: string,
    fileName: string,
    uploadedBy: string = 'SYSTEM',
    options: {
        useImprovementMode?: boolean;
        benchmarkFiles?: string[];
        rowLimit?: number;
    } = {}
) {
    if (options.useImprovementMode) {
        // Run in improvement mode
        await runImprovementLoop({
            benchmarkFiles: options.benchmarkFiles || [filePath],
            maxIterations: 50,
            targetCoverage: 0.85,
            targetOverallScore: 0.85,
            outputDir: 'artifacts/runs',
            useIsolatedDB: true,
            rowLimit: options.rowLimit
        });
        // Return dummy result for API compatibility
        return {
            importLogId: 'IMPROVEMENT_RUN',
            decision: 'APPROVED',
            containersCreated: 0,
            eventsCreated: 0,
            auditSummary: { total: 0, failed: 0 }
        };
    }

    // Step 1: Archive raw data
    console.log('[Orchestrator] Step 1: Archiving raw data...');
    const archiveResult = await archiveExcelFile({
        filePath,
        fileName,
        uploadedBy,
        rowLimit: options.rowLimit
    });

    // Step 2: Load raw rows
    const rawRows = await prisma.rawRow.findMany({
        where: { importLogId: archiveResult.importLogId },
        orderBy: { rowNumber: 'asc' }
    });

    const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));

    // Step 3: Get schema info (simplified)
    const containerFields = [
        "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod",
        "eta", "ata", "etd", "atd", "lastFreeDay", "pieces", "weight",
        "volume", "sealNumber"
    ];

    const transitStages = await prisma.transitStage.findMany();

    // Step 4: Run Translator
    console.log('[Orchestrator] Step 2: Running Translator...');
    const translatorOutput = await runTranslator({
        importLogId: archiveResult.importLogId,
        headers: archiveResult.headers,
        rawRows: rawRows.map(r => ({
            id: r.id,
            rowIndex: r.rowNumber,
            rawData: JSON.parse(r.data)
        })),
        existingSchemaFields: containerFields,
        transitStages: transitStages.map(s => s.stageName)
    });

    // Step 5: Persist Mapped Data (IMMEDIATELY)
    console.log('[Orchestrator] Step 3: Persisting initial translation to database...');
    const persistResult = await persistMappedData(
        archiveResult.importLogId,
        translatorOutput
    );

    // Step 6: Post-Persistence Audit (The V2 Flow)
    console.log('[Orchestrator] Step 4: Running Auditor V2 on persisted data...');

    const simpleMapping: Record<string, string> = {};
    if (translatorOutput.schemaMapping && translatorOutput.schemaMapping.fieldMappings) {
        Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
            simpleMapping[m.sourceHeader] = m.targetField;
        });
    }

    const auditResults: AuditorOutput[] = [];

    // Audit each container
    for (const container of persistResult.containers) {
        const metadata = container.metadata as any;
        const rawRowId = metadata?._internal?.rawRowId;
        const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

        if (!originalRow) {
            console.warn(`[Orchestrator] Warning: No raw row found for container ${container.containerNumber}`);
            continue;
        }

        const auditorInput: AuditorInput = {
            containerNumber: container.containerNumber,
            rawData: {
                raw: { originalRow },
                mapping: simpleMapping
            },
            databaseRow: container
        };

        const auditResult = await runAuditor(auditorInput);
        auditResults.push(auditResult);

        // Auto-Correct Logic
        if (auditResult.auditResult === 'FAIL') {
            const recommendation = auditResult.summary.recommendation;
            const captureRate = parseInt(auditResult.summary.captureRate.replace('%', ''));

            // Safety check: Only auto-correct if recommended
            if (recommendation === 'AUTO_CORRECT') {
                console.log(`[Orchestrator] Applying corrections for ${container.containerNumber} (Capture Rate: ${captureRate}%)...`);
                await applyAuditorCorrections(container.containerNumber, auditResult);
            } else {
                console.log(`[Orchestrator] Skipping auto-correction for ${container.containerNumber}: Recommendation is ${recommendation}`);
                // Even if we skip, we should update metadata to show it FAILED audit
                await updateContainerAuditMeta(container.containerNumber, auditResult, 'FAIL');
            }
        } else {
            // Even if PASS, store the audit result in metadata so we know it was verified
            await updateContainerAuditMeta(container.containerNumber, auditResult, 'PASS');
        }
    }

    // Step 7: Update ImportLog
    const failedCount = auditResults.filter(r => r.auditResult === 'FAIL').length;

    await prisma.importLog.update({
        where: { fileName: archiveResult.importLogId },
        data: {
            status: 'COMPLETED',
            summary: JSON.stringify({
                totalContainers: persistResult.containers.length,
                auditErrorsFound: failedCount,
                auditResults: auditResults.map(r => ({
                    container: r.containerNumber,
                    result: r.auditResult,
                    summary: r.summary
                }))
            }),
            completedAt: new Date(),
            rowsSucceeded: persistResult.containers.length,
        }
    });

    return {
        importLogId: archiveResult.importLogId,
        decision: failedCount === 0 ? 'APPROVED' : 'APPROVED_WITH_CORRECTIONS',
        containersCreated: persistResult.containers.length,
        eventsCreated: persistResult.events.length,
        auditSummary: {
            total: auditResults.length,
            failed: failedCount
        }
    };
}
