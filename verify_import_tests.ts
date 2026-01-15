import { prisma } from './lib/prisma';

async function verifyTestSetup() {
    console.log("=== VERIFYING TEST IMPORT SETUP ===\n");

    const imports = await prisma.importLog.findMany({
        where: {
            fileName: {
                startsWith: 'test_'
            }
        },
        orderBy: {
            importedOn: 'desc'
        },
        include: {
            rawRows: true
        }
    });

    console.log(`Found ${imports.length} test imports:\n`);

    imports.forEach((imp, idx) => {
        console.log(`${idx + 1}. ${imp.fileName}`);
        console.log(`   Status: ${imp.status}`);
        console.log(`   Rows: ${imp.rowsProcessed}`);
        console.log(`   Raw Rows Saved: ${imp.rawRows.length}`);
        console.log(`   Has AI Analysis: ${imp.aiAnalysis ? 'YES' : 'NO'}`);
        console.log(`   Imported: ${imp.importedOn.toISOString()}`);

        // Determine which button should appear
        let expectedButton = 'None';
        if (imp.status === 'PENDING') {
            expectedButton = '🔵 Execute';
        } else if (imp.status === 'AWAITING_CONFIRMATION') {
            expectedButton = '🟡 Verify Map';
        } else if (imp.status === 'COMPLETED' && imp.aiAnalysis) {
            expectedButton = '🟣 Mission Oracle';
        } else if (imp.status === 'FAILED') {
            expectedButton = '🔴 (No action button)';
        }

        console.log(`   Expected Button: ${expectedButton}`);
        console.log('');
    });

    console.log("\n=== MANUAL TESTING INSTRUCTIONS ===");
    console.log("1. Open http://localhost:3000/import-history in your browser");
    console.log("2. Verify the buttons appear as listed above");
    console.log("3. Test each button:");
    console.log("   - Execute: Should show alert (current behavior) or process file (ideal)");
    console.log("   - Verify Map: Should show alert (current) or open mapping modal (ideal)");
    console.log("   - Mission Oracle: Should open AI analysis modal");
    console.log("\n");
}

verifyTestSetup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
