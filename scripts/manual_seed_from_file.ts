
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

async function ingestExcel() {
    console.log("=== JSON SEEDER STARTED ===");

    // Static instantiation
    const prisma = new PrismaClient();

    // Dynamic import for agents
    console.log("Loading AI Agents...");
    const { detectSchema } = await import('../agents/schema-detector');
    const { normalizeData } = await import('../agents/data-normalizer');
    const { analyzeImport } = await import('../app/actions/analyzeImport');

    const fileName = process.argv[2]; // Get JSON file path from args
    if (!fileName) {
        console.error('Please provide a file path to the JSON seed data.');
        process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found at: ${filePath}`);
        return;
    }

    console.log(`Reading file: ${filePath}`);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(rawContent);

    // Mock headers from the first object keys
    const headers = Object.keys(rawData[0]);

    console.log(`Loaded ${rawData.length} rows.`);
    console.log("Headers: " + JSON.stringify(headers));

    // 2. Save to ImportLog
    const logFileName = `manual_seed_${Date.now()}.json`;
    console.log(`Creating ImportLog: ${logFileName}`);

    try {
        await prisma.importLog.create({
            data: {
                fileName: logFileName,
                fileURL: 'manual_seed',
                status: 'PENDING',
                rowsProcessed: rawData.length,
                importedOn: new Date(),
                rawRows: {
                    create: rawData.map((d: any, i: number) => ({
                        rowNumber: i + 1,
                        data: JSON.stringify(d)
                    }))
                }
            }
        });
    } catch (e: any) {
        console.log("FAILED to create ImportLog: " + e.message);
        throw e;
    }

    // 3. AI Schema Detection
    console.log("\n--- AI: Detecting Schema ---");
    const sample = rawData.slice(0, 3);
    const mapping = await detectSchema(headers, sample);
    console.log("Mapping: " + mapping.forwarderName);
    mapping.statusCache = new Map<string, string>();

    // 4. Normalization & Persistence
    console.log("\n--- AI: Normalizing & Persisting ---");
    let successCount = 0;

    for (const row of rawData as any[]) {
        try {
            const normalized = await normalizeData(row, mapping);
            if (normalized) {
                // 1. Shipment
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
                            pol: normalized.shipment.pol,
                            pod: normalized.shipment.pod,
                            metadata: normalized.metadata as any,
                            importLogId: logFileName
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
                            pol: normalized.shipment.pol,
                            pod: normalized.shipment.pod,
                            metadata: normalized.metadata as any,
                            importLogId: logFileName
                        }
                    });
                }

                // 2. Container (with Exception Logic)
                const hasException = !normalized.container.lastFreeDay; // Simple check for now
                const exceptionType = hasException ? 'Missing Last Free Day' : null;

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
                        mbl: normalized.container.mbl,
                        pol: normalized.container.pol,
                        pod: normalized.container.pod,
                        atd: normalized.container.atd,
                        ata: normalized.container.ata,
                        eta: normalized.container.eta,
                        etd: normalized.container.etd,
                        lastFreeDay: normalized.container.lastFreeDay,
                        grossWeight: normalized.container.grossWeight,
                        metadata: normalized.metadata as any,
                        importLogId: logFileName,
                        hasException: hasException,
                        exceptionType: exceptionType
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
                        mbl: normalized.container.mbl,
                        pol: normalized.container.pol,
                        pod: normalized.container.pod,
                        atd: normalized.container.atd,
                        ata: normalized.container.ata,
                        eta: normalized.container.eta,
                        etd: normalized.container.etd,
                        lastFreeDay: normalized.container.lastFreeDay,
                        grossWeight: normalized.container.grossWeight,
                        metadata: normalized.metadata as any,
                        importLogId: logFileName,
                        hasException: hasException,
                        exceptionType: exceptionType
                    }
                });

                // 3. Link
                if (normalized.shipment.reference) {
                    const exists = await prisma.shipmentContainer.findFirst({
                        where: { shipmentId: normalized.shipment.reference, containerId: normalized.container.containerNumber }
                    });
                    if (!exists) {
                        await prisma.shipmentContainer.create({
                            data: { shipmentId: normalized.shipment.reference, containerId: normalized.container.containerNumber }
                        });
                    }
                }

                // 4. Event
                await prisma.containerEvent.create({
                    data: {
                        containerId: normalized.container.containerNumber,
                        stageName: normalized.event.stageName,
                        eventDateTime: new Date(normalized.event.eventDateTime),
                        location: normalized.event.location,
                        source: 'ManualSeed',
                        sourceFileId: logFileName
                    }
                });

                successCount++;
                if (successCount % 10 === 0) process.stdout.write('.');

            }
        } catch (e: any) {
            console.log(`Row Error: ${e.message}`);
        }
    }

    console.log(`\nPersisted ${successCount}/${rawData.length} rows.`);

    // 5. Oracle
    console.log("--- AI: Analyzing Batch ---");
    try {
        await analyzeImport(logFileName);
        console.log("Oracle Analysis Triggered.");
    } catch (e) { console.log("Oracle Failed: " + e); }

    await prisma.$disconnect();
}

ingestExcel().catch(console.error);
