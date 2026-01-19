
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'testdata');
if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

function createExcel(filename: string, data: any[]) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const filePath = path.join(TEST_DATA_DIR, filename);
    XLSX.writeFile(wb, filePath);
    console.log(`Created ${filename}`);
}

// 1. Service Type in Status (The "Minimal" Case)
// Expected: serviceType = "FCL" (derived), currentStatus = null (canonical)
const dataStatusMisplaced = [
    { "Container #": "CONT_SVC_001", "Status": "FCL", "Weight": 10000, "ETD": "2025-01-01" },
    { "Container #": "CONT_SVC_002", "Status": "LCL Shipment", "Weight": 2000, "ETD": "2025-01-02" }
];

// 2. Service Type in obscure "Load Type" column
// Expected: serviceType = "FCL" (derived from 'Load Type')
const dataLoadType = [
    { "ContainerID": "CONT_LOAD_001", "Current Status": "IN_TRANSIT", "Load Type": "20GP", "Pol": "Shanghai" },
    { "ContainerID": "CONT_LOAD_002", "Current Status": "ARRIVED", "Load Type": "LCL", "Pol": "Ningbo" }
];

// 3. Status Inference (Dates but no status)
// Expected: statusInference = "IN_TRANSIT" (derived from ATD)
const dataStatusInference = [
    { "Cntr": "CONT_INF_001", "Departure": "2025-02-01", "Arrival": "", "Status": "" }, // Has ATD, No ATA
    { "Cntr": "CONT_INF_002", "Departure": "2025-02-01", "Arrival": "2025-02-20", "Status": "" } // Has ATA -> ARRIVED
];

// 4. Destination Cleanup
// Expected: finalDestination = "Chicago" (derived from 'Delv Place')
const dataDestCleanup = [
    { "Unit": "CONT_DEST_001", "Status": "BOOKED", "Delv Place": "chicago, il" },
    { "Unit": "CONT_DEST_002", "Status": "BOOKED", "Delv Place": "LOS ANGELES CA" }
];


createExcel('test_enrich_service_misplaced.xlsx', dataStatusMisplaced);
createExcel('test_enrich_load_type.xlsx', dataLoadType);
createExcel('test_enrich_status_inference.xlsx', dataStatusInference);
createExcel('test_enrich_dest_cleanup.xlsx', dataDestCleanup);
