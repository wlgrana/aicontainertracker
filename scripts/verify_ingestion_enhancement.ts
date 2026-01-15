
import fs from 'fs';
import path from 'path';

// Load env first
try {
    process.loadEnvFile();
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

const logStream = fs.createWriteStream('verification_result.log', { flags: 'w' });
function log(msg: any) {
    let str;
    if (msg instanceof Error) {
        str = `[ERROR] ${msg.message}\n${msg.stack}`;
    } else if (typeof msg === 'object') {
        str = JSON.stringify(msg, null, 2);
    } else {
        str = String(msg);
    }
    console.log(str);
    logStream.write(str + '\n');
}

async function verifyIngestion() {
    log("=== VERIFYING INGESTION ENHANCEMENTS ===");

    // Dynamic imports
    const { prisma } = await import('../lib/prisma');
    const { normalizeData } = await import('../agents/data-normalizer');

    const TEST_CONTAINER_NUM = `TEST${Date.now().toString().slice(-7)}`;
    const TEST_FILE_NAME = `verify_enhancement_${Date.now()}.csv`;

    const rawRow = {
        "Container Number": TEST_CONTAINER_NUM,
        "Shipment Ref": "REF123",
        "Event Date": "2023-10-25 10:00:00",
        "Event Location": "New York",
        "Event Description": "Gate Out",
        "Extra Column 1": "Some valuable data",
        "Legacy Field": "Old Value",
        "Notes": "Handling with care"
    };

    const mapping: any = {
        columnMapping: {
            "container_number": "Container Number",
            "shipment_ref": "Shipment Ref",
            "event_date": "Event Date",
            "location": "Event Location",
            "event_code": "Event Description"
        },
        confidence: 0.9,
        forwarderName: "Test Forwarder",
        statusCache: new Map()
    };

    log(`Testing with Container: ${TEST_CONTAINER_NUM}`);
    log("Raw Row Input:");
    log(rawRow);

    // 1. Create Import Log
    log("\n1. Creating ImportLog...");
    await prisma.importLog.create({
        data: {
            fileName: TEST_FILE_NAME,
            fileURL: 'test_verify',
            status: 'PROCESSING',
            rowsProcessed: 0,
            rawRows: {
                create: {
                    rowNumber: 1,
                    data: JSON.stringify(rawRow)
                }
            }
        }
    });

    // 2. Normalize Data
    log("\n2. Normalizing Data...");
    const normalized = await normalizeData(rawRow, mapping);

    if (!normalized) {
        log("❌ Normalization failed (returned null)");
        return;
    }

    log("Normalization Result Metadata:");
    log(normalized.metadata);

    // 3. Persist Data (Simulating route logic)
    log("\n3. Persisting to Database...");

    // Upsert Container
    const container = await prisma.container.upsert({
        where: { containerNumber: normalized.container.containerNumber },
        update: {
            containerType: normalized.container.containerType,
            statusLastUpdated: new Date(normalized.event.eventDateTime),
            currentStatus: normalized.event.stageName,
            currentLocation: normalized.event.location,
            metadata: normalized.metadata as any,
            importLogId: TEST_FILE_NAME
        },
        create: {
            containerNumber: normalized.container.containerNumber,
            importLogId: TEST_FILE_NAME,
            containerType: normalized.container.containerType,
            currentStatus: normalized.event.stageName,
            statusLastUpdated: new Date(normalized.event.eventDateTime),
            currentLocation: normalized.event.location,
            metadata: normalized.metadata as any
        }
    });

    log(`Persisted Container ID: ${container.containerNumber}`);

    // 4. Verify Metadata Persistence
    log("\n4. Verifying Persistence...");

    const savedContainer = await prisma.container.findUnique({
        where: { containerNumber: TEST_CONTAINER_NUM }
    });

    if (!savedContainer) {
        log("❌ Container not found in DB!");
        return;
    }

    const savedMetadata: any = savedContainer.metadata;

    let checksPassed = true;

    // Check Raw
    if (JSON.stringify(savedMetadata.raw) === JSON.stringify(rawRow)) {
        log("✅ Raw data preserved correctly.");
    } else {
        log("❌ Raw data mismatch.");
        log(`Expected: ${JSON.stringify(rawRow)}`);
        log(`Got: ${JSON.stringify(savedMetadata.raw)}`);
        checksPassed = false;
    }

    // Check Unmapped
    const unmapped = savedMetadata.mapping?.unmappedFields || {};
    if (unmapped["Extra Column 1"] && unmapped["Extra Column 1"].rawValue === "Some valuable data") {
        log("✅ Unmapped field 'Extra Column 1' captured correctly.");
    } else {
        log("❌ Unmapped field 'Extra Column 1' check failed.");
        checksPassed = false;
    }

    if (unmapped["Legacy Field"] && unmapped["Legacy Field"].rawValue === "Old Value") {
        log("✅ Unmapped field 'Legacy Field' captured correctly.");
    } else {
        log("❌ Unmapped field 'Legacy Field' check failed.");
        checksPassed = false;
    }

    // Check Missing
    // In this case, we provided all mapped fields, so missing might be empty, or contain mandatory fields we didn't mock.
    // Let's check if 'missing' exists array.
    if (Array.isArray(savedMetadata.missing)) {
        log(`✅ Missing fields array exists (Count: ${savedMetadata.missing.length})`);
    } else {
        log("❌ Missing fields array not found.");
        checksPassed = false;
    }

    if (checksPassed) {
        log("\n🎉 VERIFICATION SUCCESSFUL!");
    } else {
        log("\n⚠️ VERIFICATION FAILED with errors.");
    }

    // Client cleanup handled by process exit
}

verifyIngestion()
    .catch(e => {
        log("Global Error:");
        log(e);
    });
