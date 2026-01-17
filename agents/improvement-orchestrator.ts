import fs from 'fs/promises';
import path from 'path';
import { archiveExcelFile } from './archivist';
import { runTranslator } from './translator';
import { runAuditor } from './auditor';
import { runImprovementAnalyzer } from './improvement-analyzer';
import { updateDictionaries } from './dictionary-updater';
import { PrismaClient } from '@prisma/client';

import { persistMappedData } from '@/lib/persistence';

export interface OrchestratorConfig {
    benchmarkFiles: string[];          // Paths to test Excel files
    maxIterations: number;              // Default: 50
    targetCoverage: number;             // Default: 0.90
    targetOverallScore: number;         // Default: 0.90
    outputDir: string;                  // artifacts/runs/run_XXX
    useIsolatedDB: boolean;             // If true, use staging schema (not fully implemented in this MVP, reusing main DB)
    rowLimit?: number;                  // Default: 10
}

export interface IterationResult {
    iteration: number;
    scores: {
        coverage: number;              // valid_records / total_rows
        required_field_fill: number;   // % of required fields populated
        optional_field_fill: number;   // % of optional fields populated
        avg_confidence: number;        // Average mapping confidence
        overall_score: number;         // Weighted score
    };
    metrics: {
        total_rows: number;
        valid_records: number;
        rows_with_errors: number;
        unmapped_headers: number;
        low_confidence_mappings: number;
    };
    improvements: {
        synonyms_added: number;
        pending_fields: number;
    };
    stopped: boolean;
    stop_reason?: string;
}

export async function runImprovementLoop(config: OrchestratorConfig): Promise<void> {
    console.log('🚀 Starting Self-Improving Ingestion Engine');
    console.log(`📁 Benchmark files: ${config.benchmarkFiles.length}`);
    console.log(`🎯 Target: coverage ≥ ${config.targetCoverage}, score ≥ ${config.targetOverallScore}`);
    console.log(`🔄 Max iterations: ${config.maxIterations}`);

    // Create run directory
    const runId = `run_${Date.now()}`;
    const runDir = path.join(process.cwd(), config.outputDir, runId);
    await fs.mkdir(runDir, { recursive: true });

    // Save config
    await fs.writeFile(
        path.join(runDir, 'config.json'),
        JSON.stringify(config, null, 2)
    );

    let bestIteration: IterationResult | null = null;
    let bestScore = 0;
    let noImprovementStreak = 0;

    for (let i = 1; i <= config.maxIterations; i++) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔄 ITERATION ${i}/${config.maxIterations}`);
        console.log('='.repeat(60));

        const iterationDir = path.join(runDir, `iteration_${String(i).padStart(3, '0')}`);
        await fs.mkdir(iterationDir, { recursive: true });
        await fs.mkdir(path.join(iterationDir, 'samples'), { recursive: true });
        await fs.mkdir(path.join(iterationDir, 'logs'), { recursive: true });

        const result = await runIteration(i, config, iterationDir);

        // Save iteration results
        await fs.writeFile(
            path.join(iterationDir, 'scores.json'),
            JSON.stringify(result, null, 2)
        );

        console.log(`📊 Coverage: ${(result.scores.coverage * 100).toFixed(1)}%`);
        console.log(`📊 Overall Score: ${(result.scores.overall_score * 100).toFixed(1)}%`);
        console.log(`📈 Improvements: +${result.improvements.synonyms_added} synonyms`);

        // Track best iteration and Staleness
        if (result.scores.overall_score > bestScore) {
            bestScore = result.scores.overall_score;
            bestIteration = result;
            noImprovementStreak = 0; // Reset streak

            // Save checkpoint
            const bestDir = path.join(runDir, 'best_run');
            await fs.mkdir(bestDir, { recursive: true });
            await fs.writeFile(
                path.join(bestDir, 'iteration_number.txt'),
                String(i)
            );
            await fs.writeFile(
                path.join(bestDir, 'scores.json'),
                JSON.stringify(result, null, 2)
            );

            // Copy dictionaries
            await fs.mkdir(path.join(bestDir, 'dictionaries'), { recursive: true });
            await fs.copyFile(
                path.join(process.cwd(), 'agents/dictionaries/business_units.yml'),
                path.join(bestDir, 'dictionaries/business_units.yml')
            );
            await fs.copyFile(
                path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml'),
                path.join(bestDir, 'dictionaries/container_ontology.yml')
            );
        } else {
            noImprovementStreak++;
            console.log(`⚠️  No improvement in score. Streak: ${noImprovementStreak}/3`);
        }

        // Check stop condition
        if (result.stopped) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ ${result.stop_reason}`);
            console.log('='.repeat(60));
            break;
        }

        // Check Early Stopping (Staleness)
        if (noImprovementStreak >= 3) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🛑 Stopping early: No improvement for 3 consecutive iterations.`);
            console.log('='.repeat(60));

            // Mark the result as stopped for the frontend
            result.stopped = true;
            result.stop_reason = "Optimization Stalled: No score improvement for 3 iterations.";

            // Re-save the scores.json with the stopped status
            await fs.writeFile(
                path.join(iterationDir, 'scores.json'),
                JSON.stringify(result, null, 2)
            );
            break;
        }

        // Detect regression (score drops by >5%)
        if (bestScore > 0 && result.scores.overall_score < bestScore * 0.95) {
            console.log(`⚠️  Score regressed (${result.scores.overall_score.toFixed(3)} < ${(bestScore * 0.95).toFixed(3)})`);
            console.log(`⏮️  Reverting to best iteration (${bestIteration?.iteration})`);

            // Restore dictionaries from best run
            const bestDir = path.join(runDir, 'best_run');
            await fs.copyFile(
                path.join(bestDir, 'dictionaries/business_units.yml'),
                path.join(process.cwd(), 'agents/dictionaries/business_units.yml')
            );
            await fs.copyFile(
                path.join(bestDir, 'dictionaries/container_ontology.yml'),
                path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml')
            );

            // Reset streak on revert? Or keep it? 
            // If we revert, we are technically back to "best state", but we failed to improve.
            // Let's keep the streak incremented above.
        }
    }

    // Final report
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 FINAL REPORT`);
    console.log('='.repeat(60));
    console.log(`Best Iteration: ${bestIteration?.iteration}`);
    console.log(`Best Coverage: ${(bestIteration?.scores.coverage ?? 0 * 100).toFixed(1)}%`);
    console.log(`Best Score: ${(bestScore * 100).toFixed(1)}%`);
    console.log(`Artifacts saved to: ${runDir}`);
}

