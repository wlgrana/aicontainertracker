import { prisma } from './lib/prisma';

/**
 * Test Scenario Setup: Create imports in different states
 * This script seeds the database with test import logs to verify
 * the Execute and Verify Map button functionality
 */

async function setupTestScenarios() {
    console.log("=== SETTING UP TEST SCENARIOS ===\n");

    // Scenario 1: PENDING import (should show Execute button)
    console.log("Creating PENDING import...");
    const pendingImport = await prisma.importLog.create({
        data: {
            fileName: 'test_pending_import.csv',
            fileURL: 'local_test',
            status: 'PENDING',
            rowsProcessed: 3,
            importedOn: new Date(),
            rawRows: {
                create: [
                    {
                        rowNumber: 1,
                        data: JSON.stringify({
                            'Container Number': 'TEST001',
                            'Status': 'In Transit',
                            'Location': 'Shanghai'
                        })
                    },
                    {
                        rowNumber: 2,
                        data: JSON.stringify({
                            'Container Number': 'TEST002',
                            'Status': 'Delivered',
                            'Location': 'Los Angeles'
                        })
                    },
                    {
                        rowNumber: 3,
                        data: JSON.stringify({
                            'Container Number': 'TEST003',
                            'Status': 'Customs Hold',
                            'Location': 'New York'
                        })
                    }
                ]
            }
        }
    });
    console.log(`✅ Created: ${pendingImport.fileName} (Status: PENDING)\n`);

    // Scenario 2: AWAITING_CONFIRMATION import (should show Verify Map button)
    console.log("Creating AWAITING_CONFIRMATION import...");
    const awaitingImport = await prisma.importLog.create({
        data: {
            fileName: 'test_awaiting_confirmation.csv',
            fileURL: 'local_test',
            status: 'AWAITING_CONFIRMATION',
            rowsProcessed: 2,
            importedOn: new Date(),
            rawRows: {
                create: [
                    {
                        rowNumber: 1,
                        data: JSON.stringify({
                            'Container ID': 'TEST004',
                            'Current Status': 'At Sea',
                            'Port': 'Singapore'
                        })
                    },
                    {
                        rowNumber: 2,
                        data: JSON.stringify({
                            'Container ID': 'TEST005',
                            'Current Status': 'Arrived',
                            'Port': 'Rotterdam'
                        })
                    }
                ]
            }
        }
    });
    console.log(`✅ Created: ${awaitingImport.fileName} (Status: AWAITING_CONFIRMATION)\n`);

    // Scenario 3: COMPLETED import with AI analysis (should show Mission Oracle button)
    console.log("Creating COMPLETED import with AI analysis...");
    const completedImport = await prisma.importLog.create({
        data: {
            fileName: 'test_completed_with_analysis.csv',
            fileURL: 'local_test',
            status: 'COMPLETED',
            rowsProcessed: 2,
            rowsSucceeded: 2,
            rowsFailed: 0,
            importedOn: new Date(Date.now() - 3600000), // 1 hour ago
            aiAnalysis: {
                summary: "Test import completed successfully",
                dataQuality: {
                    score: 95,
                    issues: []
                },
                criticalAlerts: [],
                recommendations: ["All containers processed successfully"]
            }
        }
    });
    console.log(`✅ Created: ${completedImport.fileName} (Status: COMPLETED, Has AI Analysis)\n`);

    // Scenario 4: FAILED import
    console.log("Creating FAILED import...");
    const failedImport = await prisma.importLog.create({
        data: {
            fileName: 'test_failed_import.csv',
            fileURL: 'local_test',
            status: 'FAILED',
            rowsProcessed: 1,
            rowsSucceeded: 0,
            rowsFailed: 1,
            importedOn: new Date(Date.now() - 7200000), // 2 hours ago
            errorLog: 'Foreign key constraint failed on status field'
        }
    });
    console.log(`✅ Created: ${failedImport.fileName} (Status: FAILED)\n`);

    console.log("=== TEST SCENARIOS READY ===");
    console.log("\nYou can now:");
    console.log("1. Navigate to http://localhost:3000/import-history");
    console.log("2. Verify the following buttons appear:");
    console.log("   - Execute button for 'test_pending_import.csv'");
    console.log("   - Verify Map button for 'test_awaiting_confirmation.csv'");
    console.log("   - Mission Oracle button for 'test_completed_with_analysis.csv'");
    console.log("3. Test clicking each button to verify functionality\n");
}

setupTestScenarios()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
