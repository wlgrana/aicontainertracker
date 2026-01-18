
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define simulation control URL - assuming local dev
const API_URL = 'http://localhost:3000/api/simulation/control';
const STATUS_FILE = path.join(process.cwd(), 'simulation_status.json');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getStatus() {
    if (fs.existsSync(STATUS_FILE)) {
        return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    }
    return { step: 'UNKNOWN' };
}

async function runControlAction(action: string) {
    console.log(`[TEST] Calling control action: ${action}`);
    // replacing fetch with basic functional equivalent if node-fetch missing, 
    // but usually in node 18+ global fetch works.
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
    } catch (e) {
        console.error(`Action ${action} failed:`, e);
    }
}

async function runTestCycle(cycleNum: number) {
    console.log(`\n\n=== STARTING TEST CYCLE ${cycleNum} ===`);

    // 1. Clear
    await runControlAction('clear');
    await sleep(2000);

    // 2. Start (starts Step 1)
    await runControlAction('start');

    let lastStep = '';
    let stuckCounter = 0;

    while (true) {
        const status = await getStatus();

        if (status.step !== lastStep) {
            console.log(`[${cycleNum}] Step Changed: ${lastStep} -> ${status.step} (${status.message.substring(0, 50)}...)`);
            lastStep = status.step;
            stuckCounter = 0;
        } else {
            process.stdout.write(".");
            stuckCounter++;
        }

        if (stuckCounter > 60) { // 60 seconds stuck
            // Special handling for AUDITOR stuck - force proceed if it says "Complete" inside message or status implies waiting
            // Actually, if status is AUDITOR_COMPLETE, we should proceed.
            // If status is AUDITOR, we wait.
            console.log(`\n[WARN] Stuck in step ${status.step} for 60s.`);
            // Force proceed if stuck?
            // break;
            process.exit(1);
        }

        // Auto-Proceed Logic based on status names from our scripts
        if (status.step === 'ARCHIVIST_COMPLETE') {
            console.log("\n[Proceed] Moving to Translator...");
            await runControlAction('proceed');
        }
        else if (status.step === 'TRANSLATOR_REVIEW') { // Step 2 done
            console.log("\n[Proceed] Moving to Auditor...");
            await runControlAction('proceed');
        }
        else if (status.step === 'AUDITOR_COMPLETE') { // Step 3 done
            console.log("\n[Proceed] Moving to Import...");
            await runControlAction('proceed');
        }
        else if (status.step === 'IMPORT_COMPLETE') { // Step 4 done
            console.log("\n[Proceed] Moving to Improvement...");
            await runControlAction('proceed');
        }
        else if (status.step === 'IMPROVEMENT_REVIEW') { // Step 5 done
            console.log("\n[Finish] Finishing...");
            await runControlAction('finish');
        }
        else if (status.step === 'COMPLETE') {
            console.log(`\n[SUCCESS] Cycle ${cycleNum} Complete!`);
            break;
        }

        await sleep(1000);
    }
}

async function main() {
    try {
        await runTestCycle(1);
        // await runTestCycle(2); 
        console.log("\nALL TESTS PASSED.");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
