
import { prisma } from '../lib/prisma';
import { persistMappedData } from '../lib/persistence';
import { updateStatus, getActiveFilename } from './simulation-utils';
import { transformRow } from '../lib/transformation-engine';
import * as fs from 'fs';
import * as path from 'path';

const FILENAME = getActiveFilename();
const ARTIFACT_PATH = path.join(process.cwd(), 'artifacts', 'temp_translation.json');

const ALL_CONTAINER_FIELDS = [
    "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod", "finalDestination",
    "eta", "ata", "etd", "atd", "finalDestinationEta",
    "lastFreeDay", "emptyReturnDate", "gateOutDate",
    "pieces", "grossWeight", "volumeCbm",
    "sealNumber", "containerType",
    "mbl", "hbl", "shipmentReference",
    "consignee", "shipper", "customerPo",
    "businessUnit", "deliveryDate", "loadType", "serviceType"
];

// Helper to derive BU from Consignee
const deriveBusinessUnit = (consignee: any): string | null => {
    if (!consignee || typeof consignee !== 'string') return null;
    const c = consignee.toUpperCase();
    if (c.includes("HORIZON GLOBAL")) return "Horizon Global";
    if (c.includes("HORIZON")) return "Horizon Global";
    if (c.includes("FRAM")) return "FRAM";
    if (c.includes("TRICO")) return "TRICO";
    if (c.includes("AUTOLITE")) return "AUTOLITE";
    if (c.includes("CHAMPION")) return "CHAMPION";
    if (c.includes("FIRST BRANDS")) return "FIRST_BRANDS_GROUP";
    return null;
};

async function main() {
    try {
        console.log(">>> STEP 4: IMPORTER (Persistence) <<<");
        updateStatus({ step: 'IMPORT', progress: 60, message: 'Starting Bulk Import...' });

        if (!fs.existsSync(ARTIFACT_PATH)) throw new Error("No approved detection found. Run Step 2 (Analysis) first.");
        const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf-8'));
        const mapping = artifact.schemaMapping;

        // Fetch ALL Rows
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: FILENAME },
            orderBy: { rowNumber: 'asc' }
        });
        console.log(`Loaded ${rawRows.length} rows from database for ingest.`);

        const MAPPED_CONTAINERS: any[] = [];

        // --- BULK TRANSFORMATION LOOP (Using Shared Engine) ---
        for (const row of rawRows) {
            const rawData = JSON.parse(row.data);
            const headers = row.originalHeaders ? JSON.parse(row.originalHeaders) : [];

            // USE SHARED LOGIC
            const result = transformRow(rawData, headers, mapping);

            if (result.fields.businessUnit?.value) {
                // Already mapped
            } else if (result.fields.consignee?.value) {
                // Try to derive
                const bu = deriveBusinessUnit(result.fields.consignee.value);
                if (bu) {
                    result.fields.businessUnit = {
                        value: bu,
                        originalValue: result.fields.consignee.value,
                        confidence: 1.0,
                        source: 'Derived from Consignee'
                    };
                }
            }

            // AUTO-MAP ServiceType (often missed by generic semantic mapper)
            if (!result.fields.serviceType?.value) {
                // Check if any raw header contains "SERV TYPE" or "AWS"
                const servHeader = headers.find((h: string) => h.toUpperCase().includes('SERV TYPE') || h.toUpperCase().includes('AWS'));
                if (servHeader && rawData[headers.indexOf(servHeader)]) {
                    result.fields.serviceType = {
                        value: rawData[headers.indexOf(servHeader)],
                        originalValue: rawData[headers.indexOf(servHeader)],
                        confidence: 0.9,
                        source: servHeader
                    };
                }
            }

            MAPPED_CONTAINERS.push({
                rawRowId: row.id,
                fields: result.fields, // The structured object
                meta: result.meta,
                overallConfidence: 1.0,
                flagsForReview: []
            });
        }

        console.log(`Transformed ${MAPPED_CONTAINERS.length} records instantly.`);

        // PERSIST
        const fullOutput = {
            ...artifact,
            containers: MAPPED_CONTAINERS,
            events: []
        };

        // Saving to DB
        await persistMappedData(FILENAME, fullOutput, (msg) => {
            updateStatus({
                step: 'IMPORT',
                progress: 60 + Math.floor((parseInt(msg.match(/Processed (\d+)/)?.[1] || "0") / MAPPED_CONTAINERS.length) * 40),
                message: msg
            });
        });

        // Update Log
        try {
            await prisma.importLog.update({
                where: { fileName: FILENAME },
                data: {
                    summary: {
                        translation: {
                            mappedContainers: MAPPED_CONTAINERS.length,
                            eventsFound: 0,
                            confidence: artifact.confidenceReport,
                        }
                    }
                }
            });
        } catch (e) { console.warn("Could not update Import Log summary"); }

        // UI Metrics
        let totalFieldsPopulated = 0;
        let totalUnmappedFields = 0;
        MAPPED_CONTAINERS.forEach(c => {
            totalFieldsPopulated += Object.values(c.fields).filter((f: any) => f.value).length;
            totalUnmappedFields += Object.keys(c.meta).length;
        });
        const avg = (totalFieldsPopulated / MAPPED_CONTAINERS.length).toFixed(1);

        // CLEANUP (DISABLED: Step 5 needs this artifact to learn from Auditor patches)
        // try { fs.unlinkSync(ARTIFACT_PATH); } catch (e) { }

        // Show 5 Sample Rows
        console.log("\n>>> IMPORT SAMPLE (5 Rows) <<<");
        const sample = MAPPED_CONTAINERS.slice(0, 5).map(c => {
            const flat: any = {};
            ALL_CONTAINER_FIELDS.forEach(field => {
                flat[field] = (c.fields[field] as any)?.value || null;
            });
            return flat;
        });

        updateStatus({
            step: 'IMPORT_COMPLETE',
            progress: 100,
            message: `Import Complete. ${MAPPED_CONTAINERS.length} records live.`,
            metrics: {
                translation: { // Reuse existing structure for consistency
                    mapped: MAPPED_CONTAINERS.length,
                    confidence: artifact.confidenceReport.overallScore,
                    unmappedFields: totalUnmappedFields
                }
            },
            agentData: {
                translator: { // STILL POPULATING TRANSLATOR DATA FOR UI TABLE (Legacy requirement)
                    mappedCount: MAPPED_CONTAINERS.length,
                    confidence: artifact.confidenceReport,
                    schemaMapping: mapping,
                    schemaStats: {
                        sourceColumns: Object.keys(mapping.fieldMappings).length + (mapping.unmappedSourceFields?.length || 0),
                        schemaFields: ALL_CONTAINER_FIELDS.length, // Dynamic usage (30)
                        mapped: Object.keys(mapping.fieldMappings).length,
                        unmapped: mapping.unmappedSourceFields?.length || 0
                    },
                    stats: {
                        populated: totalFieldsPopulated,
                        empty: (MAPPED_CONTAINERS.length * Object.keys(mapping.fieldMappings).length) - totalFieldsPopulated,
                        unmapped: totalUnmappedFields,
                        avgFieldsPerContainer: avg
                    },
                    importSample: sample
                }
            }
        });
        console.log("STEP 4 Complete.");
        console.table(sample);
        console.log(`\nVerified ${MAPPED_CONTAINERS.length} records imported.\n`);

    } catch (error) {
        console.error("Step 4 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
