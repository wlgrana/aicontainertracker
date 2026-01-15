import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const forwarder = formData.get('forwarder') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();

        // Record fileName for DB (Batch ID)
        const fileName = `${Date.now()}-${file.name}`;

        // Read Workbook using SheetJS (XLSX)
        const workbook = XLSX.read(buffer, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
            return NextResponse.json({ error: 'No sheets found in file' }, { status: 400 });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to Array of Arrays to find header
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Sheet is empty' }, { status: 400 });
        }

        // Smart Header Detection
        // Keywords to help identify the header row (logistics domain specific)
        const KNOWN_HEADERS = [
            'shipment', 'container', 'reference', 'status', 'etd', 'eta',
            'atd', 'ata', 'carrier', 'vessel', 'voyage', 'pol', 'pod',
            'mbl', 'hbl', 'weight', 'pieces', 'seal', 'gate', 'date',
            'consignee', 'vendor', 'sz', 'gw', 'wg', 'pcs', 'customer', 'notes', 'type'
        ];

        let headerRowIndex = 0;
        let highestScore = -1;

        // Scan first 25 rows
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
            const row = rows[i];
            let score = 0;
            let filledCells = 0;

            row.forEach(cell => {
                if (cell) {
                    const text = String(cell).toLowerCase();
                    filledCells++;
                    if (KNOWN_HEADERS.some(h => text.includes(h))) {
                        score += 5;
                    } else {
                        score += 1;
                    }
                }
            });

            if (filledCells > 2 && score > highestScore) {
                highestScore = score;
                headerRowIndex = i;
            }
        }

        console.log(`[Upload] Auto-detected headers at row ${headerRowIndex + 1} (Score: ${highestScore})`);

        // Re-read JSON using the detected header row
        // range: headerRowIndex tells sheet_to_json to start reading from that row
        // header: 0 means "use the first row of the range as keys", which is what we want
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            range: headerRowIndex,
            defval: ""
        });

        if (jsonData.length === 0) {
            console.warn("[Upload] Parsed JSON is empty. Header row detection might be wrong or sheet is empty.");
        }

        // Save to ImportLog
        const importLog = await prisma.$transaction(async (tx) => {
            const record = await tx.importLog.create({
                data: {
                    fileName: fileName,
                    fileURL: `/uploads/${fileName}`,
                    status: 'PENDING',
                    rowsProcessed: jsonData.length,
                    forwarder: forwarder || null
                }
            });

            // Prepare batch data
            const rawRowsData = jsonData.map((row: any, index) => ({
                importLogId: record.fileName,
                rowIndex: index,
                rowNumber: index + 1,
                data: JSON.stringify(row)
            }));

            // Batch create
            const BATCH_SIZE = 500;
            for (let i = 0; i < rawRowsData.length; i += BATCH_SIZE) {
                await tx.rawRow.createMany({
                    data: rawRowsData.slice(i, i + BATCH_SIZE)
                });
            }

            return record;
        });

        return NextResponse.json({
            success: true,
            fileId: importLog.fileName,
            rowCount: jsonData.length
        });

    } catch (error: any) {
        console.error('Upload Process Error:', error);
        return NextResponse.json({ error: `Server Error: ${error.message}` }, { status: 500 });
    }
}
