#!/usr/bin/env node
/**
 * Verify Test 1 Results
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTest1() {
    console.log('🔍 Verifying Test 1 Results\n');

    const mappings = await prisma.headerMapping.findMany({
        orderBy: { confidence: 'desc' }
    });

    console.log(`Total mappings learned: ${mappings.length}\n`);

    console.log('Top 10 mappings by confidence:');
    console.table(
        mappings.slice(0, 10).map(m => ({
            'Excel Header': m.excelHeader,
            'Canonical Field': m.canonicalField,
            'Confidence': (m.confidence * 100).toFixed(0) + '%',
            'Times Used': m.timesUsed
        }))
    );

    const highConf = mappings.filter(m => m.confidence >= 0.9).length;
    const avgConf = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;

    console.log(`\n📊 Stats:`);
    console.log(`  High confidence (≥90%): ${highConf}/${mappings.length}`);
    console.log(`  Average confidence: ${(avgConf * 100).toFixed(1)}%`);
    console.log(`  All timesUsed should be 1: ${mappings.every(m => m.timesUsed === 1) ? '✅' : '❌'}`);

    console.log('\n👉 Now import the SAME file again for Test 2');
}

verifyTest1()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
