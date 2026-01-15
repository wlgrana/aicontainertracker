import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

async function uploadExcelFile() {
    console.log("=== UPLOADING EXCEL FILE ===\n");

    const filePath = 'C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx';

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.log("❌ File not found:", filePath);
        return;
    }

    console.log("✅ File found:", filePath);
    const stats = fs.statSync(filePath);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

    // Read the Excel file
    console.log("📖 Reading Excel file...");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    console.log(`   Sheet name: ${worksheet.name}`);
    console.log(`   Rows: ${worksheet.rowCount}`);
    console.log(`   Columns: ${worksheet.columnCount}\n`);

    // Get headers
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        headers.push(cell.text);
    });

    console.log("📋 Headers found:");
    headers.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
    console.log("");

    // Get sample data
    console.log("📊 Sample data (first 3 rows):");
    for (let i = 2; i <= Math.min(4, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
            rowData[headers[colNumber - 1]] = cell.text;
        });
        console.log(`   Row ${i - 1}:`, JSON.stringify(rowData, null, 2));
    }

    // Copy file to project directory for upload
    const destPath = path.join(process.cwd(), 'Shipping_Log_Template.xlsx');
    fs.copyFileSync(filePath, destPath);
    console.log(`\n✅ File copied to: ${destPath}`);
    console.log("\n📤 Ready for upload via web interface");
    console.log("   Visit: http://localhost:3000/ingestion");
    console.log("   Upload: Shipping_Log_Template.xlsx");
}

uploadExcelFile().catch(console.error);
