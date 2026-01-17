
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const runsDir = path.join(process.cwd(), 'artifacts/runs');
        console.log(`[API] Checking runs dir: ${runsDir}`);

        if (!fs.existsSync(runsDir)) {
            console.log(`[API] Runs dir does not exist`);
            return NextResponse.json({ runs: [] });
        }

        const files = fs.readdirSync(runsDir);
        console.log(`[API] Found files: ${files.join(', ')}`);

        const runFolders = files.filter(f => f.startsWith('run_'));
        console.log(`[API] Matched run folders: ${runFolders.join(', ')}`);

        const runs = runFolders.map(runId => {
            const runPath = path.join(runsDir, runId);

            // Basic Info
            const stats = fs.statSync(runPath);

            // Config
            let config = {};
            try {
                const configPath = path.join(runPath, 'config.json');
                if (fs.existsSync(configPath)) {
                    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
            } catch (e) { }

            // Iterations
            const iterations = fs.readdirSync(runPath)
                .filter(f => f.startsWith('iteration_'))
                .sort();

            const iterationData = iterations.map(it => {
                const itPath = path.join(runPath, it);
                let scores = null;
                let improvements = [];

                try {
                    const scoresPath = path.join(itPath, 'scores.json');
                    if (fs.existsSync(scoresPath)) {
                        scores = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
                    }

                    const analyzerPath = path.join(itPath, 'analyzer_output.json');
                    if (fs.existsSync(analyzerPath)) {
                        const analysis = JSON.parse(fs.readFileSync(analyzerPath, 'utf-8'));
                        improvements = analysis.suggestions || [];
                    }
                } catch (e) { }

                return {
                    id: it,
                    scores,
                    improvements
                };
            });

            return {
                id: runId,
                startedAt: stats.birthtime,
                lastUpdated: stats.mtime,
                config,
                iterations: iterationData
            };
        });

        // Sort by newest first
        runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

        return NextResponse.json({ runs });

    } catch (error) {
        console.error('Error fetching training runs:', error);
        return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 });
    }
}
