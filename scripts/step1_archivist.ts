console.log('========================================');
console.log('[ARCHIVIST SCRIPT] EXECUTING AT:', new Date().toISOString());
console.log('[ARCHIVIST SCRIPT] Process ID:', process.pid);
console.log('[ARCHIVIST SCRIPT] Arguments:', process.argv);
console.log('========================================');

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
    console.log('[ARCHIVIST] Starting...');
    console.log('[ARCHIVIST] Config:', JSON.stringify(config, null, 2));
    console.log('[ARCHIVIST] CWD:', process.cwd());
    console.log('[ARCHIVIST] Environment:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        isVercel: process.env.VERCEL === '1'
    });

    const FILENAME = config.filename || "Horizon Tracking Report.xlsx";
    console.log('[ARCHIVIST] Target filename:', FILENAME);

    let FILE_PATH = getUploadPath(FILENAME);
    console.log('[ARCHIVIST] Initial file path from getUploadPath:', FILE_PATH);

    if (!fs.existsSync(FILE_PATH)) {
        console.log('[ARCHIVIST] File not found at upload path, trying root...');
        FILE_PATH = path.join(process.cwd(), FILENAME);
        console.log('[ARCHIVIST] Trying path:', FILE_PATH);

        if (!fs.existsSync(FILE_PATH)) {
            console.error(`[ARCHIVIST] File not found: ${FILENAME}`);
            console.error(`[ARCHIVIST] Checked paths: ${getUploadPath(FILENAME)}, ${FILE_PATH}`);
            await updateStatus({ step: 'IDLE', progress: 0, message: `Error: File ${FILENAME} not found` });
            throw new Error(`File not found: ${FILENAME}`);
        }
    }
    console.log('[ARCHIVIST] File found at:', FILE_PATH);

    try {
        // --- RESET ---
        console.log('[ARCHIVIST] Step 1: Updating status to RESET...');
        await updateStatus({ step: 'RESET', progress: 5, message: 'Wiping Database...' });
        console.log("⚠️  RESETTING DATABASE...");

        console.log("✅ Database Wipe Disabled (Preserving Data).");

        // --- ARCHIVIST ---
        console.log('[ARCHIVIST] Step 2: Updating status to ARCHIVIST...');
        await updateStatus({ step: 'ARCHIVIST', progress: 10, message: `Ingesting ${FILENAME}...`, agentData: {} });

        console.log(`[ARCHIVIST] Step 3: Processing ${FILENAME} (Limit: ${config.rowLimit || 'ALL'}, Forwarder: ${config.forwarder || 'None'})...`);

        console.log('[ARCHIVIST] Step 4: Calling archiveExcelFile...');
        const archiveResult = await archiveExcelFile({
            filePath: FILE_PATH,
            fileName: FILENAME,
            uploadedBy: "SIMULATION",
            rowLimit: config.rowLimit
        });
        console.log('[ARCHIVIST] archiveExcelFile completed:', {
            importLogId: archiveResult.importLogId,
            rowCount: archiveResult.rowCount,
            headerCount: archiveResult.headers.length
        });

        // Fetch sample for dashboard
        console.log('[ARCHIVIST] Step 5: Fetching sample raw rows...');
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: archiveResult.importLogId },
            orderBy: { rowNumber: 'asc' },
            take: 1
        });
        console.log('[ARCHIVIST] Fetched', rawRows.length, 'sample rows');

        const sampleRow = rawRows.length > 0 ? JSON.parse(rawRows[0].data) : {};
        const headers = archiveResult.headers;

        // LOGGING: Update ImportLog with analysis info
        console.log('[ARCHIVIST] Step 6: Updating ImportLog with analysis...');
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
        console.log('[ARCHIVIST] ImportLog updated successfully');

        console.log('[ARCHIVIST] Step 7: Updating final status...');
        await updateStatus({
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
        console.log('[ARCHIVIST] Returning success result');

        return {
            success: true,
            filename: FILENAME,
            rowCount: archiveResult.rowCount,
            headers: headers
        };

    } catch (error) {
        console.error("[ARCHIVIST] ERROR:", error);
        console.error("[ARCHIVIST] Error message:", error instanceof Error ? error.message : String(error));
        console.error("[ARCHIVIST] Error stack:", error instanceof Error ? error.stack : 'No stack');
        await updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
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
