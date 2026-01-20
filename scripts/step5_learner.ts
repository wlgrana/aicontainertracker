
import { PrismaClient } from '@prisma/client';
import { updateStatus, getActiveFilename } from './simulation-utils';
import { getArtifactPath } from '../lib/path-utils';
import { runImprovementAnalyzer } from '../agents/improvement-analyzer';
import { updateDictionaries } from '../agents/dictionary-updater';
import { AnalyzerInput, AnalyzerSuggestion, AnalyzerOutput } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { validateFieldExists } from '../agents/field-name-utils';

const prisma = new PrismaClient();



/**
 * Main Learner function - exported for Vercel direct execution
 */
export async function runLearnerStep(config?: {
    filename?: string;
}) {
    const FILENAME = config?.filename || await getActiveFilename();

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
            return {
                success: true,
                synonymsAdded: 0
            };
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

        const unmappedItems: any[] = [];
        const seenSuggestions = new Set<string>();
        const learnerSuggestions: AnalyzerSuggestion[] = [];

        // Load ontology
        const ontologyPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');
        const ontology = yaml.parse(fs.readFileSync(ontologyPath, 'utf-8'));

        for (const container of containers) {
            const meta = container.metadata as Record<string, any>;
            if (!meta) continue;

            // 1. Discover Successful Mappings (The "Fix")
            if (meta.mappings) {
                for (const [rawHeader, dbField] of Object.entries(meta.mappings)) {
                    // ✅ NEW: Normalize first (preserve casing for Updater matching)
                    const canonicalField = String(dbField).replace(/^metadata\./, '');

                    // Verify field exists
                    if (validateFieldExists(canonicalField, ontology)) {
                        const key = `${rawHeader}->${canonicalField}`;
                        if (!seenSuggestions.has(key)) {
                            // Only propose if it's NOT already a synonym (Dictionary Updater will check too, but save work)
                            // Actually, let Updater do the heavy lifting.
                            learnerSuggestions.push({
                                canonicalField: canonicalField,
                                unmappedHeader: rawHeader,
                                confidence: 0.95,
                                action: 'ADD_SYNONYM',
                                reasoning: "Discovered from successful AI translation"
                            });
                            seenSuggestions.add(key);
                            console.log(`[Learner] ✅ Discovered: "${rawHeader}" → ${canonicalField}`);
                        }
                    } else {
                        // console.warn(`[Learner] ⚠️  Field ${canonicalField} not in ontology, skipping`);
                    }
                }
            }

            // 2. Extract Unmapped Fields
            // In Step 4, unmapped fields are stored directly in metadata root
            // Filter out system keys if any (like _internal)
            for (const [key, value] of Object.entries(meta)) {
                if (key.startsWith('_')) continue; // Internal flags
                if (key === 'mappings' || key === 'confidence' || key === 'source') continue; // Skip our new meta fields

                // Also skip if it IS in the mappings (handled above) 
                if (meta.mappings && meta.mappings[key]) continue;

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

        // Convert unmapped stats to array
        unmappedItems.push(...Array.from(unmappedStats.entries()).map(([header, stats]) => ({
            header,
            sampleValues: Array.from(stats.values),
            frequency: stats.count
        })));


        console.log(`[Learner] Follow-up: Found ${unmappedItems.length} unmapped headers.`);
        console.log(`[Learner] Follow-up: Found ${learnerSuggestions.length} successful mappings to reinforce.`);

        // 2b. Check for Auto-Patched Fields from Auditor (Quality Gate Learning)
        const auditorPatches: AnalyzerSuggestion[] = [];
        const ARTIFACT_PATH = getArtifactPath('temp_translation.json');

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

        if (unmappedItems.length === 0 && auditorPatches.length === 0 && learnerSuggestions.length === 0) {
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
            return {
                success: true,
                synonymsAdded: 0
            };
        }

        let totalSynonymsAdded = 0;
        let allDetails: any[] = [];
        let summary = "Analysis Complete";

        // 3a. Process Auditor Patches AND Discovered Mappings Immediately
        const highConfidenceSuggestions = [...auditorPatches, ...learnerSuggestions];

        if (highConfidenceSuggestions.length > 0) {
            console.log(`[Learner] Reinforcing ${highConfidenceSuggestions.length} proven patterns into dictionary...`);
            const patchOutput: AnalyzerOutput = {
                suggestions: highConfidenceSuggestions,
                summary: "Reinforcing Validated Patterns"
            };
            const patchResult = await updateDictionaries(patchOutput);
            totalSynonymsAdded += patchResult.synonymsAdded;
            allDetails.push(...patchResult.details);
            summary += `; Reinforced ${patchResult.synonymsAdded} patterns.`;
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

        return {
            success: true,
            synonymsAdded: totalSynonymsAdded,
            details: allDetails
        };

    } catch (error) {
        console.error("Step 5 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// ✅ Only run as script if called directly (for local spawn)
async function main() {
    await runLearnerStep();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[Learner] Error:', err);
        process.exit(1);
    });
}


