
import { runEnricher } from '../agents/enricher';
import { EnricherInput } from '../types/agents';

console.log("Running Enricher Test on CXRU1180200...");

// Mock Data
const mockInput: EnricherInput = {
    mode: 'IMPORT_FAST',
    container: {
        containerNumber: 'CXRU1180200',
        atd: new Date('2024-01-01T10:00:00Z'),
        ata: null,
        currentStatus: null // Empty, should trigger inference
    },
    rawMetadata: {
        "Ship Type": "CY/CY", // Should map to FCL
        "Dep Date": "2024-01-01",
        "Ship to City": "chicago" // Should capitalize
    }
};

const result = runEnricher(mockInput);

console.log("\n--- RESULT ---");
console.log(JSON.stringify(result, null, 2));

console.log("\n--- VERIFICATION ---");

// Check Service Type
const svc = result.aiDerived.fields['serviceType'];
if (svc && svc.value === 'FCL' && svc.method === 'Regex_ServiceType') {
    console.log("✅ Service Type: CORRECT (FCL from CY/CY)");
} else {
    console.error("❌ Service Type: FAILED", svc);
}

// Check Status
const status = result.aiDerived.fields['statusInference'];
if (status && status.value === 'IN_TRANSIT') {
    console.log("✅ Status Inference: CORRECT (IN_TRANSIT from ATD)");
} else {
    console.error("❌ Status Inference: FAILED", status);
}

// Check Destination
const dest = result.aiDerived.fields['finalDestination'];
if (dest && dest.value === 'Chicago') {
    console.log("✅ Destination Clean: CORRECT (Chicago)");
} else {
    console.error("❌ Destination Clean: FAILED", dest);
}

// Check Structure
if (result.aiDerived.mode === 'IMPORT_FAST' && result.aiDerived.lastRun) {
    console.log("✅ Structure: CORRECT");
} else {
    console.error("❌ Structure: FAILED");
}
