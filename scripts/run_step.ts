
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const step = process.argv[2];
let logFilename = 'simulation.log';

// Try to read log filename from status
const STATUS_FILE = path.join(process.cwd(), 'simulation_status.json');
try {
    if (fs.existsSync(STATUS_FILE)) {
        const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
        if (status.logFilename) {
            logFilename = status.logFilename;
        }
    }
} catch (e) {
    // ignore
}

const LOG_FILE = path.join(process.cwd(), 'logs', logFilename);

const scriptMap: Record<string, string> = {
    '1': 'scripts/step1_archivist.ts',
    '2': 'scripts/step2_translator.ts',
    '3': 'scripts/step3_auditor.ts', // Quality Gate
    '4': 'scripts/step4_importer.ts', // Persistence
    '5': 'scripts/step5_learner.ts',  // Improvement
};

const script = scriptMap[step];
if (!script) {
    console.error("Invalid step");
    process.exit(1);
}

const banner = `\n\n>>> RUNNING STEP ${step} [${new Date().toISOString()}] <<<\n`;
console.log(banner);
try {
    // Ensure directory exists
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    fs.appendFileSync(LOG_FILE, banner);
} catch (e) { }

// FORCE TRACE LOGGING for detailed debugging
process.env.LOG_LEVEL = 'trace';

const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsxPath, script, ...process.argv.slice(3)], {
    shell: false,
    stdio: 'pipe',
    windowsHide: true
});

child.stdout.on('data', d => {
    process.stdout.write(d);
    try { fs.appendFileSync(LOG_FILE, d); } catch (e) { }
});

child.stderr.on('data', d => {
    process.stderr.write(d);
    try { fs.appendFileSync(LOG_FILE, d); } catch (e) { }
});

child.on('close', code => {
    const msg = `\n[Step ${step}] Exited with code ${code}\n`;
    console.log(msg);
    try { fs.appendFileSync(LOG_FILE, msg); } catch (e) { }
    process.exit(code || 0);
});
