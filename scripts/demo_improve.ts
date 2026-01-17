
import { runImprovementLoop } from '../agents/improvement-orchestrator';
import { updateStatus } from './simulation-utils';

const FILE_PATH = "C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\Horizon Tracking Report.xlsx";

async function main() {
    updateStatus({ step: 'IMPROVING', progress: 40, message: 'Analyzing Failures and Learning Synonyms...' });
    console.log("\n--- STEP 2: RUNNING IMPROVEMENT LOOP ---");

    const result = await runImprovementLoop({
        benchmarkFiles: [FILE_PATH],
        maxIterations: 1,
        targetCoverage: 0.95,
        targetOverallScore: 0.95,
        outputDir: 'artifacts/runs/demo',
        useIsolatedDB: false
    });

    let newSynonyms: string[] = [];
    if (result && result.history && result.history.length > 0) {
        result.history.forEach(h => {
            if (h.improvementsApplied && h.improvementsApplied.newSynonyms) {
                newSynonyms.push(...h.improvementsApplied.newSynonyms.map(s => `${s.unmappedHeader} → ${s.canonicalField}`));
            }
        });
    }

    console.log("✅ Improvement Loop Complete.");
    updateStatus({
        step: 'VERIFYING',
        progress: 85,
        message: `Learned ${newSynonyms.length} new synonyms. Verifying...`,
        metrics: {
            improvement: { synonymsFound: newSynonyms.length }
        },
        agentData: {
            learner: {
                newSynonyms: newSynonyms,
                scoreImprovement: (result.finalScore - result.initialScore) * 100
            }
        }
    });
}

main().catch(console.error);
