
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getStatusPath, getLogPath } from '../lib/path-utils';
import { LogStream } from '../lib/log-stream';

const step = process.argv[2];
let logFilename = 'simulation.log';
let importFilename = 'Unknown';
let importLogId = 'Unknown';

// Try to read log filename and import filename from status
const STATUS_FILE = getStatusPath();
try {
    if (fs.existsSync(STATUS_FILE)) {
        const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
        if (status.logFilename) {
            logFilename = status.logFilename;
        }
        if (status.filename) {
            importFilename = status.filename;
            // Use the original filename (without timestamp suffix) as importLogId
            importLogId = status.filename;
        }
    }
} catch (e) {
    // ignore
}

console.log('[RUN_STEP] Initializing with:', { step, logFilename, importFilename, importLogId });

const LOG_FILE = getLogPath(logFilename);

// Initialize LogStream for database-backed logging
const logStream = new LogStream(logFilename, importLogId);

// Helper function to write to both filesystem and database
function writeLog(content: string) {
    // Write to database via LogStream
    logStream.write(content);

    // Also write to stdout for immediate visibility
    process.stdout.write(content);
}

// Write metadata header for Step 1 only
if (step === '1') {
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const environment = isProduction ? 'PRODUCTION (Vercel)' : 'LOCAL';
    const invocationMethod = process.env.INVOKED_BY || 'SCRIPT';

    const header = `
═══════════════════════════════════════════════════════════════
  IMPORT RUN METADATA
═══════════════════════════════════════════════════════════════
  Timestamp:         ${new Date().toISOString()}
  Environment:       ${environment}
  Invocation Method: ${invocationMethod}
  Import File:       ${importFilename}
  Import Log ID:     ${importLogId}
  Log File:          ${logFilename}
  Node Version:      ${process.version}
  Platform:          ${process.platform}
═══════════════════════════════════════════════════════════════

`;

    writeLog(header);
}

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
writeLog(banner);

// FORCE TRACE LOGGING for detailed debugging
process.env.LOG_LEVEL = 'trace';

const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsxPath, script, ...process.argv.slice(3)], {
    shell: false,
    stdio: 'pipe',
    windowsHide: true
});

child.stdout.on('data', d => {
    const output = d.toString();
    writeLog(output);
});

child.stderr.on('data', d => {
    const output = d.toString();
    writeLog(output);
});

child.on('close', async (code) => {
    const msg = `\n[Step ${step}] Exited with code ${code}\n`;
    writeLog(msg);

    // Close the log stream to flush final data to database
    console.log('[RUN_STEP] Closing log stream and flushing to database...');
    await logStream.close();
    console.log('[RUN_STEP] Log stream closed successfully');

    process.exit(code || 0);
});