async function runIteration(
    iterationNum: number,
    config: OrchestratorConfig,
    iterationDir: string
): Promise<IterationResult> {
    const allRows: any[] = [];
    const allContainers: any[] = [];
    const allAuditReports: any[] = [];

    // Process each benchmark file
    for (const filePath of config.benchmarkFiles) {
        console.log(`  📄 Processing: ${path.basename(filePath)}`);

        // Step 1: Archivist - Store raw data
        // Archivist expects just filePath, fileName
        const archiveResult = await archiveExcelFile({
            filePath,
            fileName: path.basename(filePath),
            rowLimit: config.rowLimit || 10
        });
        // archiveResult.rawRows is undefined from previous view of archivist?
        // Let's assume archive returns importLogId, then we fetch rows, OR it returns rows.
        // In import-orchestrator.ts, it calls archive then prisma.rawRow.findMany. 
        // archivist.ts might have been updated or maybe the interface in `agents/archivist.ts` returns it.
        // I need to check archivist.ts or assume import-orchestrator approach is safer.
        // But for speed, let's look at how import-orchestrator grabs rows.
        // It fetches from DB. I will do same here to be safe if archivist doesn't return them directly.

        const prisma = new PrismaClient();
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: archiveResult.importLogId },
            orderBy: { rowNumber: 'asc' }
        });

        allRows.push(...rawRows.map(r => JSON.parse(r.data)));

        // Step 2: Translator - Map fields (uses current dictionaries)
        // Need transit stages
        const transitStages = await prisma.transitStage.findMany();

        // Assuming containerFields passed or just empty if using dictionary driven approach 
        const containerFields = ["containerNumber"]; // dummy, Translator v2 uses dictionaries

        const translatorResult = await runTranslator({
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

        allContainers.push(...translatorResult.containers);

        // Step 3: Persist to DB
        // We reuse existing persistence logic
        await persistMappedData(archiveResult.importLogId, translatorResult);

        // Step 4: Auditor - Verify mappings
        // Auditor needs specific input structure
        // In import-orchestrator:
        /*
             const auditorInput: AuditorInput = {
                containerNumber: container.containerNumber,
                rawData: {
                    raw: { originalRow },
                    mapping: simpleMapping // Derived from translator output
                },
                databaseRow: container
            };
        */

        // We need to loop containers and audit each
        const simpleMapping: Record<string, string> = {};
        if (translatorResult.schemaMapping && translatorResult.schemaMapping.fieldMappings) {
            Object.values(translatorResult.schemaMapping.fieldMappings).forEach((m: any) => {
                simpleMapping[m.sourceHeader] = m.targetField;
            });
        }

        // We need to fetch the persisted containers to get their IDs and full check
        const persistedContainers = await prisma.container.findMany({
            where: { importLogId: archiveResult.importLogId }
        });

        const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));

        for (const container of persistedContainers) {
            const metadata = container.metadata as any;
            const rawRowId = metadata?._internal?.rawRowId;
            const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

            if (!originalRow) continue;

            const auditResult = await runAuditor({
                containerNumber: container.containerNumber,
                rawData: {
                    raw: { originalRow },
                    mapping: simpleMapping
                },
                databaseRow: container
            });
            allAuditReports.push(auditResult);
        }

        // Detect Dropped Rows (Critical Failures)
        const persistedRowIds = new Set(persistedContainers.map(c => (c.metadata as any)?._internal?.rawRowId));

        for (const rawRow of rawRows) {
            if (!persistedRowIds.has(rawRow.id)) {
                // This row failed to create a container (likely missing container_number)
                // Treat ALL headers in this row as potentially unmapped candidates
                const rowData = JSON.parse(rawRow.data);
                const unmappedFields = Object.keys(rowData).map(k => ({ rawField: k }));

                // Only report if we actually have fields (skip empty rows)
                if (unmappedFields.length > 0) {
                    allAuditReports.push({
                        containerNumber: "DROPPED_ROW",
                        auditResult: "FAIL",
                        summary: {
                            recommendation: "CRITICAL_FAILURE",
                            reasonLevel: "CRITICAL",
                            captureRate: "0%",
                            explanation: "Row dropped because 'Container Number' could not be found or mapped.",
                            recommendation_reason: "Missing required identifier."
                        },
                        formattedRow: {},
                        lost: [],
                        wrong: [],
                        unmapped: unmappedFields,
                        corrections: { fieldsToUpdate: {}, metadataToAdd: {} }
                    });
                }
            }
        }
    }


    // Step 5: Analyze - Extract improvements
    // Aggregate unmapped items from all audit reports
    const unmappedStats = new Map<string, { values: Set<any>, count: number }>();

    // Also scan Translator Output for globally unmapped items (stored in unmappedSourceFields)
    // Actually, simple way: look at audit reports 'unmapped' list.
    for (const report of allAuditReports) {
        if (!report.unmapped) continue;
        for (const item of report.unmapped) {
            const header = item.rawField;
            if (!unmappedStats.has(header)) {
                unmappedStats.set(header, { values: new Set(), count: 0 });
            }
            const stat = unmappedStats.get(header)!;
            stat.count++;
            // We don't have easy access to raw value here unless we kept it
            // report.unmapped doesn't carry values usually.
            // But we have allRows array!
            // Finding value is hard because auditReport doesn't link back to rawRow index easily?
            // Actually report.containerNumber is key.
            // But let's assume sample value is NULL for now or try to extract from rawRows if header exists.

            // Heuristic to get sample values:
            if (stat.values.size < 5) {
                // Find a row with this header
                const foundRow = allRows.find(r => r[header] !== undefined);
                if (foundRow) stat.values.add(foundRow[header]);
            }
        }
    }

    const unmappedItems = Array.from(unmappedStats.entries()).map(([header, stats]) => ({
        header,
        sampleValues: Array.from(stats.values),
        frequency: stats.count
    }));

    const analysis = await runImprovementAnalyzer({
        unmappedItems: unmappedItems,
        context: { runId: config.outputDir }
    });

    // Save analyzer output
    await fs.writeFile(
        path.join(iterationDir, 'analyzer_output.json'),
        JSON.stringify(analysis, null, 2)
    );

    // Step 6: Update dictionaries
    // Cast to any to bypass potential TS check if import definition is stale in workspace memory
    const updateResult = await updateDictionaries(analysis);

    // Step 7: Calculate scores
    const scores = calculateScores(allRows, allContainers);

    // Step 8: Check stop condition
    const stopped = scores.coverage >= config.targetCoverage
        && scores.overall_score >= config.targetOverallScore;

    const result: IterationResult = {
        iteration: iterationNum,
        scores,
        metrics: {
            total_rows: allRows.length,
            valid_records: allContainers.filter(c => c.overallConfidence >= 0.7).length,
            rows_with_errors: allAuditReports.filter(r => r.auditResult === 'FAIL').length,
            unmapped_headers: unmappedItems.length,
            low_confidence_mappings: allContainers.filter(c => c.overallConfidence < 0.80).length
        },
        improvements: {
            synonyms_added: updateResult.synonymsAdded,
            pending_fields: updateResult.pendingAdded
        },
        stopped,
        stop_reason: stopped
            ? `INGESTION ENGINE IS COMPLETE: target met (coverage=${scores.coverage.toFixed(3)}, overall_score=${scores.overall_score.toFixed(3)})`
            : undefined
    };

    return result;
}

