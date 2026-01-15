import ExcelJS from 'exceljs';
import fs from 'fs';

async function listHeaders() {
    const filePath = 'C:\\Users\\wlgra\\Downloads\\Shipping_Log_Template.xlsx';
    if (!fs.existsSync(filePath)) {
        console.log("File not found");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const headers: string[] = [];
    const logFile = 'excel_headers.txt';
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    worksheet.getRow(1).eachCell((cell, colNumber) => {
        const line = `${colNumber}: "${cell.text}"\n`;
        fs.appendFileSync(logFile, line);
        headers.push(cell.text);
    });
    console.log("Headers written to excel_headers.txt");
}

listHeaders();
