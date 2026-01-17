
import 'dotenv/config';
import { runImprovementLoop } from '@/agents/improvement-orchestrator';

import path from 'path';

async function main() {
    const benchmarkFiles = [
        path.join(process.cwd(), 'test_import.xlsx'),

        // path.join(process.cwd(), 'uploads/1768249541406-maersk_container_tracking_2026-01-12.xlsx')
    ];

    await runImprovementLoop({
        benchmarkFiles: benchmarkFiles,
        maxIterations: 50,
        targetCoverage: 0.90,
        targetOverallScore: 0.90,
        outputDir: 'artifacts/runs',
        useIsolatedDB: true  // Use staging schema, not production
    });
}

main().catch(console.error);
