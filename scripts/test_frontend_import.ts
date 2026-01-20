#!/usr/bin/env tsx
/**
 * Test script that simulates a frontend import by calling the API
 * This will create a log file with FRONTEND invocation method
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api/simulation';
const TEST_FILE = 'Horizon Tracking Report.xlsx';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getStatus() {
    try {
        const res = await fetch(`${BASE_URL}/status`);
        return await res.json();
    } catch (e) {
        console.error('❌ Failed to fetch status:', e);
        return { step: 'UNKNOWN' };
    }
}

async function control(action: string, filename?: string, limit?: string) {
    console.log(`📤 API Call: ${action.toUpperCase()} ${filename ? `(${filename})` : ''} [Limit: ${limit || 'all'}]`);
    try {
        const res = await fetch(`${BASE_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                filename,
                containerLimit: limit || 'all',
                enrichEnabled: false,
                forwarder: null
            })
        });
        const data = await res.json();
        console.log(`✅ Response:`, data.message || data);
        return data;
    } catch (e) {
        console.error(`❌ Failed to send ${action}:`, e);
        throw e;
    }
}

async function runTest() {
    console.log('\n' + '═'.repeat(70));
    console.log('  FRONTEND IMPORT SIMULATION TEST');
    console.log('═'.repeat(70));
    console.log(`  File: ${TEST_FILE}`);
    console.log(`  Method: API (simulates frontend)`);
    console.log('═'.repeat(70) + '\n');

    // 1. Copy file to uploads directory
    try {
        const src = path.join(process.cwd(), 'testdata', TEST_FILE);
        const uploadsDir = path.join(process.cwd(), 'uploads');

        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const dest = path.join(uploadsDir, TEST_FILE);
        fs.copyFileSync(src, dest);
        console.log(`✅ File staged to uploads: ${TEST_FILE}\n`);
    } catch (e) {
        console.error(`❌ Failed to stage file:`, e);
        return;
    }

    // 2. Start simulation via API
    await control('start', TEST_FILE, 'all');
    await delay(2000);

    // 3. Monitor and auto-proceed through steps
    let running = true;
    let lastStep = '';

    while (running) {
        await delay(1000);
        const status = await getStatus();

        if (status.step !== lastStep) {
            console.log(`\n🔄 Step Change: ${lastStep || 'START'} → ${status.step}`);
            console.log(`   Message: ${status.message || 'N/A'}`);
            lastStep = status.step;
        }

        // Auto-proceed through steps
        if (status.step === 'ARCHIVIST_COMPLETE') {
            console.log('\n✅ ARCHIVIST COMPLETE - Proceeding to Translator...');
            await control('proceed');
        }
        else if (status.step === 'TRANSLATOR_COMPLETE' || status.step === 'TRANSLATOR_REVIEW') {
            console.log('\n✅ TRANSLATOR COMPLETE - Proceeding to Auditor...');
            await control('proceed');
        }
        else if (status.step === 'AUDITOR_COMPLETE') {
            console.log('\n✅ AUDITOR COMPLETE - Proceeding to Importer...');
            await control('proceed');
        }
        else if (status.step === 'IMPORT_COMPLETE') {
            console.log('\n✅ IMPORT COMPLETE - Proceeding to Learner...');
            await control('proceed');
        }
        else if (status.step === 'IMPROVEMENT_REVIEW') {
            console.log('\n✅ LEARNER COMPLETE - Finishing...');
            await control('finish');
            running = false;
        }
        else if (status.step === 'COMPLETE') {
            console.log('\n🏁 SIMULATION COMPLETE!');
            running = false;
        }
        else if (status.step === 'ERROR') {
            console.error(`\n⛔ ERROR: ${status.message}`);
            running = false;
        }
    }

    // 4. Get final status and log filename
    const finalStatus = await getStatus();
    console.log('\n' + '═'.repeat(70));
    console.log('  TEST COMPLETE');
    console.log('═'.repeat(70));
    console.log(`  Final Step: ${finalStatus.step}`);
    console.log(`  Log File: ${finalStatus.logFilename || 'Unknown'}`);

    if (finalStatus.logFilename) {
        const logPath = path.join(process.cwd(), 'logs', finalStatus.logFilename);
        if (fs.existsSync(logPath)) {
            console.log(`  Log Path: ${logPath}`);

            // Read and display the header
            const logContent = fs.readFileSync(logPath, 'utf-8');
            const headerEnd = logContent.indexOf('>>>');
            if (headerEnd > 0) {
                const header = logContent.substring(0, headerEnd);
                console.log('\n  Log Header:');
                console.log('  ' + '─'.repeat(68));
                header.split('\n').forEach(line => console.log('  ' + line));
                console.log('  ' + '─'.repeat(68));
            }
        }
    }
    console.log('═'.repeat(70) + '\n');
}

// Run the test
runTest().catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
});
