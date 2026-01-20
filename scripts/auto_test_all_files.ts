import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000/api/simulation';
const LOG_FILE = path.join(process.cwd(), 'logs', 'comprehensive_test_run.log');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const TESTDATA_DIR = path.join(process.cwd(), 'testdata');

// Ensure log dir exists
if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

fs.appendFileSync(LOG_FILE, `\n\n>>> AUTO COMPREHENSIVE TEST RUN STARTED: ${new Date().toISOString()} <<<\n\n`);

function log(msg: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);

    // Format complex data for logging
    let dataStr = '';
    if (data) {
        if (data instanceof Error) {
            dataStr = `\nERROR: ${data.stack || data.message}`;
        } else {
            dataStr = `\nDATA: ${JSON.stringify(data, null, 2)}`;
        }
    }

    const consoleMsg = `[${timestamp}] ${msg}${dataStr}`;
    console.log(consoleMsg);

    const fileMsg = `[${new Date().toISOString()}] ${msg}${dataStr}`;
    fs.appendFileSync(LOG_FILE, fileMsg + '\n');
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStatus() {
    try {
        const res = await fetch(`${BASE_URL}/status`);
        return await res.json();
    } catch (e) {
        log("❌ Failed to fetch status", e);
        return { step: 'UNKNOWN' };
    }
}

// Helper to control simulation
async function control(action: string, filename?: string, limit?: string, step?: string) {
    log(`COMMAND: ${action.toUpperCase()} ${filename ? `(${filename})` : ''} [Limit: ${limit || 'N/A'}] [Step: ${step || 'N/A'}]`);
    try {
        const body: any = { action, filename, containerLimit: limit, enrichEnabled: true };
        if (step) body.step = step;
        else if (action === 'start' && !step) body.step = '1'; // Default to step 1 for start if not specified

        const res = await fetch(`${BASE_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        return data;
    } catch (e) {
        log(`❌ Failed to send ${action}`, e);
        return { success: false };
    }
}

async function runSimulationForFile(filename: string) {
    log(`\n\n==================================================`);
    log(`🎬 STARTING SIMULATION: ${filename}`);
    log(`==================================================`);

    // 1. Stage file (Copy to uploads/)
    try {
        const src = path.join(TESTDATA_DIR, filename);
        const dest = path.join(UPLOADS_DIR, filename);
        fs.copyFileSync(src, dest);
        log(`✅ File staged: ${dest}`);
    } catch (e) {
        log(`❌ Failed to stage file ${filename}`, e);
        return;
    }

    // 2. Start
    const limit = '10'; // STRICT LIMIT 10
    let startRes = await control('start', filename, limit, '1');

    if (!startRes || !startRes.success) {
        log(`⚠️ START FAILED: ${JSON.stringify(startRes)} - Attempting cleanup and retry...`);
        await control('stop');
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s for cleanup
        startRes = await control('start', filename, limit, '1');
    }

    if (!startRes || !startRes.success) {
        log(`⛔ START FAILED PERMANENTLY: ${JSON.stringify(startRes)}`);
        return;
    }

    let running = true;
    let lastStep = '';
    let pollingCount = 0;
    const MAX_POLLS = 300; // 5 minutes timeout

    while (running && pollingCount < MAX_POLLS) {
        await delay(1000); // Polling interval
        pollingCount++;
        const status = await getStatus();

        if (status.step !== lastStep) {
            log(`🔄 STATUS CHANGE: ${lastStep} -> ${status.step}`, { message: status.message });
            lastStep = status.step;
        }

        // Auto-Approvals & Transitions
        if (status.step === 'ARCHIVIST_COMPLETE') {
            log(`✅ ARCHIVIST FINISHED. Starting Translator (Step 2)...`);
            await control('start', filename, limit, '2');
            // Wait a bit to allow transition
            await new Promise(r => setTimeout(r, 2000));
        } else if (status.step === 'TRANSLATOR_COMPLETE') {
            log(`✅ TRANSLATOR FINISHED. Starting Auditor (Step 3)...`);
            await control('start', filename, limit, '3');
            await new Promise(r => setTimeout(r, 2000));
        } else if (status.step === 'AUDITOR_COMPLETE') {
            log(`✅ AUDITOR FINISHED. Starting Importer (Step 4)...`);
            await control('start', filename, limit, '4');
            await new Promise(r => setTimeout(r, 2000));
        } else if (status.step === 'IMPORTER_COMPLETE') {
            log(`✅ IMPORTER FINISHED. Starting Learner (Step 5)...`);
            await control('start', filename, limit, '5');
            await new Promise(r => setTimeout(r, 2000));
        } else if (status.step === 'LEARNER_COMPLETE' || status.state === 'completed') {
            log(`🎉 SIMULATION COMPLETED SUCCESSFULLY for ${filename}`);
            running = false; // Set running to false to exit the loop
        } else if (status.state === 'error' || status.step === 'error') {
            log(`⛔ SIMULATION FAILED: ${status.message}`);
            running = false; // Set running to false to exit the loop
        }
        else if (status.step === 'ERROR') {
            log(`⛔ SIMULATION ERROR: ${status.message}`);
            running = false;
        } else if (status.state === 'error') {
            log(`⛔ PROCESS DIED: ${status.message}`);
            running = false;
        }
    }

    if (pollingCount >= MAX_POLLS) {
        log(`⛔ TIMEOUT reached for ${filename}`);
        await control('stop');
    }

    // Final Snapshot
    const finalStatus = await getStatus();
    log(`📊 FINAL REPORT FOR ${filename}:`, {
        metrics: finalStatus.metrics,
        agentData: finalStatus.agentData
    });
}

async function runAll() {
    // Read all files from testdata
    const files = fs.readdirSync(TESTDATA_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$')); // Ignore temp excel files
    log(`Found ${files.length} test files: ${files.join(', ')}`);

    for (const file of files) {
        // Skip previously processed files from the logs if needed, but the user asked for a full test.
        await runSimulationForFile(file);
        await delay(2000); // Cooldown between runs
    }
    log("\n\n🎉 ALL SIMULATIONS FINISHED.");
}

runAll();
