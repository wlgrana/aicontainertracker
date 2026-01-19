
import * as XLSX from 'xlsx';
import path from 'path';

// Data strictly from the requirements
const data = [
    {
        "Container Number": "ENRICH001",
        "Status": "FCL",
        "Origin Port": "CNSHA",
        "ETD": "2025-01-15",
        "Weight": 12000
    },
    {
        "Container Number": "ENRICH002",
        "Status": "LCL",
        "Origin Port": "USNYC",
        "ETD": "2025-01-20",
        "Weight": 8000
    },
    {
        "Container Number": "ENRICH003",
        "Status": "BOOKED",
        "Origin Port": "CNNGB",
        "ETD": "", // Empty
        "Weight": 15000
    }
];

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

const filePath = path.join(process.cwd(), "test_enrichment_verification.xlsx");
XLSX.writeFile(workbook, filePath);

console.log(`Test file created at ${filePath}`);
