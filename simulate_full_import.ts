
import fs from 'fs';
import path from 'path';

// Load env first
try {
    process.loadEnvFile();
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

const logStream = fs.createWriteStream('simulation_result.log', { flags: 'w' });
function log(msg: any) {
    const str = (typeof msg === 'object') ? JSON.stringify(msg, null, 2) : String(msg);
    console.log(str);
    logStream.write(str + '\n');
}

async function simulateImport() {
    log("=== SIMULATING IMPORT FLOW ===");
    log("Checking Env...");
    log("DATABASE_URL: " + (process.env.DATABASE_URL ? "Set" : "Missing"));
    log("AZURE_AI_KEY: " + (process.env.AZURE_AI_KEY ? "Set" : "Missing"));



    // Explicitly set if missing and we know it (Hack fix for verification)
    if (!process.env.DATABASE_URL) {
        process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/shipment-tracker?schema=public";
        log("Forced DATABASE_URL");
    }

    // Dynamic imports to ensure env is loaded
    const { prisma } = await import('./lib/prisma');
    const { detectSchema } = await import('./agents/schema-detector');
    const { normalizeData } = await import('./agents/data-normalizer');
    const { analyzeImport } = await import('./app/actions/analyzeImport');

    // Clear CarrierFormat to force AI Redetection
    await prisma.carrierFormat.deleteMany({});
    log("Cleared CarrierFormats to force AI detection");

    /****************************************
     * 1. READ TEST FILE (Ingestion)
     ****************************************/
    const filePath = 'test_import_oracle.csv';
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(',').map(h => h.trim());
    const rawData = lines.slice(1).map(l => {
        const values = l.split(',');
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = values[i]?.trim());
        return obj;
    });

    log(`Loaded ${rawData.length} rows from ${filePath}`);
    log("Headers: " + JSON.stringify(headers));

    /****************************************
     * 2. SAVE TO IMPORT LOG (Staging)
     ****************************************/
    const fileName = `test_sim_${Date.now()}.csv`;
    const importLog = await prisma.importLog.create({
        data: {
            fileName: fileName,
            fileURL: 'local_test',
            status: 'PENDING',
            rowsProcessed: rawData.length,
            importedOn: new Date(),
            rawRows: {
                create: rawData.map((d, i) => ({
                    rowNumber: i + 1,
                    data: JSON.stringify(d)
                }))
            }
        },
        include: { rawRows: true }
    });

    log(`\nCreated ImportLog: ${fileName} (ID: ${importLog.fileName})`);

    /****************************************
     * 3. AI SCHEMA DETECTION
     ****************************************/
    log("\n--- AI: Detecting Schema ---");
    const sample = rawData.slice(0, 3);
    const mapping = await detectSchema(headers, sample);

    log("AI Schema Result:");
    log(mapping);

    // Fallback if AI fails (for local testing purposes only, should not happen if Deepseek Connected)
    if (!mapping.forwarderName || mapping.forwarderName === "Unknown (Fallback)") {
        log("⚠️ AI Schema detection might have fallen back. Check API connection.");
    }

    // Init Cache
    mapping.statusCache = new Map<string, string>();

    /****************************************
     * 4. AI DATA NORMALIZATION & PERSISTENCE
     ****************************************/
    log("\n--- AI: Normalizing & Persisting Data ---");
    let successCount = 0;

    for (const row of rawData) {
        // process.stdout.write(`Processing Container ${row['Container Number'] || 'Unknown'}... `); 
        // Log to file too

        try {
            const normalized = await normalizeData(row, mapping);

            if (normalized) {
                // 1. UPSERT SHIPMENT (if reference exists)
                if (normalized.shipment.reference) {
                    await prisma.shipment.upsert({
                        where: { shipmentReference: normalized.shipment.reference },
                        update: {
                            businessUnit: normalized.shipment.businessUnit,
                            transportMode: normalized.shipment.transportMode,
                            freightCost: normalized.shipment.freightCost,
                            shipmentVolume: normalized.shipment.volume, // Corrected from totalVolume
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
                            shipmentVolume: normalized.shipment.volume, // Corrected from totalVolume
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
                        gateOutDate: normalized.container.gateOutDate,
                        emptyReturnDate: normalized.container.emptyReturnDate,
                        metadata: normalized.metadata,
                        // Update other fields as needed
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
                        gateOutDate: normalized.container.gateOutDate,
                        emptyReturnDate: normalized.container.emptyReturnDate,
                        metadata: normalized.metadata,
                        importLogId: fileName
                    }
                });

                // 3. LINK CONTAINER TO SHIPMENT
                if (normalized.shipment.reference) {
                    // Check if link exists to avoid duplicates (optional, or just create)
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
                        source: 'Simulation',
                        sourceFileId: fileName
                    }
                });

                successCount++;
                log(`✅ processing container ${normalized.container.containerNumber}: OK (${normalized.event.stageName})`);
            } else {
                log(`❌ processing container ${row['Container Number']}: Skipped (Normalization returned null)`);
            }
        } catch (e: any) {
            log(`❌ processing container ${row['ContainerNumber']}: ${e.message}`);
        }
    }

    log(`Successfully persisted ${successCount} / ${rawData.length} rows.`);

    /****************************************
     * 5. AI IMPORT ANALYSIS (Mission Oracle)
     ****************************************/
    log("\n--- AI: Analyzing Import Batch ---");
    try {
        const analysis = await analyzeImport(fileName);
        log("Analysis Result:");
        log(analysis);

        log("\nSummary:");
        log(`- Data Quality Score: ${analysis.dataQuality.score}`);
        log(`- Critical Alerts: ${analysis.criticalAlerts.length}`);
    } catch (e: any) {
        log("Analysis Failed: " + e.message);
    }
}

simulateImport()
    .catch((e) => log(e))
    .finally(async () => {
        logStream.end();
    });
