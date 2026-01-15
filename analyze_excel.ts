import ExcelJS from 'exceljs';
import fs from 'fs';

async function analyzeExcelFile() {
    console.log("=== EXCEL FILE ANALYSIS ===\n");

    const filePath = 'C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx';

    if (!fs.existsSync(filePath)) {
        console.log("❌ File not found");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];

    // Get headers
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        headers.push(cell.text);
    });

    // Count data rows
    let dataRows = 0;
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (row.getCell(1).text) {
            dataRows++;
        }
    }

    console.log("📊 File Summary:");
    console.log(`   Total Rows: ${worksheet.rowCount}`);
    console.log(`   Data Rows: ${dataRows}`);
    console.log(`   Columns: ${headers.length}\n`);

    console.log("📋 Column Headers:");
    headers.forEach((h, i) => {
        console.log(`   ${i + 1}. ${h}`);
    });

    console.log("\n✅ File is ready for upload!");
    console.log("\n📤 MANUAL UPLOAD INSTRUCTIONS:");
    console.log("1. Open http://localhost:3000/ingestion in your browser");
    console.log("2. Drag and drop the file or click to browse:");
    console.log(`   ${filePath}`);
    console.log("3. Wait for AI schema detection");
    console.log("4. Review and confirm the column mappings");
    console.log("5. Watch the processing complete");
    console.log(`\n   Expected: ${dataRows} containers will be processed`);
}

analyzeExcelFile().catch(console.error);
