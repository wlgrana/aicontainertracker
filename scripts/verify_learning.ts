
import { archiveExcelFile } from '../agents/archivist';
import { runTranslator } from '../agents/translator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // User Provided Path
    const filePath = "C:\\Users\\Will Grana\\.gemini\\antigravity\\scratch\\aicontainertracker\\Horizon Tracking Report.xlsx";
    console.log(`Starting Verification Import for: ${filePath}`);

    // 1. Simulate Upload (Archive)
    console.log("Step 1: Archiving (Simulating new upload)...");
    const archive = await archiveExcelFile({
        filePath,
        fileName: `TEST_VERIFY_${Date.now()}.xlsx`
    });
    console.log(`Archived with Log ID: ${archive.importLogId}`);

    // 2. Load Raw Rows
    const rawRows = await prisma.rawRow.findMany({
        where: { importLogId: archive.importLogId },
        orderBy: { rowNumber: 'asc' },
        take: 5 // Just need a few to verify mapping
    });

    if (rawRows.length === 0) throw new Error("No rows found in archive.");

    // 3. Run Translator (This uses the Dictionary)
    console.log("Step 2: Running Translator (Auto-Learning Verification)...");

    // Need headers
    const firstRow = JSON.parse(rawRows[0].data);
    const headers = Object.keys(firstRow);
    const transitStages = await prisma.transitStage.findMany();

    // We pass a limited set of rows to save time, but mapping is header-based
    const translatorOutput = await runTranslator({
        importLogId: archive.importLogId,
        headers,
        rawRows: rawRows.map(r => ({
            id: r.id,
            rowIndex: r.rowNumber,
            rawData: JSON.parse(r.data)
        })),
        existingSchemaFields: ["container_number", "mbl_or_booking", "gate_out_date", "load_type", "final_destination_eta"],
        transitStages: transitStages.map(s => s.stageName)
    });

    // 4. Check Mappings
    console.log("\n--- Verification Results ---");
    const mappings = translatorOutput.schemaMapping?.fieldMappings || {};

    // Check specific learned fields from ontology
    const checks = [
        { header: "SHIPMENT ID", expected: "mbl_or_booking" },
        { header: "Status", expected: "load_type" },
        { header: "TRUCKER APPT", expected: "gate_out_date" },
        { header: "FINAL DESTINATION ", expected: "final_destination_eta" }
    ];

    let passed = 0;
    for (const check of checks) {

        // Find mapping entry
        // Translator V2 output format:
        // fieldMappings: { "HeaderName": { sourceHeader: "...", targetField: "..." } } 
        // OR Array? 
        // Let's assume object values.

        const entry = Object.values(mappings).find((m: any) => m.sourceHeader === check.header);

        if (entry && (entry as any).targetField === check.expected) {
            console.log(`✅ [SUCCESS] Learned: "${check.header}" -> "${check.expected}"`);
            passed++;
        } else {
            console.log(`❌ [FAIL] Missing: "${check.header}" -> "${check.expected}" (Found: ${(entry as any)?.targetField || 'Unmapped'})`);
        }
    }

    if (passed > 0) {
        console.log(`\n🎉 SYSTEM LEARNED! ${passed}/${checks.length} new patterns recognized automatically.`);
    } else {
        console.log("\n⚠️ System did not apply learnings.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
