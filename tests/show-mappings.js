const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function detailedCheck() {
    const mappings = await prisma.headerMapping.findMany({
        orderBy: [
            { timesUsed: 'desc' },
            { excelHeader: 'asc' }
        ]
    });

    console.log('\n🔍 DETAILED MAPPING ANALYSIS:\n');

    mappings.forEach(m => {
        console.log(`\nHeader: "${m.excelHeader}"`);
        console.log(`  → Field: ${m.canonicalField}`);
        console.log(`  → Confidence: ${(m.confidence * 100).toFixed(1)}%`);
        console.log(`  → Times Used: ${m.timesUsed}`);
        console.log(`  → Created: ${m.createdAt.toLocaleString()}`);
        console.log(`  → Last Used: ${m.lastUsedAt.toLocaleString()}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${mappings.length} mappings`);
    console.log(`Usage counts: ${[...new Set(mappings.map(m => m.timesUsed))].join(', ')}`);
    console.log('='.repeat(60));

    await prisma.$disconnect();
}

detailedCheck();
