#!/usr/bin/env node
/**
 * Automated Dictionary Learning Test
 * Runs a complete import and captures the dictionary learning behavior
 */

const { orchestrateImport } = require('../lib/import-orchestrator');
const path = require('path');

async function runTest() {
    console.log('🧪 DICTIONARY LEARNING TEST - AUTOMATED\n');
    console.log('='.repeat(60));

    const testFile = path.join(process.cwd(), 'testdata', 'test_vendor_standard.xlsx');
    const fileName = 'test_vendor_standard.xlsx';

    console.log(`\n📁 Test File: ${fileName}`);
    console.log(`📍 Path: ${testFile}\n`);
    console.log('='.repeat(60));
    console.log('\n🚀 Starting Import...\n');

    try {
        const result = await orchestrateImport(
            testFile,
            fileName,
            'TEST_RUNNER',
            {
                enrichDuringImport: false,
                rowLimit: 10 // Limit to 10 rows for faster testing
            }
        );

        console.log('\n' + '='.repeat(60));
        console.log('✅ IMPORT COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log('\nResult Summary:');
        console.log(`  Import Log ID: ${result.importLogId}`);
        console.log(`  Containers Created: ${result.containersCreated}`);
        console.log(`  Events Created: ${result.eventsCreated}`);
        console.log(`  Decision: ${result.decision}`);
        console.log(`  Audit Summary: ${result.auditSummary.total} total, ${result.auditSummary.failed} failed`);

        console.log('\n' + '='.repeat(60));
        console.log('📊 NOW RUN: node tests/verify-test1.js');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ IMPORT FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runTest();
