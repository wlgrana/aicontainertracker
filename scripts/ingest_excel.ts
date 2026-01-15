
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

// Load env first
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !process.env[key.trim()]) {
                process.env[key.trim()] = value.trim();
            }
        });
        console.log("Loaded .env manually");
    }
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

function log(msg: any) {
    const str = (typeof msg === 'object') ? JSON.stringify(msg, null, 2) : String(msg);
    console.log(str);
}

async function ingestExcel() {
    log("=== EXCEL INGESTION START ===");

    // Static instantiation
    const prisma = new PrismaClient();

    // Dynamic import for agents (these are fine as dynamic if they don't break env)
    const { detectSchema } = await import('../agents/schema-detector');
    const { normalizeData } = await import('../agents/data-normalizer');
    const { analyzeImport } = await import('../app/actions/analyzeImport');

    const fileName = 'Shipping_Log_With_Dummy_Data.xlsx';
    const filePath = path.resolve(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
        log(`❌ File not found at: ${filePath}`);
        return;
    }

    log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "", cellDates: true } as any);
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];

    log(`Loaded ${rawData.length} rows from ${fileName}`);
    log("Headers: " + JSON.stringify(headers));

    // 2. Save to ImportLog
    const logFileName = `excel_import_${Date.now()}.xlsx`;
    log(`Attempting to create ImportLog with name: ${logFileName}`);

    try {
        await prisma.importLog.create({
            data: {
                fileName: logFileName,
                fileURL: 'local_excel_test',
                status: 'PENDING',
                rowsProcessed: rawData.length,
                importedOn: new Date(),
                rawRows: {
                    create: rawData.map((d: any, i) => ({
                        rowNumber: i + 1,
                        data: JSON.stringify(d)
                    }))
                }
            }
        });
        log(`Created ImportLog: ${logFileName}`);
    } catch (e: any) {
        log("FAILED to create ImportLog: " + e.message);
        throw e;
    }

    // 3. AI Schema Detection
    log("\n--- AI: Detecting Schema ---");
    const sample = rawData.slice(0, 3);
    const mapping = await detectSchema(headers, sample);
    log("Mapping: " + mapping.forwarderName);
    mapping.statusCache = new Map<string, string>();

    // 4. Mission Oracle (Row Processing + Analysis)
    log("\n--- AI: Mission Oracle Ingestion ---");
    try {
        await analyzeImport(logFileName, mapping);
        log("Mission Oracle Ingestion & Analysis Complete.");
    } catch (e) { log("Mission Oracle Failed: " + e); }

    await prisma.$disconnect();
}

ingestExcel().catch(console.error);
