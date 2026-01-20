#!/usr/bin/env tsx
/**
 * Quick test to verify log metadata headers are working correctly
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const testLogFile = path.join(process.cwd(), 'logs', 'test_metadata_header.log');

console.log('Testing log metadata header generation...\n');

// Clean up any existing test log
if (fs.existsSync(testLogFile)) {
    fs.unlinkSync(testLogFile);
}

// Set environment to simulate script invocation (default)
const env = { ...process.env };
// Don't set INVOKED_BY - should default to 'SCRIPT'

console.log('Environment for test:');
console.log('  VERCEL:', env.VERCEL || 'not set');
console.log('  NODE_ENV:', env.NODE_ENV || 'not set');
console.log('  INVOKED_BY:', env.INVOKED_BY || 'not set (should default to SCRIPT)');
console.log('');

// Create a minimal status file for the test
const statusFile = path.join(process.cwd(), 'simulation_status.json');
const testStatus = {
    step: 'IDLE',
    logFilename: 'test_metadata_header.log'
};
fs.writeFileSync(statusFile, JSON.stringify(testStatus, null, 2));

console.log('Running step 1 to generate log header...');

// Run step 1 with tsx
const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [
    tsxPath,
    'scripts/run_step.ts',
    '1',
    'test_file.xlsx',
    '1' // Only process 1 row
], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit'
});

child.on('close', (code) => {
    console.log(`\nStep 1 exited with code ${code}\n`);

    // Read and display the log header
    if (fs.existsSync(testLogFile)) {
        const logContent = fs.readFileSync(testLogFile, 'utf-8');
        const headerEnd = logContent.indexOf('>>>');
        const header = headerEnd > 0 ? logContent.substring(0, headerEnd) : logContent;

        console.log('Generated Log Header:');
        console.log('═'.repeat(60));
        console.log(header);
        console.log('═'.repeat(60));

        // Verify expected fields
        const hasTimestamp = header.includes('Timestamp:');
        const hasEnvironment = header.includes('Environment:');
        const hasInvocation = header.includes('Invocation Method:');
        const hasLogFile = header.includes('Log File:');

        console.log('\nValidation:');
        console.log('  ✓ Timestamp:', hasTimestamp ? 'PASS' : 'FAIL');
        console.log('  ✓ Environment:', hasEnvironment ? 'PASS' : 'FAIL');
        console.log('  ✓ Invocation Method:', hasInvocation ? 'PASS' : 'FAIL');
        console.log('  ✓ Log File:', hasLogFile ? 'PASS' : 'FAIL');

        if (hasTimestamp && hasEnvironment && hasInvocation && hasLogFile) {
            console.log('\n✅ All metadata fields present!');
        } else {
            console.log('\n❌ Some metadata fields missing!');
        }
    } else {
        console.log('❌ Test log file was not created!');
    }

    process.exit(code || 0);
});
