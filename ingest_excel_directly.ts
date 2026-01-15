
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { prisma } from './lib/prisma';
import { detectSchema } from './agents/schema-detector';
import { normalizeData } from './agents/data-normalizer';
import { analyzeImport } from './app/actions/analyzeImport';

// Load env
try { process.loadEnvFile(); } catch (e) { }

async function ingestExcel() {
    console.log("=== INGESTING EXCEL FILE (USER DATA) ===\n");

    // 1. Read Excel File (Local Copy)
    const fileName = 'container_test_data.xlsx';
    const filePath = path.join(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
        console.error("❌ File not found:", filePath);
        process.exit(1);
    }

    console.log(`📖 Reading Excel: ${filePath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Extract Headers
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => headers.push(cell.text));

    // Extract Rows
    const rawData: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const rowObj: any = {};
        row.eachCell((cell, colNumber) => {
            // ExcelJS uses 1-based indexing for columns
            rowObj[headers[colNumber - 1]] = cell.text;
        });
        // Only add if has data
        if (Object.keys(rowObj).length > 0) {
            rawData.push(rowObj);
        }
    });

    console.log(`✅ Loaded ${rawData.length} rows`);
    if (rawData.length === 0) {
        console.error("❌ No data rows found!");
        process.exit(1);
    }

    // 2. Create Import Log (Upsert based on filename to avoid duplicates/foreign key issues if running multiple times)
    console.log("📝 Creating Import Log...");

    // Delete existing log for this specific file to ensure clean slate (optional, but good for retries)
    try {
        await prisma.importLog.delete({ where: { fileName } });
    } catch (e) { }

    const importLog = await prisma.importLog.create({
        data: {
            fileName: fileName,
            fileURL: 'local_upload_xlsx',
            status: 'PROCESSING',
            rowsProcessed: rawData.length,
            importedOn: new Date(),
            rawRows: {
                create: rawData.map((row, idx) => ({
                    rowNumber: idx + 2, // 1-based + header
                    data: JSON.stringify(row)
                }))
            }
        },
        include: { rawRows: true }
    });

    // 3. Detect Schema
    console.log("🧠 Detecting Schema...");
    const sample = rawData.slice(0, 3);
    const mapping = await detectSchema(headers, sample);
    mapping.statusCache = new Map<string, string>(); // Init cache

    console.log("✅ Schema Detected:", JSON.stringify(mapping.columnMapping, null, 2));

    // 4. Normalize & Persist
    console.log("\n🔄 Normalizing & Persisting...");
    let succeeded = 0;
    let failed = 0;

    for (const row of rawData) {
        try {
            const normalized = await normalizeData(row, mapping);

            if (normalized) {
                // 1. UPSERT SHIPMENT
                if (normalized.shipment.reference) {
                    await prisma.shipment.upsert({
                        where: { shipmentReference: normalized.shipment.reference },
                        update: {
                            businessUnit: normalized.shipment.businessUnit,
                            transportMode: normalized.shipment.transportMode,
                            freightCost: normalized.shipment.freightCost,
                            shipmentVolume: normalized.shipment.volume,
                            bookingDate: normalized.shipment.bookingDate,
                            carrier: normalized.container.carrier,
                            destinationCity: normalized.shipment.destinationCity,
                            shipper: normalized.shipment.shipper,
                            consignee: normalized.shipment.consignee,
                            mbl: normalized.shipment.mbl,
                            totalPieces: normalized.shipment.pieces,
                            totalWeight: normalized.shipment.weight,
                            notes: normalized.shipment.notes,
                            metadata: normalized.metadata,
                            importLogId: fileName
                        },
                        create: {
                            shipmentReference: normalized.shipment.reference,
                            businessUnit: normalized.shipment.businessUnit,
                            transportMode: normalized.shipment.transportMode,
                            freightCost: normalized.shipment.freightCost,
                            shipmentVolume: normalized.shipment.volume,
                            bookingDate: normalized.shipment.bookingDate,
                            carrier: normalized.container.carrier,
                            destinationCity: normalized.shipment.destinationCity,
                            shipper: normalized.shipment.shipper,
                            consignee: normalized.shipment.consignee,
                            mbl: normalized.shipment.mbl,
                            totalPieces: normalized.shipment.pieces,
                            totalWeight: normalized.shipment.weight,
                            notes: normalized.shipment.notes,
                            metadata: normalized.metadata,
                            importLogId: fileName
                        }
                    });
                }

                // 2. UPSERT CONTAINER
                await prisma.container.upsert({
                    where: { containerNumber: normalized.container.containerNumber },
                    update: {
                        containerType: normalized.container.containerType,
                        statusLastUpdated: new Date(normalized.event.eventDateTime),
                        currentStatus: normalized.event.stageName,
                        currentLocation: normalized.event.location,
                        carrier: normalized.container.carrier,
                        gateOutDate: normalized.container.gateOutDate,
                        emptyReturnDate: normalized.container.emptyReturnDate,
                        metadata: normalized.metadata,
                        importLogId: fileName
                    },
                    create: {
                        containerNumber: normalized.container.containerNumber,
                        containerType: normalized.container.containerType,
                        carrier: normalized.container.carrier,
                        currentStatus: normalized.event.stageName,
                        statusLastUpdated: new Date(normalized.event.eventDateTime),
                        currentLocation: normalized.event.location,
                        gateOutDate: normalized.container.gateOutDate,
                        emptyReturnDate: normalized.container.emptyReturnDate,
                        metadata: normalized.metadata,
                        importLogId: fileName
                    }
                });

                // 3. LINK CONTAINER TO SHIPMENT
                if (normalized.shipment.reference) {
                    const existingLink = await prisma.shipmentContainer.findFirst({
                        where: {
                            shipmentId: normalized.shipment.reference,
                            containerId: normalized.container.containerNumber
                        }
                    });

                    if (!existingLink) {
                        await prisma.shipmentContainer.create({
                            data: {
                                shipmentId: normalized.shipment.reference,
                                containerId: normalized.container.containerNumber
                            }
                        });
                    }
                }

                // 4. CREATE EVENT
                await prisma.containerEvent.create({
                    data: {
                        containerId: normalized.container.containerNumber,
                        stageName: normalized.event.stageName,
                        eventDateTime: new Date(normalized.event.eventDateTime),
                        location: normalized.event.location,
                        source: 'ExcelImport',
                        sourceFileId: fileName
                    }
                });

                process.stdout.write('.');
                succeeded++;
            } else {
                process.stdout.write('x');
                failed++;
            }
        } catch (e: any) {
            process.stdout.write('E');
            console.error(`\nError processing row: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n\n✅ Processed: ${succeeded} Succeeded, ${failed} Failed`);

    // 5. Update Log Status
    await prisma.importLog.update({
        where: { fileName: fileName },
        data: {
            status: 'COMPLETED',
            rowsSucceeded: succeeded,
            rowsFailed: failed
        }
    });

    // 6. Analyze
    console.log("\n🤖 Running Mission Oracle Analysis...");
    await analyzeImport(fileName);
    console.log("✅ Analysis Complete");
}

ingestExcel()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
