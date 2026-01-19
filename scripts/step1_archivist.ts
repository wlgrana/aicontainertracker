
import { PrismaClient } from '@prisma/client';
import { archiveExcelFile } from '../agents/archivist';
import { updateStatus } from './simulation-utils';
import * as path from 'path';

const prisma = new PrismaClient();
import * as fs from 'fs';

const FILENAME = process.argv[2] || "Horizon Tracking Report.xlsx";
let FILE_PATH = path.join(process.cwd(), 'uploads', FILENAME);

if (!fs.existsSync(FILE_PATH)) {
    FILE_PATH = path.join(process.cwd(), FILENAME);
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`[Archivist] File not found: ${FILENAME} (Checked uploads/ and root)`);
        // updateStatus fails here if DB connection needed? No, standard util.
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: File ${FILENAME} not found` });
        process.exit(1);
    }
}

async function main() {
    try {
        // --- RESET ---
        updateStatus({ step: 'RESET', progress: 5, message: 'Wiping Database...' });
        console.log("⚠️  RESETTING DATABASE...");

        // await prisma.agentProcessingLog.deleteMany();
        // CLEAN DB (Optional, for simulation reset) - DISABLED PER USER REQUEST
        // try { await prisma.agentProcessingLog.deleteMany(); } catch (e) { } // Ignore if missing
        // try { await prisma.improvementJob.deleteMany(); } catch (e) { }
        // await prisma.activityLog.deleteMany();
        // await prisma.containerEvent.deleteMany();
        // await prisma.shipmentContainer.deleteMany();
        // await prisma.shipment.deleteMany();
        // await prisma.container.deleteMany();
        // await prisma.rawRow.deleteMany();
        // await prisma.importLog.deleteMany();

        console.log("✅ Database Wipe Disabled (Preserving Data).");

        // --- ARCHIVIST ---
        updateStatus({ step: 'ARCHIVIST', progress: 10, message: `Ingesting ${FILENAME}...`, agentData: {} });
        const limitArg = process.argv[3];
        const rowLimit = limitArg && limitArg !== 'all' ? parseInt(limitArg, 10) : undefined;

        console.log(`[Archivist] Processing ${FILENAME} (Limit: ${rowLimit || 'ALL'})...`);

        const archiveResult = await archiveExcelFile({
            filePath: FILE_PATH,
            fileName: FILENAME,
            uploadedBy: "SIMULATION",
            rowLimit: rowLimit
        });

        // Fetch sample for dashboard
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: archiveResult.importLogId },
            orderBy: { rowNumber: 'asc' },
            take: 1
        });

        const sampleRow = rawRows.length > 0 ? JSON.parse(rawRows[0].data) : {};
        const headers = archiveResult.headers;

        // LOGGING: Update ImportLog with analysis info
        await prisma.importLog.update({
            where: { fileName: archiveResult.importLogId },
            data: {
                rowsProcessed: archiveResult.rowCount,
                aiAnalysis: {
                    phase: 'ARCHIVIST',
                    detectedHeaders: headers,
                    rowCount: archiveResult.rowCount,
                    timestamp: new Date().toISOString()
                }
            }
        });

        updateStatus({
            step: 'ARCHIVIST_COMPLETE',
            progress: 25,
            message: `Ingested ${archiveResult.rowCount} rows from ${FILENAME}. Waiting for approval...`,
            metrics: {
                source: {
                    filename: FILENAME,
                    totalRows: archiveResult.rowCount,
                    totalCols: headers.length
                }
            },
            agentData: {
                archivist: {
                    filename: FILENAME,
                    rowCount: archiveResult.rowCount,
                    headers: headers, // Full list
                    sampleRow: sampleRow
                }
            }
        });

        console.log("STEP 1 Complete. Waiting for user.");

    } catch (error) {
        console.error("Step 1 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
