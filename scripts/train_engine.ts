
import { orchestrateImport } from '../lib/import-orchestrator';
import path from 'path';
import fs from 'fs';

async function main() {
    const args = process.argv.slice(2);
    // Default file logic
    const defaultFile = 'uploads/First Brands Wkly Report 1.13.xlsx';

    // If user passes 'testdata', run ALL files in testdata folder
    let targetFile = args[0];
    let benchmarkFiles: string[] = [];

    if (targetFile === 'testdata') {
        const testDir = path.join(process.cwd(), 'testdata');
        if (fs.existsSync(testDir)) {
            benchmarkFiles = fs.readdirSync(testDir)
                .filter(f => f.endsWith('.xlsx'))
                .map(f => path.join(testDir, f));
            console.log(`📂 Loaded ${benchmarkFiles.length} files from /testdata`);
        }
    } else {
        // Default single file logic
        targetFile = args[0] || 'uploads/First Brands Wkly Report 1.13.xlsx';
        // Check if relative ...
        if (!path.isAbsolute(targetFile)) {
            targetFile = path.join(process.cwd(), targetFile);
        }
        // Fallback check...
        if (!fs.existsSync(targetFile)) {
            const inUploads = path.join(process.cwd(), 'uploads', path.basename(args[0] || ''));
            if (fs.existsSync(inUploads)) targetFile = inUploads;
        }
        benchmarkFiles = [targetFile];
    }

    console.log(`\n🤖 STARTING AUTONOMOUS IMPROVEMENT LOOP`);
    console.log(`📄 Target File: ${targetFile}`);
    console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
    console.log('-------------------------------------------');

    try {
        const fileToLog = benchmarkFiles.length > 1 ? `Multi-File Batch (${benchmarkFiles.length})` : benchmarkFiles[0];

        const result = await orchestrateImport(
            benchmarkFiles[0], // Primary file for ID purposes
            path.basename(fileToLog),
            'AUTO_TRAINER_BOT',
            {
                useImprovementMode: true,
                benchmarkFiles: benchmarkFiles,
                rowLimit: 10
            }
        );

        console.log('-------------------------------------------');
        console.log('✅ TRAINING SESSION COMPLETE');
        console.log(`📝 Log ID: ${result.importLogId}`);
        console.log(`📊 Check "artifacts/runs/" for detailed logs and score progression.`);
    } catch (error) {
        console.error('❌ Training Failed:', error);
        process.exit(1);
    }
}

main();
