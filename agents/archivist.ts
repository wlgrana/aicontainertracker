
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ArchivistInput, ArchivistOutput } from '../types/agents';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export async function archiveExcelFile(input: ArchivistInput): Promise<ArchivistOutput> {
    console.log(`[Archivist] Processing file: ${input.filePath}`);

    // 1. Read File Metadata
    const fileBuffer = fs.readFileSync(input.filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const stats = fs.statSync(input.filePath);

    // 2. Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false }); // keep dates as serial or strings
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON (array of arrays for raw preservation)
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

    if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
    }

    // Extract headers (first row) and data
    // Note: We attempt to find the header row. For now, assume row 0.
    // Future improvement: Heuristic header detection manually or via simple rule
    const headers = (jsonData[0] as any[]).map(h => String(h || '').trim());
    const rows = jsonData.slice(1);

    // 3. Create ImportLog
    // We use input.fileName as ID if it's unique, or we might need UUID if collision risks exist.
    // The schema uses fileName @id, so we must ensure it's unique or handle upsert.
    // For safety in this refactor, let's try to create fresh or update.
    const importLog = await prisma.importLog.upsert({
        where: { fileName: input.fileName },
        update: {
            importedOn: new Date(),
            status: 'PROCESSING',
            rowsProcessed: 0,
            rowsSucceeded: 0,
            rowsFailed: 0,
            errorLog: null,
            summary: null,
            completedAt: null
        },
        create: {
            fileName: input.fileName,
            fileURL: input.filePath, // Storing local path for now
            importedBy: input.uploadedBy || 'SYSTEM',
            importedOn: new Date(),
            status: 'PROCESSING',
        }
    });

    console.log(`[Archivist] ImportLog created: ${importLog.fileName}`);

    // 4. Store each row as RawRow
    const rawRowIds: string[] = [];

    // Batch insert optimization could be used here, but for now we loop
    // to get IDs back easily or use createMany and query back.
    // Let's use createMany for speed, then fetch them back.

    const rawRowData = rows.map((row, index) => ({
        importLogId: importLog.fileName,
        rowIndex: index,         // 0-based index
        rowNumber: index + 1,    // 1-based index (header is 0)
        data: JSON.stringify(row),
        originalHeaders: JSON.stringify(headers)
    }));

    if (rawRowData.length > 0) {
        await prisma.rawRow.createMany({
            data: rawRowData
        });

        // Fetch back the IDs
        const createdRows = await prisma.rawRow.findMany({
            where: { importLogId: importLog.fileName },
            select: { id: true, rowNumber: true }
        });

        // Sort by rowNumber to ensure order matches input
        createdRows.sort((a, b) => a.rowNumber - b.rowNumber);
        rawRowIds.push(...createdRows.map(r => r.id));
    }

    console.log(`[Archivist] Archived ${rows.length} rows.`);

    return {
        importLogId: importLog.fileName,
        rawRowIds,
        headers,
        rowCount: rows.length,
        fileMetadata: {
            fileName: input.fileName,
            sheetName,
            uploadedAt: new Date().toISOString(),
            fileHash
        }
    };
}
