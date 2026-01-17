
import { PrismaClient } from '@prisma/client';
import { updateStatus, getActiveFilename } from './simulation-utils';
import { runImprovementAnalyzer } from '../agents/improvement-analyzer';
import { updateDictionaries } from '../agents/dictionary-updater';
import { AnalyzerInput } from '../types/agents';

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

        if (unmappedItems.length === 0) {
            updateStatus({
                step: 'IMPROVEMENT_REVIEW',
                progress: 100,
                message: 'Perfect Coverage! No new learnings needed.',
                agentData: {
                    learner: {
                        scoreImprovement: 0,
                        newSynonyms: [],
                        analysisSummary: "No unmapped fields found."
                    }
                }
            });
            console.log("STEP 5 Complete: Nothing to learn.");
            return;
        }

        // 3. Run AI Analysis
        updateStatus({ step: 'IMPROVEMENT', progress: 60, message: `Analyzing ${unmappedItems.length} unknown fields...` });

        const analyzerInput: AnalyzerInput = {
            unmappedItems: unmappedItems,
            context: { importLogId: FILENAME }
        };

        const analysis = await runImprovementAnalyzer(analyzerInput);

        // 4. Update Dictionaries
        updateStatus({ step: 'IMPROVEMENT', progress: 80, message: 'Updating Knowledge Base...' });
        const updateResult = await updateDictionaries(analysis);

        // 5. Final Report
        const message = updateResult.synonymsAdded > 0
            ? `Learned ${updateResult.synonymsAdded} new synonyms!`
            : `Analysis complete. No confident updates found.`;

        console.log(`[Learner] LOOP CLOSED. Knowledge updated. Ready for re-ingestion.`);
        if (updateResult.synonymsAdded > 0) {
            console.log(`[Learner] To verify, click "Re-run" on Step 2 (Translator). It should now auto-map these fields.`);
        }

        updateStatus({
            step: 'IMPROVEMENT_REVIEW',
            progress: 100,
            message: message,
            agentData: {
                learner: {
                    scoreImprovement: 0.0, // Calculated on next run
                    newSynonyms: updateResult.details,
                    analysisSummary: analysis.summary
                }
            }
        });

        console.log("STEP 5 Complete.");
        console.log("Learnings:", JSON.stringify(updateResult, null, 2));

    } catch (error) {
        console.error("Step 5 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
