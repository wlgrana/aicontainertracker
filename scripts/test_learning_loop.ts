
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api/simulation';
// We use 'test_vendor_messy.xlsx' because it triggers Auto-Patching (Remaks -> metadata.remarks)
const TEST_FILE = 'test_vendor_messy.xlsx';
const LOG_DIR = path.join(process.cwd(), 'logs');

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function control(action: string, filename?: string) {
    await fetch(`${BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, filename, containerLimit: '10' })
    });
}

async function getStatus() {
    return await (await fetch(`${BASE_URL}/status`)).json();
}

async function runSimulationWait(filename: string) {
    console.log(`\n▶️ Running Simulation for ${filename}...`);
    // Copy file
    fs.copyFileSync(path.join(process.cwd(), 'testdata', filename), path.join(process.cwd(), filename));

    await control('start', filename);
    let running = true;
    let lastStep = '';

    while (running) {
        await delay(1000);
        const status = await getStatus();
        if (status.step !== lastStep) {
            // Only log if interesting
            if (status.step.includes('COMPLETE') || status.step.includes('REVIEW')) {
                console.log(`   Step Reached: ${status.step}`);
                if (status.step === 'IMPROVEMENT_REVIEW') {
                    await control('finish');
                    running = false;
                } else {
                    await control('proceed');
                }
            }
            lastStep = status.step;
        }
    }
    console.log(`✅ Simulation Finished.`);
    return getLatestLogPath();
}

function getLatestLogPath() {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('simulation_') && f.endsWith('.log'));
    files.sort(); // Timestamps in name ensure sort order
    return path.join(LOG_DIR, files[files.length - 1]);
}

function parseMappedCount(logPath: string) {
    const content = fs.readFileSync(logPath, 'utf-8');
    // Look for: [Translator] Final Mapping Count: X (vs Initial Y)
    const match = content.match(/\[Translator\] Final Mapping Count: (\d+)/);
    return match ? parseInt(match[1]) : 0;
}

async function main() {
    console.log("🧪 TESTING LEARNING LOOP CAPABILITY");

    // RUN 1
    const log1 = await runSimulationWait(TEST_FILE);
    const count1 = parseMappedCount(log1);
    console.log(`   Run 1 Mapped Count: ${count1}`);

    // RUN 2 (Should be better if learning works)
    const log2 = await runSimulationWait(TEST_FILE);
    const count2 = parseMappedCount(log2);
    console.log(`   Run 2 Mapped Count: ${count2}`);

    if (count2 > count1) {
        console.log(`\n🎉 SUCCESS: System learned! Mapped count increased from ${count1} to ${count2}.`);
    } else {
        console.log(`\n❌ FAILURE: No improvement. Mapped count remained ${count1}.`);
        console.log(`   (This proves the system is NOT currently learning from Auditor patches)`);
    }
}

main();
