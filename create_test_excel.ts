
import ExcelJS from 'exceljs';
import path from 'path';

async function createExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Shipments');

    worksheet.columns = [
        { header: 'ContainerNo', key: 'container' },
        { header: 'Size', key: 'size' },
        { header: 'Carrier', key: 'carrier' },
        { header: 'Status', key: 'status' },
        { header: 'Date', key: 'date' },
        { header: 'Loc', key: 'loc' }
    ];

    worksheet.addRow({ container: 'MSCU7788990', size: '40HC', carrier: 'MSC', status: 'Discharged', date: '2026-01-10', loc: 'Los Angeles' });
    worksheet.addRow({ container: 'MAEU1122334', size: '20GP', carrier: 'Maersk', status: 'Gate Out', date: '2026-01-11', loc: 'Long Beach' });

    const filePath = path.join(process.cwd(), 'test_import.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Created ${filePath}`);
}

createExcel().catch(console.error);
