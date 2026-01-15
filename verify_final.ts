import ExcelJS from 'exceljs';
import fs from 'fs';
import { prisma } from './lib/prisma';

// Ensure env is loaded
try { process.loadEnvFile(); } catch (e) { }

async function verifyFinal() {
    console.log("=== FINAL VERIFICATION ===\n");

    // 1. Get IDs from Excel
    const filePath = 'C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx';
    if (!fs.existsSync(filePath)) {
        console.log("❌ Excel file not found");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const headers: string[] = [];
    worksheet.getRow(1).eachCell(c => headers.push(c.text));
    const colIdx = headers.indexOf('ContainerNumber') + 1;

    if (colIdx === 0) {
        console.log("❌ 'ContainerNumber' column not found");
        return;
    }

    const excelIds: string[] = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const val = row.getCell(colIdx).text;
        if (val) excelIds.push(val);
    });

    console.log(`Found ${excelIds.length} IDs in Excel. Checking first 5:`);
    const checkIds = excelIds.slice(0, 5);
    console.log(checkIds.join(', '));
    console.log('');

    // 2. Check DB
    console.log("Connecting to DB...");
    const found = await prisma.container.findMany({
        where: {
            containerNumber: { in: checkIds }
        }
    });

    console.log(`Found ${found.length} / ${checkIds.length} in Database:\n`);
    found.forEach(c => {
        console.log(`✅ ${c.containerNumber} - Status: ${c.currentStatus}`);
    });

    if (found.length === 0) {
        console.log("\n❌ No containers found in DB. Troubleshooting info:");
        const count = await prisma.container.count();
        console.log(`Total containers in DB: ${count}`);
        const log = await prisma.importLog.findFirst({ orderBy: { importedOn: 'desc' } });
        console.log(`Latest Import Log: ${log?.fileName} (${log?.status})`);
    } else {
        console.log("\n✅ Verification Successful!");
    }
}

verifyFinal()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