function calculateScores(rows: any[], containers: any[]) {
    const totalRows = rows.length;
    // Coverage: Assume containers returned by Translator that have a containerNumber are "valid candidates"
    // Better metric: Auditor PASS count? Or check if containerNumber is present and valid format.

    const validContainers = containers.filter(c =>
        (c.fields && c.fields.containerNumber && c.fields.containerNumber.value) ||
        (c.fields && c.fields.container_number && c.fields.container_number.value)
    );

    const coverage = totalRows > 0 ? validContainers.length / totalRows : 0;

    // Required field fill
    // Using fields from ontology as "required"
    const requiredFields = ['business_unit', 'container_number', 'carrier', 'pol', 'pod'];
    let requiredFillCount = 0;
    let requiredTotalFields = 0;

    for (const container of validContainers) {
        for (const field of requiredFields) {
            requiredTotalFields++;
            // fields is format { name: { value, confidence }}
            // Note: container_number is field name? 
            // The Translator returns keys based on dictionary?
            // "mappings": { "business_unit": ... }
            // We need to normalize key names from snake_case to camelCase if translator does that.
            // But dictionary uses snake_case. Translator V2 prompt implies snake_case.
            // Let's assume snake_case keys in `container.fields`.
            const camelField = field.replace(/_([a-z])/g, g => g[1].toUpperCase()); // if needed
            // Actually translator output `mappings` keys are what?
            // The prompt sample shows "business_unit". 
            // So looking for `container.fields['business_unit'].value`

            const val = container.fields[field]?.value || container.fields[camelField]?.value;

            if (val && val !== 'Unknown') {
                requiredFillCount++;
            }
        }
    }
    const required_field_fill = requiredTotalFields > 0
        ? requiredFillCount / requiredTotalFields
        : 0;

    // Optional field fill
    const optionalFields = ['hbl', 'customer_po', 'vessel_name', 'voyage'];
    let optionalFillCount = 0;
    let optionalTotalFields = 0;

    for (const container of validContainers) {
        for (const field of optionalFields) {
            optionalTotalFields++;
            const camelField = field.replace(/_([a-z])/g, g => g[1].toUpperCase());
            const val = container.fields[field]?.value || container.fields[camelField]?.value;
            if (val) {
                optionalFillCount++;
            }
        }
    }
    const optional_field_fill = optionalTotalFields > 0
        ? optionalFillCount / optionalTotalFields
        : 0;

    // Average confidence
    const confidences = containers.map(c => c.overallConfidence || 0);
    const avg_confidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    // Overall score (weighted)
    const overall_score = (
        0.5 * coverage +
        0.3 * required_field_fill +
        0.1 * optional_field_fill +
        0.1 * avg_confidence
    );

    return {
        coverage,
        required_field_fill,
        optional_field_fill,
        avg_confidence,
        overall_score
    };
}
