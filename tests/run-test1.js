#!/usr/bin/env node
/**
 * Dictionary Learning Test Runner
 * 
 * This script helps you run the dictionary learning tests
 * and verify the results.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
    console.log('🧪 Dictionary Learning Test Suite\n');

    // Test 1: Clear and verify
    console.log('📋 Test 1: Clearing dictionary...');
    const deleted = await prisma.headerMapping.deleteMany();
    console.log(`✅ Deleted ${deleted.count} mappings\n`);

    const count = await prisma.headerMapping.count();
    console.log(`Current mapping count: ${count}`);
    console.log('👉 Now import your test file and observe the logs\n');

    console.log('Press Ctrl+C after first import, then run:');
    console.log('  node tests/verify-test1.js\n');
}

runTests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
