import { prisma } from './lib/prisma';

// Ensure env is loaded
try { process.loadEnvFile(); } catch (e) { }

async function debugIngestion() {
    console.log("=== DEBUGGING INGESTION ===\n");

    // 1. Check Stages
    const stages = await prisma.transitStage.findMany();
    console.log(`Valid Stages: ${stages.map(s => s.stageName).join(', ')}\n`);

    // 2. Ingest 1 Row Verbose
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx');
    const worksheet = workbook.worksheets[0];

    const headers: string[] = [];
    worksheet.getRow(1).eachCell(c => headers.push(c.text));

    const row = worksheet.getRow(2);
    const rowObj: any = {};
    row.eachCell((cell, colNumber) => {
        rowObj[headers[colNumber - 1]] = cell.text;
    });

    console.log("Row 1 Data:", JSON.stringify(rowObj, null, 2));

    const { detectSchema } = require('./agents/schema-detector');
    const { normalizeData } = require('./agents/data-normalizer');

    const mapping = await detectSchema(headers, [rowObj]);
    console.log("Mapping:", JSON.stringify(mapping.columnMapping, null, 2));

    // Manual fix for Customs Hold
    if (rowObj['Status'] === 'CUSTOMS HOLD') rowObj['Status'] = 'CUSTOMS_HOLD';
    if (rowObj['Current Status'] === 'CUSTOMS HOLD') rowObj['Current Status'] = 'CUSTOMS_HOLD';

    const normalized = await normalizeData(rowObj, mapping);
    console.log("Normalized:", JSON.stringify(normalized, null, 2));

    if (normalized) {
        console.log("Attempting Upsert...");
        try {
            const result = await prisma.container.upsert({
                where: { containerNumber: normalized.container.containerNumber },
                update: normalized.container,
                create: normalized.container
            });
            console.log("Upsert Result:", JSON.stringify(result, null, 2));
        } catch (e: any) {
            console.error("Upsert Failed:", e.message);
        }
    } else {
        console.log("Normalization failed (returned null)");
    }
}

debugIngestion()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
