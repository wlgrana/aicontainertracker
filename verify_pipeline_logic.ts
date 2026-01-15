import { PrismaClient } from './lib/generated/client';
import { detectSchema } from './agents/schema-detector';
import { normalizeData } from './agents/data-normalizer';
import { runExceptionClassifier } from './agents/exception-classifier';

// Use custom client
const prisma = new PrismaClient();

async function main() {
    console.log("=== STARTING STANDALONE PIPELINE TEST ===");

    // 1. Mock Input (Simulate Excel Parse)
    const headers = ["ContainerNo", "Status", "Loc", "Date", "Size"];
    const sample = [
        { "ContainerNo": "TEST_PIPE_01", "Status": "Discharged", "Loc": "Rotterdam", "Date": new Date().toISOString(), "Size": "40HC" }
    ];

    // 2. Run Schema Detector
    console.log("1. Running Schema Detector...");
    const mapping = await detectSchema(headers, sample);
    console.log("   Detected:", JSON.stringify(mapping.columnMapping));

    // 3. Run Normalizer & Save
    console.log("2. Running Normalizer & Ingestion...");
    const rawData = sample[0];
    const normalized = await normalizeData(rawData, mapping);

    if (normalized) {
        // Upsert Container
        await prisma.container.upsert({
            where: { containerNumber: normalized.container.containerNumber },
            update: {
                currentStatus: normalized.event.stageName,
                statusLastUpdated: new Date(normalized.event.eventDateTime)
            },
            create: {
                containerNumber: normalized.container.containerNumber,
                containerType: normalized.container.containerType, // 'Size' -> 'containerType'
                carrier: 'Maersk', // Hardcoded mock in Normalizer logic
                currentStatus: normalized.event.stageName,
                statusLastUpdated: new Date(normalized.event.eventDateTime)
            }
        });
        console.log("   Container Saved:", normalized.container.containerNumber);

        // 4. Run Exception Classifier
        console.log("3. Running Exception Classifier...");
        await runExceptionClassifier(normalized.container.containerNumber);

        // 5. Verify DB
        const result = await prisma.container.findUnique({
            where: { containerNumber: "TEST_PIPE_01" }
        });
        console.log("\n=== RESULT ===");
        console.log(JSON.stringify(result, null, 2));

        if (result && result.currentStatus === 'DIS') {
            console.log("\nSUCCESS: Pipeline logic verified.");
        } else {
            console.error("\nFAILURE: Status not updated correctly.");
        }
    } else {
        console.error("Normalization returned null");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
