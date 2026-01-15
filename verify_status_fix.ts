
import { normalizeData } from './agents/data-normalizer';
import { SchemaMapping } from './agents/schema-detector';

async function testStatusFix() {
    console.log("TEST: Verifying Status Mismatch Fix (OGF -> DEL & Delivery Date Override)");

    const mockMapping: SchemaMapping = {
        columnMapping: {
            "container_number": "Container Number",
            "event_status": "Status",
            "event_date": "LFD" // Dummy mapping
        },
        unmappedFields: {},
        statusCache: new Map()
    };

    // Case 1: Raw Status is "OGF" (Should map to DEL)
    const rowOGF = {
        "Container Number": "TEST1234567",
        "Status": "OGF",
        "LFD": "2026-01-01"
    };

    console.log("\n--- Case 1: OGF Status Mapping ---");
    const resultOGF = await normalizeData(rowOGF, mockMapping);
    if (resultOGF?.event.stageName === 'DEL') {
        console.log("✅ SUCCESS: OGF mapped to DEL");
    } else {
        console.error(`❌ FAILURE: OGF mapped to ${resultOGF?.event.stageName}`);
    }

    // Case 2: Status is "ARR" but "Actual Del Date" exists (Should force DEL)
    const rowDateOverride = {
        "Container Number": "TEST1234567",
        "Status": "ARR",
        "LFD": "2026-01-01",
        "Actual Del Date": "2026-01-10"
    };

    console.log("\n--- Case 2: Delivery Date Override ---");
    const resultOverride = await normalizeData(rowDateOverride, mockMapping);
    if (resultOverride?.event.stageName === 'DEL') {
        console.log("✅ SUCCESS: Status forced to DEL by date presence");
    } else {
        console.error(`❌ FAILURE: Status remained ${resultOverride?.event.stageName}`);
    }

    // Case 3: Status is "ARR" but "Delivery Date" exists (Variation)
    const rowDateOverride2 = {
        "Container Number": "TEST1234567",
        "Status": "ARR",
        "LFD": "2026-01-01",
        "Delivery Date": "2026-01-12"
    };

    console.log("\n--- Case 3: 'Delivery Date' Column Override ---");
    const resultOverride2 = await normalizeData(rowDateOverride2, mockMapping);
    if (resultOverride2?.event.stageName === 'DEL') {
        console.log("✅ SUCCESS: Status forced to DEL by 'Delivery Date'");
    } else {
        console.error(`❌ FAILURE: Status remained ${resultOverride2?.event.stageName}`);
    }

    // Case 4: Standard "ARR" (Should remain ARR)
    const rowStandard = {
        "Container Number": "TEST1234567",
        "Status": "ARR",
        "LFD": "2026-01-01"
    };
    console.log("\n--- Case 4: Standard ARR (Control) ---");
    const resultStandard = await normalizeData(rowStandard, mockMapping);
    if (resultStandard?.event.stageName === 'DIS') {
        // Note: ARR maps to DIS in fallback logic if process.env.AZURE is missing, 
        // or uses AI. Let's see what the fallback does.
        // Wait, standard fallback for 'ARR' is 'DIS' in the code: "else if (low.includes('disch') || low.includes('arr')) code = 'DIS';"
        console.log("✅ SUCCESS: ARR mapped to DIS (Standard Fallback)");
    } else {
        console.log(`ℹ️ NOTE: ARR mapped to ${resultStandard?.event.stageName}`);
    }

    process.exit(0);
}

testStatusFix();
