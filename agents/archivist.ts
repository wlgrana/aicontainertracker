
import { PrismaClient, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ArchivistInput, ArchivistOutput } from '../types/agents';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { generateAIResponse } from '../lib/ai';

const prisma = new PrismaClient();

async function detectHeaderWithAI(jsonData: any[][]): Promise<{ rowIndex: number, headers: string[] } | null> {
    const slice = jsonData.slice(0, 25);
    const simpleData = slice.map(row => (Array.isArray(row) ? row.map(c => String(c || '').trim()) : []));

    const dataStr = JSON.stringify(simpleData);
    const prompt = `
    You are a Data Archivist. Analyze the provided raw Excel data (first 25 rows).
    Your task is to identify the **Header Row** for the main data table.
    - The header row defines the columns (e.g., "Container Number", "Status", "Date", "Shipment ID").
    - Rows above the header are often title/metadata (ignore them).
    - Rows below the header are data (ignore them).
    
    Data Source:
    ${dataStr}

    RETURN ONLY AND EXACTLY A JSON OBJECT (no markdown, no comments):
    {
        "rowIndex": <number, 0-based index of the header row>,
        "headers": <array of strings, the detected headers>
    }
    `;

    try {
        console.log("[Archivist] Consulting AI for header detection...");
        const text = await generateAIResponse(prompt, 0.1);
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("Invalid JSON response");
        return JSON.parse(cleaned.substring(start, end + 1));
    } catch (e) {
        console.warn("[Archivist] AI Header Detection Failed:", e);
        return null;
    }
}

export async function archiveExcelFile(input: ArchivistInput): Promise<ArchivistOutput> {
    console.log(`[Archivist] Processing file: ${input.filePath}`);

    // 1. Read File Metadata
    const fileBuffer = fs.readFileSync(input.filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const sheetName = 'Sheet1'; // Default or from workbook

    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
    const actualSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[actualSheetName];

    // Convert to JSON
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

    if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
    }

    // --- Header Detection Strategy ---
    let headerRowIndex = 0;
    let headers: string[] = [];

    // Attempt 1: AI Detection
    const aiResult = await detectHeaderWithAI(jsonData);

    if (aiResult && typeof aiResult.rowIndex === 'number') {
        console.log(`[Archivist] AI identified header at Row ${aiResult.rowIndex}`);
        headerRowIndex = aiResult.rowIndex;
        // Trust AI for index, but fetch from raw to be safe, or use AI provided headers?
        // Using raw headers is safer for exact string matching.
        const rawHeaderRow = jsonData[headerRowIndex] as any[];
        headers = rawHeaderRow.map(h => String(h || '').trim());
    } else {
        // Attempt 2: Smart Heuristic Fallback
        console.log("[Archivist] Fallback to Heuristic Detection.");

        const HEADER_KEYWORDS = [
            'container', 'unit', 'equipment',
            'shipment', 'bill', 'lading', 'mbl', 'hbl',
            'reference', 'po',
            'origin', 'pol', 'destination', 'pod',
            'etd', 'eta', 'atd', 'ata',
            'status', 'event', 'remark',
            'carrier', 'vessel', 'voyage',
            'pieces', 'weight', 'volume',
            'date', 'time', 'location'
        ];

        let maxMatches = -999;
        let bestHeaderRow = 0;
        const scanLimit = Math.min(jsonData.length, 25);

        for (let i = 0; i < scanLimit; i++) {
            const row = jsonData[i];
            if (!Array.isArray(row)) continue;

            const usefulCells = row.map(c => String(c || '').toLowerCase().trim()).filter(s => s.length > 0);
            let keywordMatches = 0;

            for (const cell of usefulCells) {
                if (HEADER_KEYWORDS.some(kw => cell.includes(kw))) {
                    keywordMatches++;
                }
            }

            let numericCount = 0;
            for (const c of row) {
                if (typeof c === 'number' || (typeof c === 'string' && !isNaN(parseFloat(c)) && isFinite(Number(c)) && c.trim() !== '')) {
                    numericCount++;
                }
            }

            const numericRatio = usefulCells.length > 0 ? (numericCount / usefulCells.length) : 0;
            if (numericRatio > 0.25) {
                keywordMatches = -100;
            }

            if (keywordMatches > maxMatches) {
                maxMatches = keywordMatches;
                bestHeaderRow = i;
            }
        }

        if (maxMatches >= 1) {
            headerRowIndex = bestHeaderRow;
        } else {
            headerRowIndex = 0;
        }
        headers = (jsonData[headerRowIndex] as any[]).map(h => String(h || '').trim());
    }

    let rows = jsonData.slice(headerRowIndex + 1);

    // Apply strict user-defined row limit if provided
    if (input.rowLimit && rows.length > input.rowLimit) {
        console.log(`[Archivist] Applying user defined limit: ${input.rowLimit} rows (from ${rows.length})`);
        rows = rows.slice(0, input.rowLimit);
    }

    // 3. Create ImportLog
    const importLog = await prisma.importLog.upsert({
        where: { fileName: input.fileName },
        update: {
            importedOn: new Date(),
            status: 'PROCESSING',
            rowsProcessed: 0,
            rowsSucceeded: 0,
            rowsFailed: 0,
            errorLog: null,
            summary: Prisma.JsonNull,
            completedAt: null
        },
        create: {
            fileName: input.fileName,
            fileURL: input.filePath,
            importedBy: input.uploadedBy || 'SYSTEM',
            importedOn: new Date(),
            status: 'PROCESSING',
        }
    });

    // 3.5 Clear existing raw rows for this run (Idempotency)
    await prisma.rawRow.deleteMany({
        where: { importLogId: importLog.fileName }
    });

    console.log(`[Archivist] ImportLog created: ${importLog.fileName}`);

    // 4. Store each row as RawRow
    let rawRowIds: string[] = [];
    const rawRowData = rows.map((row, index) => {
        // Convert array row to object using headers
        const rowObj: any = {};
        headers.forEach((h, i) => {
            rowObj[h] = row[i];
        });

        return {
            importLogId: importLog.fileName,
            rowIndex: index,
            rowNumber: index + 1,
            data: JSON.stringify(rowObj),
            originalHeaders: JSON.stringify(headers)
        };
    });

    if (rawRowData.length > 0) {
        // Use chunks if necessary, but createMany handles reasonably large batches
        await prisma.rawRow.createMany({ data: rawRowData });

        const createdRows = await prisma.rawRow.findMany({
            where: { importLogId: importLog.fileName },
            select: { id: true, rowNumber: true }
        });
        createdRows.sort((a, b) => a.rowNumber - b.rowNumber);

        rawRowIds = createdRows.map(r => r.id);
    }

    console.log(`[Archivist] Archived ${rows.length} rows.`);
    if (process.env.LOG_LEVEL === 'trace') {
        console.log(`[Archivist-TRACE] Raw Rows:`);
        console.log(JSON.stringify(rawRowData, null, 2));
    }

    return {
        importLogId: importLog.fileName,
        rawRowIds,
        headers,
        rowCount: rows.length,
        fileMetadata: {
            fileName: input.fileName,
            sheetName: actualSheetName,
            uploadedAt: new Date().toISOString(),
            fileHash
        }
    };
}
