#!/usr/bin/env node
/**
 * Verify Test 2 Results (Second Import - Dictionary Hits)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTest2() {
    console.log('🔍 Verifying Test 2 Results (Dictionary Hits)\n');

    const mappings = await prisma.headerMapping.findMany({
        orderBy: { timesUsed: 'desc' }
    });

    console.log(`Total mappings: ${mappings.length}\n`);

    console.log('Mappings by usage:');
    console.table(
        mappings.slice(0, 10).map(m => ({
            'Excel Header': m.excelHeader,
            'Canonical Field': m.canonicalField,
            'Times Used': m.timesUsed,
            'Last Used': new Date(m.lastUsedAt).toLocaleString()
        }))
    );

    const allUsedTwice = mappings.every(m => m.timesUsed === 2);
    const recentlyUsed = mappings.every(m => {
        const minutesAgo = (Date.now() - new Date(m.lastUsedAt).getTime()) / 1000 / 60;
        return minutesAgo < 5; // Used within last 5 minutes
    });

    console.log(`\n📊 Verification:`);
    console.log(`  All timesUsed = 2: ${allUsedTwice ? '✅' : '❌'}`);
    console.log(`  All recently used: ${recentlyUsed ? '✅' : '❌'}`);

    if (allUsedTwice && recentlyUsed) {
        console.log('\n🎉 SUCCESS! Dictionary is working correctly!');
        console.log('💰 Second import had ZERO AI cost!');
    } else {
        console.log('\n⚠️  Something may be wrong. Check the logs.');
    }

    console.log('\n👉 Now import a DIFFERENT file with some overlapping headers for Test 3');
}

verifyTest2()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
