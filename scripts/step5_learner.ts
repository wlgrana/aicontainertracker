
import { PrismaClient } from '@prisma/client';
import { updateStatus, getActiveFilename } from './simulation-utils';
import { runImprovementAnalyzer } from '../agents/improvement-analyzer';
import { updateDictionaries } from '../agents/dictionary-updater';
import { AnalyzerInput, AnalyzerSuggestion, AnalyzerOutput } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const FILENAME = getActiveFilename();

async function main() {
    try {
        console.log(">>> STEP 5: LEARNER (Improvement Agent) <<<");
        updateStatus({ step: 'IMPROVEMENT', progress: 10, message: 'Initializing Learner...' });

        // 1. Fetch Ingested Data to find Gaps
        console.log(`[Learner] Loading containers for ${FILENAME}...`);
        const containers = await prisma.container.findMany({
            where: { importLogId: FILENAME }
        });

        if (containers.length === 0) {
            console.log("[Learner] No containers found. Skipping improvement.");
            updateStatus({ step: 'IMPROVEMENT_REVIEW', progress: 100, message: 'No data to analyze.' });
            return;
        }

        updateStatus({ step: 'IMPROVEMENT', progress: 30, message: 'Scanning for unmapped data...' });

        // 2. Extract Unmapped Fields from Metadata
        const unmappedStats = new Map<string, { values: Set<any>, count: number }>();

        for (const container of containers) {
            const meta = container.metadata as Record<string, any>;
            if (!meta) continue;

            // In Step 4, unmapped fields are stored directly in metadata root
            // Filter out system keys if any (like _internal)
            for (const [key, value] of Object.entries(meta)) {
                if (key.startsWith('_')) continue; // Internal flags

                if (!unmappedStats.has(key)) {
                    unmappedStats.set(key, { values: new Set(), count: 0 });
                }
                const entry = unmappedStats.get(key)!;
                entry.count++;
                if (value && entry.values.size < 5) { // Keep sample size small
                    entry.values.add(value);
                }
            }
        }

        const unmappedItems = Array.from(unmappedStats.entries()).map(([header, stats]) => ({
            header,
            sampleValues: Array.from(stats.values),
            frequency: stats.count
        }));

        console.log(`[Learner] Found ${unmappedItems.length} unmapped headers.`);

        // 2b. Check for Auto-Patched Fields from Auditor (Quality Gate Learning)
        const auditorPatches: AnalyzerSuggestion[] = [];
        const ARTIFACT_PATH = path.join(process.cwd(), 'artifacts', 'temp_translation.json');

        if (fs.existsSync(ARTIFACT_PATH)) {
            try {
                const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf-8'));
                if (artifact.schemaMapping && artifact.schemaMapping.fieldMappings) {
                    for (const [key, mapping] of Object.entries(artifact.schemaMapping.fieldMappings) as [string, any][]) {
                        if (mapping.notes && mapping.notes.includes('Auto-patched')) {
                            console.log(`[Learner] Discovered successful patch: '${key}' -> '${mapping.targetField}'`);
                            auditorPatches.push({
                                unmappedHeader: key,
                                canonicalField: mapping.targetField,
                                confidence: 0.99,
                                reasoning: "Validated by Auditor Auto-Patching",
                                action: "ADD_SYNONYM"
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn("[Learner] Failed to read auditor patches:", e);
            }
        }

        if (unmappedItems.length === 0 && auditorPatches.length === 0) {
            updateStatus({
                step: 'IMPROVEMENT_REVIEW',
                progress: 100,
                message: 'Perfect Coverage! No new learnings needed.',
                agentData: {
                    learner: {
                        scoreImprovement: 0,
                        newSynonyms: [],
                        analysisSummary: "No unmapped fields or patches found."
                    }
                }
            });
            console.log("STEP 5 Complete: Nothing to learn.");
            return;
        }

        let totalSynonymsAdded = 0;
        let allDetails: any[] = [];
        let summary = "Analysis Complete";

        // 3a. Process Auditor Patches Immediately
        if (auditorPatches.length > 0) {
            console.log(`[Learner] Reinforcing ${auditorPatches.length} proven patches into dictionary...`);
            const patchOutput: AnalyzerOutput = {
                suggestions: auditorPatches,
                summary: "Reinforcing Audit Patterns"
            };
            const patchResult = await updateDictionaries(patchOutput);
            totalSynonymsAdded += patchResult.synonymsAdded;
            allDetails.push(...patchResult.details);
            summary += `; Reinforced ${patchResult.synonymsAdded} patterns from Auditor.`;
        }

        // 3b. Run AI Analysis on remaining unmapped items
        if (unmappedItems.length > 0) {
            updateStatus({ step: 'IMPROVEMENT', progress: 60, message: `Analyzing ${unmappedItems.length} unknown fields...` });

            const analyzerInput: AnalyzerInput = {
                unmappedItems: unmappedItems,
                context: { importLogId: FILENAME }
            };

            const analysis = await runImprovementAnalyzer(analyzerInput);

            // 4. Update Dictionaries
            updateStatus({ step: 'IMPROVEMENT', progress: 80, message: 'Updating Knowledge Base...' });
            const aiResult = await updateDictionaries(analysis);
            totalSynonymsAdded += aiResult.synonymsAdded;
            allDetails.push(...aiResult.details);
            summary += `; AI learned ${aiResult.synonymsAdded} new synonyms.`;
        }

        // 5. Final Report
        const message = totalSynonymsAdded > 0
            ? `Learned ${totalSynonymsAdded} new synonyms!`
            : `Analysis complete. No confident updates found.`;

        console.log(`[Learner] LOOP CLOSED. Knowledge updated. Ready for re-ingestion.`);
        if (totalSynonymsAdded > 0) {
            console.log(`[Learner] To verify, click "Re-run" on Step 2 (Translator). It should now auto-map these fields.`);
        }

        updateStatus({
            step: 'IMPROVEMENT_REVIEW',
            progress: 100,
            message: message,
            agentData: {
                learner: {
                    scoreImprovement: 0.0,
                    newSynonyms: allDetails,
                    analysisSummary: summary
                }
            }
        });

        console.log("STEP 5 Complete.");
        console.log("Learnings:", JSON.stringify({ synonymsAdded: totalSynonymsAdded, details: allDetails }, null, 2));

    } catch (error) {
        console.error("Step 5 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

