import ExcelJS from 'exceljs';
import fs from 'fs';

async function showContainerNumbers() {
    const filePath = 'C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx';
    if (!fs.existsSync(filePath)) {
        console.log("File not found");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Find header row
    const headers: string[] = [];
    worksheet.getRow(1).eachCell(cell => headers.push(cell.text));
    const containerColIdx = headers.findIndex(h => h.includes('Container #') || h.includes('Container Number')) + 1;

    if (containerColIdx === 0) {
        console.log("Could not find Container Number column");
        return;
    }

    console.log("First 5 Container Numbers in Excel:");
    let count = 0;
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const val = worksheet.getRow(i).getCell(containerColIdx).text;
        if (val) {
            console.log(val);
            count++;
            if (count >= 5) break;
        }
    }
}

showContainerNumbers();
