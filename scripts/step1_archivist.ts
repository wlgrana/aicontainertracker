
import { PrismaClient } from '@prisma/client';
import { archiveExcelFile } from '../agents/archivist';
import { updateStatus } from './simulation-utils';
import * as path from 'path';
import { getUploadPath } from '../lib/path-utils';

const prisma = new PrismaClient();
import * as fs from 'fs';

/**
 * Main Archivist function - exported for Vercel direct execution
 * @param config Configuration object with filename, rowLimit, and forwarder
 */
export async function runArchivistStep(config: {
    filename?: string;
    rowLimit?: number;
    forwarder?: string;
}) {
    const FILENAME = config.filename || "Horizon Tracking Report.xlsx";
    let FILE_PATH = getUploadPath(FILENAME);

    if (!fs.existsSync(FILE_PATH)) {
        FILE_PATH = path.join(process.cwd(), FILENAME);
        if (!fs.existsSync(FILE_PATH)) {
            console.error(`[Archivist] File not found: ${FILENAME} (Checked uploads/ and root)`);
            updateStatus({ step: 'IDLE', progress: 0, message: `Error: File ${FILENAME} not found` });
            throw new Error(`File not found: ${FILENAME}`);
        }
    }

    try {
        // --- RESET ---
        updateStatus({ step: 'RESET', progress: 5, message: 'Wiping Database...' });
        console.log("⚠️  RESETTING DATABASE...");

        console.log("✅ Database Wipe Disabled (Preserving Data).");

        // --- ARCHIVIST ---
        updateStatus({ step: 'ARCHIVIST', progress: 10, message: `Ingesting ${FILENAME}...`, agentData: {} });

        console.log(`[Archivist] Processing ${FILENAME} (Limit: ${config.rowLimit || 'ALL'}, Forwarder: ${config.forwarder || 'None'})...`);

        const archiveResult = await archiveExcelFile({
            filePath: FILE_PATH,
            fileName: FILENAME,
            uploadedBy: "SIMULATION",
            rowLimit: config.rowLimit
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
                forwarder: config.forwarder && config.forwarder !== 'null' && config.forwarder !== 'undefined' ? config.forwarder : null,
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
                    headers: headers,
                    sampleRow: sampleRow
                }
            }
        });

        console.log("STEP 1 Complete. Waiting for user.");

        return {
            success: true,
            filename: FILENAME,
            rowCount: archiveResult.rowCount,
            headers: headers
        };

    } catch (error) {
        console.error("Step 1 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// ✅ Only run as script if called directly (for local spawn)
async function main() {
    const limitArg = process.argv[3];
    const rowLimit = limitArg && limitArg !== 'all' ? parseInt(limitArg, 10) : undefined;
    const forwarderArg = process.argv[4];

    await runArchivistStep({
        filename: process.argv[2] || "Horizon Tracking Report.xlsx",
        rowLimit: rowLimit,
        forwarder: forwarderArg
    });
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[Archivist] Error:', err);
        process.exit(1);
    });
}
