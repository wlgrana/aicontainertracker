import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_FILE = 'C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\testdata\\Horizon Tracking Report.xlsx';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

console.log('══════════════════════════════════════════════════════════════════════');
console.log('  SCRIPT IMPORT SIMULATION TEST');
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  File: ${path.basename(TEST_FILE)}`);
console.log(`  Method: SCRIPT (direct step execution)`);
console.log('══════════════════════════════════════════════════════════════════════\n');

async function runTest() {
    // 1. Copy file to uploads directory
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const targetFile = path.join(UPLOADS_DIR, path.basename(TEST_FILE));
    fs.copyFileSync(TEST_FILE, targetFile);
    console.log(`✅ File staged to uploads: ${path.basename(TEST_FILE)}\n`);

    // 2. Initialize simulation status with SCRIPT-based log filename
    const timestamp = Date.now();
    const baseFilename = path.basename(TEST_FILE).replace(/\.xlsx$/i, '').replace(/[^a-z0-9_-]/gi, '_');
    const invocationMethod = 'SCRIPT';
    const logFilename = `${baseFilename}_${invocationMethod}_${timestamp}.log`;

    const STATUS_FILE = path.join(process.cwd(), 'simulation_status.json');
    const initialStatus = {
        step: 'ARCHIVIST',
        progress: 0,
        message: 'Initializing Script-based Simulation...',
        filename: path.basename(TEST_FILE),
        rowCount: 0,
        agentData: {},
        enrichEnabled: true,
        forwarder: null,
        logFilename: logFilename
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
    console.log(`📝 Created status file with log: ${logFilename}\n`);

    // 3. Run each step sequentially
    const steps = ['1', '2', '3', '4', '5'];

    for (const step of steps) {
        console.log(`\n🔄 Running Step ${step}...`);

        await new Promise<void>((resolve, reject) => {
            const proc = spawn('npx', ['tsx', 'scripts/run_step.ts', step], {
                cwd: process.cwd(),
                stdio: 'inherit',
                shell: true,
                env: {
                    ...process.env,
                    AUTO_RUN: 'true',
                    ENRICH_ENABLED: 'true',
                    INVOKED_BY: 'SCRIPT'
                }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Step ${step} completed`);
                    resolve();
                } else {
                    console.error(`❌ Step ${step} failed with code ${code}`);
                    reject(new Error(`Step ${step} failed`));
                }
            });

            proc.on('error', (err) => {
                console.error(`❌ Failed to run step ${step}:`, err);
                reject(err);
            });
        });
    }

    console.log('\n🏁 SIMULATION COMPLETE!\n');

    // 3. Find and display the log file
    const logsDir = path.join(process.cwd(), 'logs');
    if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir)
            .filter(f => f.startsWith('Horizon_Tracking_Report_'))
            .sort()
            .reverse();

        if (logFiles.length > 0) {
            const latestLog = logFiles[0];
            console.log(`  Log File: ${latestLog}`);

            const logPath = path.join(logsDir, latestLog);
            const logContent = fs.readFileSync(logPath, 'utf-8');
            const headerEnd = logContent.indexOf('>>>');

            if (headerEnd > 0) {
                const header = logContent.substring(0, headerEnd);
                console.log('\n  Log Header:');
                header.split('\n').forEach(line => console.log('  ' + line));
            }
        }
    }
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
