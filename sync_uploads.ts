
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function syncUploads() {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.xlsx'));

    console.log(`Found ${files.length} files in uploads.`);

    for (const fileName of files) {
        // Check if already in DB
        const existing = await prisma.importLog.findUnique({ where: { fileName } });
        if (existing) {
            console.log(`- Skipping ${fileName} (already exists)`);
            continue;
        }

        console.log(`- Syncing ${fileName}...`);

        try {
            const buffer = fs.readFileSync(path.join(uploadsDir, fileName));
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];

            const jsonData: any[] = [];
            const headers: string[] = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    row.eachCell((cell) => {
                        headers.push(cell.text);
                    });
                } else {
                    const rowData: any = {};
                    row.eachCell((cell, colNumber) => {
                        rowData[headers[colNumber - 1]] = cell.text;
                    });
                    jsonData.push(rowData);
                }
            });

            await prisma.$transaction(async (tx) => {
                const record = await tx.importLog.create({
                    data: {
                        fileName: fileName,
                        fileURL: `/uploads/${fileName}`,
                        status: 'PENDING',
                        rowsProcessed: jsonData.length
                    }
                });

                const rawRowsData = jsonData.map((row, index) => ({
                    importLogId: record.fileName,
                    rowIndex: index,
                    rowNumber: index + 1,
                    data: JSON.stringify(row)
                }));

                const BATCH_SIZE = 500;
                for (let i = 0; i < rawRowsData.length; i += BATCH_SIZE) {
                    await tx.rawRow.createMany({
                        data: rawRowsData.slice(i, i + BATCH_SIZE)
                    });
                }
            });

            console.log(`  Succeeded: ${jsonData.length} rows staged.`);
        } catch (e) {
            console.error(`  Failed to sync ${fileName}:`, e);
        }
    }
}

syncUploads().catch(console.error).finally(() => prisma.$disconnect());
