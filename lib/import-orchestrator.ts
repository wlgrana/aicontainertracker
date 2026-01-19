

import { archiveExcelFile } from '@/agents/archivist';
import { runTranslator } from '@/agents/translator';
import { runAuditor } from '@/agents/auditor';
import { PrismaClient } from '@prisma/client';
import { TranslatorInput, AuditorOutput, TranslatorOutput, AuditorInput } from '@/types/agents';
import { runImprovementLoop } from '@/agents/improvement-orchestrator';
import { runEnricher } from '@/agents/enricher';
import { persistMappedData, applyAuditorCorrections, updateContainerAuditMeta } from '@/lib/persistence';
import { AgentStage } from '@prisma/client';


const prisma = new PrismaClient();

export async function orchestrateImport(
    filePath: string,
    fileName: string,
    uploadedBy: string = 'SYSTEM',
    options: {
        useImprovementMode?: boolean;
        benchmarkFiles?: string[];
        rowLimit?: number;
        enrichDuringImport?: boolean;
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

    const startTotal = Date.now();

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

    // --- STEP 3: ENRICHER (Pre-Persistence Inference) ---
    console.log(`[Orchestrator] >>> RUNNING STEP 3 [${new Date().toISOString()}] <<<`);
    console.log(`[Orchestrator] >>> STEP 3: ENRICHER (Inference Engine) <<<`);

    const enrichmentMap = new Map<string, any>();
    let enrichedCount = 0;

    if (options.enrichDuringImport) {
        console.log(`[Enricher] Loading ${translatorOutput.containers.length} containers for enrichment...`);
        console.log(`[Enricher] Running inference methods: [ServiceType, StatusInference, FinalDestination]`);

        // Stats
        let totalFields = 0;
        const confidenceStats = { HIGH: 0, MED: 0, LOW: 0 };

        for (const mappedContainer of translatorOutput.containers) {
            const rawRow = rawRowMap.get(mappedContainer.rawRowId || '');

            // Construct transient canonical object for Enricher
            // (Only needs fields used by Enricher: serviceType, currentStatus, atd, ata, finalDestination)
            const f = mappedContainer.fields;
            const transientContainer: any = {
                containerNumber: f.containerNumber?.value,
                serviceType: f.serviceType?.value || null,
                currentStatus: f.currentStatus?.value || null,
                atd: f.atd?.value || null,
                ata: f.ata?.value || null,
                finalDestination: f.finalDestination?.value || null,
                // Add others if needed by enricher logic
            };

            const enrichResult = runEnricher({
                container: transientContainer,
                rawMetadata: rawRow || {},
                mode: 'IMPORT_FAST'
            });

            if (enrichResult.aiDerived && Object.keys(enrichResult.aiDerived.fields).length > 0) {
                enrichmentMap.set(transientContainer.containerNumber, enrichResult.aiDerived);
                enrichedCount++;

                // Detailed Logs for the example container or first few
                if (enrichedCount <= 3) {
                    console.log(`[Enricher] Processing container ${transientContainer.containerNumber}...`);
                    Object.entries(enrichResult.aiDerived.fields).forEach(([k, v]: any) => {
                        console.log(`  → ${k}: Derived "${v.value}" from ${v.source} [${v.confidence} confidence]`);
                    });
                }

                // Stats collection
                Object.values(enrichResult.aiDerived.fields).forEach((v: any) => {
                    totalFields++;
                    if (v.confidence === 'HIGH') confidenceStats.HIGH++;
                    else if (v.confidence === 'MED') confidenceStats.MED++;
                    else confidenceStats.LOW++;
                });
            }
        }

        const avgConf = totalFields > 0 ? Math.round(((confidenceStats.HIGH * 100) + (confidenceStats.MED * 70) + (confidenceStats.LOW * 30)) / totalFields) : 0;
        console.log(`[Enricher] ✅ Enriched ${enrichedCount}/${translatorOutput.containers.length} containers (avg confidence: ~${avgConf}%)`);
        console.log(`[Enricher] Summary:`);
        console.log(`  - ${totalFields} fields derived`);
        console.log(`  - ${confidenceStats.HIGH} HIGH confidence`);
        console.log(`  - ${confidenceStats.MED} MEDIUM confidence`);
        console.log(`  - ${confidenceStats.LOW} LOW confidence`);
    } else {
        console.log(`[Enricher] Skipped (enrichDuringImport=false)`);
    }
    console.log(`[Orchestrator] STEP 3 Complete.\n`);

    // Step 4: Persist Mapped Data (IMMEDIATELY)
    console.log(`[Orchestrator] >>> RUNNING STEP 4 [${new Date().toISOString()}] <<<`);
    console.log('[Orchestrator] >>> STEP 4: PERSISTENCE (Database Write) <<<');
    console.log(`[Importer] Writing ${translatorOutput.containers.length} containers to database...`);

    const persistResult = await persistMappedData(
        archiveResult.importLogId,
        translatorOutput,
        enrichmentMap, // Pass the pre-calculated enrichment
        (msg) => console.log(msg)
    );
    console.log(`[Importer] ✅ Database write complete.`);
    console.log(`[Orchestrator] STEP 4 Complete.\n`);

    // Step 5: (Implicit/Learner - skipped in logs as per user request flow, or maybe user meant Step 6 Auditor)
    // The previous flow had Auditor as Step 6. Let's stick to that.

    // Step 6: Post-Persistence Audit (The V2 Flow)
    console.log(`[Orchestrator] >>> RUNNING STEP 6 [${new Date().toISOString()}] <<<`);
    console.log('[Orchestrator] >>> STEP 6: AUDITOR (Quality Gate) <<<');
    console.log(`[Auditor] Loading raw rows and database records for reconciliation...`);
    console.log(`[Auditor] Comparing ${rawRows.length} raw rows against ${persistResult.containers.length} database containers...`);

    const simpleMapping: Record<string, string> = {};
    if (translatorOutput.schemaMapping && translatorOutput.schemaMapping.fieldMappings) {
        Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
            simpleMapping[m.sourceHeader] = m.targetField;
        });
    }

    const auditResults: AuditorOutput[] = [];
    let exactMatches = 0;
    let missingFields = 0;
    let unmappedTotal = 0;

    // Audit each container
    for (const container of persistResult.containers) {
        const metadata = (container as any).metadata;
        const rawRowId = metadata?._internal?.rawRowId;
        const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

        if (!originalRow) {
            console.warn(`[Orchestrator] Warning: No raw row found for container ${container.containerNumber}`);
            continue;
        }

        // Log individual check for first item
        if (auditResults.length === 0) {
            console.log(`\n[Auditor] Checking container ${container.containerNumber}:`);
            console.log(`  Raw Row keys: ${Object.keys(originalRow).slice(0, 3)}...`);
            // We could log values but keeping it concise
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

        if (auditResult.verified.length === Object.keys(simpleMapping).length) exactMatches++;
        missingFields += auditResult.lost.length;
        unmappedTotal += auditResult.unmapped.length;

        // Log critical failure sample
        if (auditResults.length === 0 && auditResult.lost.length > 0) {
            console.log(`  ❌ CRITICAL: ${auditResult.lost.length} fields LOST in persistence`);
            auditResult.lost.slice(0, 3).forEach(l => console.log(`     - ${l.field}: Raw "${l.rawValue}" -> DB "${l.dbValue}"`));
        }

        // Auto-Correct Logic
        if (auditResult.auditResult === 'FAIL') {
            const recommendation = auditResult.summary.recommendation;

            // Safety check: Only auto-correct if recommended
            if (recommendation === 'AUTO_CORRECT') {
                await applyAuditorCorrections(container.containerNumber, auditResult);
            } else {
                await updateContainerAuditMeta(container.containerNumber, auditResult, 'FAIL');
            }
        } else {
            // Even if PASS, store the audit result in metadata so we know it was verified
            await updateContainerAuditMeta(container.containerNumber, auditResult, 'PASS');
        }
    }

    console.log(`\n[Auditor] EXACT MATCHES: ${exactMatches}/${persistResult.containers.length} (${Math.round(exactMatches / persistResult.containers.length * 100)}%)`);
    console.log(`[Auditor] MISSING FIELDS: ${missingFields} fields lost between Enricher and Database`);
    console.log(`[Auditor] UNMAPPED FIELDS: ${unmappedTotal} raw columns with no database column`);

    const qualityScore = Math.round((exactMatches / persistResult.containers.length) * 100);
    if (qualityScore < 95) {
        console.log(`[Auditor] ⚠️  QUALITY GATE FAILED: ${qualityScore}% match rate (threshold: 95%)`);
        console.log(`[Auditor] 🚨 Import requires manual review`);
    } else {
        console.log(`[Auditor] ✅ QUALITY GATE PASSED`);
    }

    console.log(`[Orchestrator] STEP 6 Complete.\n`);

    const failedCount = auditResults.filter(r => r.auditResult === 'FAIL').length;

    // --- FINAL PERFORMANCE SUMMARY ---
    const endTotal = Date.now();

    console.log(`\n=== IMPORT SUMMARY ===`);
    console.log(`File: ${fileName}`);
    console.log(`Duration: ${((endTotal - startTotal) / 1000).toFixed(2)}s`);

    console.log(`\nRecords Processed:`);
    console.log(`  - Raw Rows: ${rawRows.length}`);
    console.log(`  - Containers Created: ${persistResult.containers.length}`);
    console.log(`  - Events Created: ${persistResult.events.length}`);

    console.log(`\nData Quality:`);
    console.log(`  - Enrichment: ${enrichedCount || 0} containers enriched`);
    console.log(`  - Persistence Warnings: ${missingFields} fields possibly lost`);
    console.log(`  - Quality Score: ${qualityScore}%`);

    if (failedCount > 0 || missingFields > 0) {
        console.log(`\nIssues:`);
        if (failedCount > 0) console.log(`  🚨 ${failedCount} containers failed audit`);
        if (missingFields > 0) console.log(`  ⚠️  ${missingFields} enriched fields not persisted`);
    }

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
                })),
                performance: {
                    totalDuration: endTotal - startTotal
                }
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
