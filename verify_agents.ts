
// Load env first
try {
    process.loadEnvFile();
    console.log("Loaded .env file");
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

async function verifyAgents() {
    const { detectSchema } = await import('./agents/schema-detector');
    const { normalizeData } = await import('./agents/data-normalizer');

    console.log("=== VERIFYING AI AGENTS ===");

    if (!process.env.AZURE_AI_KEY) {
        console.warn("⚠️ AZURE_AI_KEY is missing. Agents will use fallback logic.");
    } else {
        console.log("✅ AZURE_AI_KEY is found.");
    }

    // 1. Verify Schema Detector (High Think)
    console.log("\n--- Testing Schema Detector ---");
    const headers = ["Cont Num", "Sts", "Loc", "Event Dt", "Vsl Name"];
    const sampleRows = [
        { "Cont Num": "TRHU1234567", "Sts": "Discharged", "Loc": "USLAX", "Event Dt": "2023-10-01", "Vsl Name": "EVER GIVEN" }
    ];

    console.log("Input Headers:", headers);
    const schemaResult = await detectSchema(headers, sampleRows);
    console.log("Result:", JSON.stringify(schemaResult, null, 2));

    if (schemaResult.columnMapping['container_number'] === 'Cont Num') {
        console.log("✅ Schema Detection passed.");
    } else {
        console.error("❌ Schema Detection failed or used unexpected mapping.");
    }

    // 2. Verify Data Normalizer (Low Think)
    console.log("\n--- Testing Data Normalizer ---");
    const mapping = schemaResult;
    const row = sampleRows[0];

    // Test normalization of "Discharged" -> "DIS"
    const normResult = await normalizeData(row, mapping);
    console.log("Normalization Result:", JSON.stringify(normResult, null, 2));

    if (normResult?.event.stageName === 'DIS') {
        console.log("✅ Data Normalizer passed (Status 'Discharged' mapped to 'DIS').");
    } else {
        console.error(`❌ Data Normalizer failed. Expected 'DIS', got '${normResult?.event.stageName}'`);
    }

    // Test a trickier one
    console.log("\n--- Testing Data Normalizer (Tricky Case) ---");
    const trickyRow = { "Cont Num": "TRHU1234567", "Sts": "Gated out from terminal", "Loc": "USLAX", "Event Dt": "2023-10-02" };
    const trickyResult = await normalizeData(trickyRow, mapping);
    console.log("Tricky Result Status:", trickyResult?.event.stageName);

    if (trickyResult?.event.stageName === 'CGO') {
        console.log("✅ Data Normalizer passed (Status 'Gated out...' mapped to 'CGO').");
    } else {
        console.warn(`⚠️ Data Normalizer might have fallen back or failed. Expected 'CGO', got '${trickyResult?.event.stageName}'`);
    }
}

verifyAgents();
