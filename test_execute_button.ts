import { prisma } from './lib/prisma';

/**
 * Test the Execute button on import-history page
 * This will verify that PENDING imports can be processed
 */

async function testExecuteButton() {
    console.log("=== TESTING EXECUTE BUTTON ===\n");

    // Find the PENDING test import
    const pendingImport = await prisma.importLog.findFirst({
        where: {
            fileName: 'test_pending_import.csv',
            status: 'PENDING'
        }
    });

    if (!pendingImport) {
        console.log("❌ PENDING test import not found!");
        console.log("Run 'npx tsx setup_import_history_tests.ts' first.\n");
        return;
    }

    console.log("✅ Found PENDING import:");
    console.log(`   File: ${pendingImport.fileName}`);
    console.log(`   Status: ${pendingImport.status}`);
    console.log(`   Rows: ${pendingImport.rowsProcessed}\n`);

    console.log("📋 MANUAL TEST INSTRUCTIONS:");
    console.log("1. Open http://localhost:3000/import-history");
    console.log("2. Find 'test_pending_import.csv' in the list");
    console.log("3. Click the blue 'Execute' button");
    console.log("4. Verify the ProcessingStatus modal appears");
    console.log("5. Watch the progress through:");
    console.log("   - File Uploaded ✓");
    console.log("   - Schema Analysis (running...)");
    console.log("   - Data Normalization (running...)");
    console.log("   - Exception Mining (running...)");
    console.log("6. Verify the status changes to COMPLETED");
    console.log("7. Check that containers were created in the database\n");

    console.log("Expected Result:");
    console.log("- Modal shows processing steps");
    console.log("- Status updates to COMPLETED");
    console.log("- 3 containers created (TEST001, TEST002, TEST003)");
    console.log("- Mission Oracle button appears after completion\n");
}

testExecuteButton()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
