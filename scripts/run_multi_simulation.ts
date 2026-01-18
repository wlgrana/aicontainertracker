
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api/simulation';
// We'll run a subset to keep it efficient but comprehensive
const FILES_TO_TEST = [
    'test_vendor_standard.xlsx',
    'test_vendor_messy.xlsx',
    'test_vendor_minimal.xlsx'
];

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStatus() {
    try {
        const res = await fetch(`${BASE_URL}/status`);
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch status:", e);
        return { step: 'UNKNOWN' };
    }
}

async function control(action: string, filename?: string, limit?: string) {
    console.log(`   -> Sending Command: ${action.toUpperCase()} ${filename ? `(${filename})` : ''}`);
    try {
        const res = await fetch(`${BASE_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, filename, containerLimit: limit })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        console.error(`Failed to send ${action}:`, e);
    }
}

async function runSimulationForFile(filename: string) {
    console.log(`\n\n==================================================`);
    console.log(`🎬 STARTING SIMULATION: ${filename}`);
    console.log(`==================================================`);

    // 1. "Upload" file (Copy to root)
    try {
        const src = path.join(process.cwd(), 'testdata', filename);
        const dest = path.join(process.cwd(), filename);
        fs.copyFileSync(src, dest);
        console.log(`✅ File staged: ${filename}`);
    } catch (e) {
        console.error(`❌ Failed to stage file ${filename}:`, e);
        return;
    }

    // 2. Start
    await control('start', filename, '10'); // Limit to 10 rows for speed

    let running = true;
    let lastStep = '';

    while (running) {
        await delay(1500); // Polling interval
        const status = await getStatus();

        if (status.step !== lastStep) {
            console.log(`   [STATUS CHANGE] ${lastStep} -> ${status.step} (${status.message})`);
            lastStep = status.step;
        }

        // Auto-Approvals
        if (status.step === 'ARCHIVIST_COMPLETE') await control('proceed');
        else if (status.step === 'TRANSLATOR_COMPLETE' || status.step === 'TRANSLATOR_REVIEW') await control('proceed');
        else if (status.step === 'AUDITOR_COMPLETE') await control('proceed');
        else if (status.step === 'IMPORT_COMPLETE') await control('proceed');
        else if (status.step === 'IMPROVEMENT_REVIEW') {
            await control('finish');
            running = false;
        }
        else if (status.step === 'COMPLETE') {
            running = false;
        }
    }
    console.log(`✅ SIMULATION COMPLETE: ${filename}`);
}

async function runAll() {
    for (const file of FILES_TO_TEST) {
        await runSimulationForFile(file);
        await delay(3000); // Cooldown between runs
    }
    console.log("\n\n🎉 ALL SIMULATIONS FINISHED.");
}

runAll();
