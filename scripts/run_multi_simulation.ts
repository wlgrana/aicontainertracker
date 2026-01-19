import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api/simulation';
const LOG_FILE = path.join(process.cwd(), 'logs', 'comprehensive_test_run.log');

// Ensure log dir exists
if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
fs.writeFileSync(LOG_FILE, `>>> COMPREHENSIVE TEST RUN STARTED: ${new Date().toISOString()} <<<\n\n`);

const FILES_TO_TEST = [
    'test_enrich_service_misplaced.xlsx',
    'test_enrich_load_type.xlsx',
    'test_enrich_status_inference.xlsx',
    'test_enrich_dest_cleanup.xlsx'
];

function log(msg: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const consoleMsg = `[${timestamp}] ${msg}`;
    console.log(consoleMsg);

    let fileMsg = `[${new Date().toISOString()}] ${msg}`;
    if (data) {
        fileMsg += `\nDATA: ${JSON.stringify(data, null, 2)}`;
    }
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

async function control(action: string, filename?: string, limit?: string) {
    log(`COMMAND: ${action.toUpperCase()} ${filename ? `(${filename})` : ''} [Limit: ${limit || 'N/A'}]`);
    try {
        const res = await fetch(`${BASE_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, filename, containerLimit: limit, enrichEnabled: true })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        log(`❌ Failed to send ${action}`, e);
    }
}

async function runSimulationForFile(filename: string) {
    log(`\n\n==================================================`);
    log(`🎬 STARTING SIMULATION: ${filename}`);
    log(`==================================================`);

    // 1. "Upload" file (Copy to root)
    try {
        const src = path.join(process.cwd(), 'testdata', filename);
        const dest = path.join(process.cwd(), filename);
        fs.copyFileSync(src, dest);
        log(`✅ File staged: ${filename}`);
    } catch (e) {
        log(`❌ Failed to stage file ${filename}`, e);
        return;
    }

    // 2. Start
    await control('start', filename, '10'); // STRICT LIMIT 10

    let running = true;
    let lastStep = '';
    let lastMsg = '';

    while (running) {
        await delay(1000); // Polling interval
        const status = await getStatus();

        if (status.step !== lastStep) {
            log(`🔄 STATUS CHANGE: ${lastStep} -> ${status.step}`, { message: status.message });

            // Log Step Completion Details
            if (lastStep && status.step.endsWith('_COMPLETE')) {
                log(`📝 STEP REPORT [${lastStep}]:`, {
                    metrics: status.metrics || 'No metrics',
                    agentData: status.agentData?.[lastStep.toLowerCase().replace('_complete', '')] || 'No specific agent data'
                });
            }
            if (lastStep === 'IMPORT' && status.step === 'IMPORT_COMPLETE') {
                // Explicitly log Importer/Enricher data if available
                log(`🧠 ENRICHMENT & IMPORT STATS:`, status.agentData?.translator || {}); // Translator usually holds the stats in current structure
            }

            lastStep = status.step;
        }

        // Auto-Approvals & Transitions
        if (status.step === 'ARCHIVIST_COMPLETE') {
            log(`✅ ARCHIVIST FINISHED. Proceeding...`);
            await control('proceed');
        }
        else if (status.step === 'TRANSLATOR_COMPLETE' || status.step === 'TRANSLATOR_REVIEW') {
            log(`✅ TRANSLATOR/REVIEW FINISHED. Proceeding...`);
            await control('proceed');
        }
        else if (status.step === 'AUDITOR_COMPLETE') {
            log(`✅ AUDITOR FINISHED. Proceeding...`);
            await control('proceed');
        }
        else if (status.step === 'IMPORT_COMPLETE') {
            log(`✅ IMPORT FINISHED. Proceeding...`);
            await control('proceed');
        }
        else if (status.step === 'IMPROVEMENT_REVIEW') {
            log(`✅ IMPROVEMENT FINISHED. Finishing...`);
            await control('finish');
            running = false;
        }
        else if (status.step === 'COMPLETE') {
            log(`🏁 SIMULATION SUCCEEDED.`);
            running = false;
        }
        else if (status.step === 'ERROR') {
            log(`⛔ SIMULATION ERROR: ${status.message}`);
            running = false;
        }
    }

    // Final Snapshot
    const finalStatus = await getStatus();
    log(`📊 FINAL REPORT FOR ${filename}:`, {
        metrics: finalStatus.metrics,
        agentData: finalStatus.agentData
    });
}

async function runAll() {
    for (const file of FILES_TO_TEST) {
        await runSimulationForFile(file);
        await delay(3000); // Cooldown between runs
    }
    log("\n\n🎉 ALL SIMULATIONS FINISHED.");
}

runAll();
