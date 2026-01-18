
import { PrismaClient } from '@prisma/client';
import { runImprovementAnalyzer } from '@/agents/improvement-analyzer';
import { updateDictionaries } from '@/agents/dictionary-updater';
import { runTranslator } from '@/agents/translator';
import { runAuditor } from '@/agents/auditor';
import { persistMappedData, updateContainerAuditMeta, applyAuditorCorrections } from '@/lib/persistence';
import { AuditorInput, AuditorOutput } from '@/types/agents';

const prisma = new PrismaClient();

export async function runImprovementJob(jobId: string) {
    console.log(`[BatchWorker] Starting Improvement Job ${jobId}`);

    const job = await prisma.improvementJob.findUnique({
        where: { id: jobId },
        include: { importLog: true }
    });

    if (!job) {
        console.error(`[BatchWorker] Job ${jobId} not found.`);
        return;
    }

    try {
        await prisma.improvementJob.update({
            where: { id: jobId },
            data: { status: 'RUNNING', startedAt: new Date(), progress: 10 }
        });

        const importLogId = job.importLogId;

        // Step 1: Analyze - Aggregate unmapped fields
        console.log('[BatchWorker] Step 1: Analyzing unmapped fields...');

        // Find Auditor logs for this import to identify unmapped fields
        const auditLogs = await prisma.agentProcessingLog.findMany({
            where: {
                stage: 'AUDITOR',
                container: { importLogId: importLogId }
            },
            select: { output: true }
        });

        const unmappedMap = new Map<string, { values: Set<any>, count: number }>();

        for (const log of auditLogs) {
            const output = log.output as any;
            if (output && output.unmapped && Array.isArray(output.unmapped)) {
                for (const item of output.unmapped) {
                    const header = item.rawField; // Assuming rawField is the header
                    // Some auditor outputs might store it differently, but AuditorOutput type says 'rawField'
                    if (header) {
                        if (!unmappedMap.has(header)) {
                            unmappedMap.set(header, { values: new Set(), count: 0 });
                        }
                        const entry = unmappedMap.get(header)!;
                        entry.count++;
                        if (entry.values.size < 5 && item.rawValue !== undefined) {
                            entry.values.add(item.rawValue);
                        }
                    }
                }
            }
        }

        const unmappedItems = Array.from(unmappedMap.entries()).map(([header, data]) => ({
            header,
            sampleValues: Array.from(data.values),
            frequency: data.count
        }));

        await prisma.improvementJob.update({ where: { id: jobId }, data: { progress: 30 } });

        // Step 2: Run Analyzer
        console.log('[BatchWorker] Step 2: Running Analyzer...');
        const analysis = await runImprovementAnalyzer({
            unmappedItems,
            context: { importLogId }
        });

        // Step 3: Update Dictionaries
        console.log('[BatchWorker] Step 3: Updating Dictionaries...');
        const updateResult = await updateDictionaries(analysis);

        await prisma.improvementJob.update({
            where: { id: jobId },
            data: {
                progress: 50,
                improvementsApplied: {
                    synonymsAdded: updateResult.synonymsAdded,
                    details: updateResult.details
                } as any
            }
        });

        // Step 4: Re-process (Translator + Auditor)
        console.log('[BatchWorker] Step 4: Re-processing Import...');

        // Load raw rows
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId },
            orderBy: { rowNumber: 'asc' }
        });

        // Run Translator with updated dictionaries
        const headers = JSON.parse(rawRows[0].data); // Assuming first row is headers if archived that way?
        // Wait, import-orchestrator passes separate headers. 
        // We usually store headers in ImportLog or just rely on rawRows structure?
        // archiveExcelFile returns headers.
        // If we don't have headers easily, we can infer from rawRows[0] assuming standard structure or we just fetch the file again?
        // rawRows schema: id, rowNumber, data (JSON).
        // If row 0 is header in Excel, rawRows usually starts from actual data?
        // Let's assume Translator needs explicit headers.
        // We can check `translator.ts` logic. It takes `headers: string[]`.
        // We can get headers from the first raw row if it was stored effectively or if we don't have them we might need to assume keys of JSON if it was keyed?
        // `archiveExcelFile` parses using `sheet_to_json`. 
        // If `sheet_to_json` was used, valid raw rows are objects.
        // The headers are the keys of the first row object.
        const firstRowData = JSON.parse(rawRows[0].data);
        const inferredHeaders = Object.keys(firstRowData);

        // Need schema fields reference same as Orchestrator
        const containerFields = [
            "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod",
            "eta", "ata", "etd", "atd", "lastFreeDay", "pieces", "weight",
            "volume", "sealNumber"
        ];
        const transitStages = await prisma.transitStage.findMany();

        const translatorOutput = await runTranslator({
            importLogId,
            headers: inferredHeaders,
            rawRows: rawRows.map(r => ({
                id: r.id,
                rowIndex: r.rowNumber,
                rawData: JSON.parse(r.data)
            })),
            existingSchemaFields: containerFields,
            transitStages: transitStages.map(s => s.stageName)
        });

        await prisma.improvementJob.update({ where: { id: jobId }, data: { progress: 70 } });

        // Step 5: Persist
        console.log('[BatchWorker] Step 5: Persisting updates...');
        const persistResult = await persistMappedData(importLogId, translatorOutput);

        // Step 6: Re-Audit
        console.log('[BatchWorker] Step 6: Re-Auditing...');
        const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));
        const simpleMapping: Record<string, string> = {};
        if (translatorOutput.schemaMapping?.fieldMappings) {
            Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
                simpleMapping[m.sourceHeader] = m.targetField;
            });
        }

        let newCaptureRateSum = 0;
        let auditedCount = 0;

        for (const container of persistResult.containers) {
            const metadata = container.metadata as any;
            const rawRowId = metadata?._internal?.rawRowId;
            const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

            const auditorInput: AuditorInput = {
                containerNumber: container.containerNumber,
                rawData: {
                    raw: { originalRow },
                    mapping: simpleMapping
                },
                databaseRow: container
            };

            const auditResult = await runAuditor(auditorInput);

            // Apply corrections / update meta
            if (auditResult.auditResult === 'FAIL' && auditResult.summary.recommendation === 'AUTO_CORRECT') {
                await applyAuditorCorrections(container.containerNumber, auditResult);
            } else {
                await updateContainerAuditMeta(container.containerNumber, auditResult, auditResult.auditResult);
            }

            const cr = parseInt(auditResult.summary.captureRate.replace('%', '') || '0');
            newCaptureRateSum += cr;
            auditedCount++;
        }

        const avgCaptureRate = auditedCount > 0 ? newCaptureRateSum / auditedCount / 100 : 0;

        // Step 7: Complete
        await prisma.improvementJob.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                progress: 100,
                finalCaptureRate: avgCaptureRate
            }
        });

        console.log(`[BatchWorker] Job ${jobId} completed.`);

    } catch (err) {
        console.error(`[BatchWorker] Job ${jobId} failed:`, err);
        await prisma.improvementJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
                error: String(err)
            }
        });
    }
}
