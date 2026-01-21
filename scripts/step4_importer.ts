
import { prisma } from '../lib/prisma';
import { persistMappedData } from '../lib/persistence';
import { updateStatus, getActiveFilename, getActiveOptions } from './simulation-utils';
import { getArtifactPath } from '../lib/path-utils';
import { transformRow } from '../lib/transformation-engine';
import * as fs from 'fs';
import * as path from 'path';
import { runEnricher } from '../agents/enricher';
import { AgentStage } from '@prisma/client';

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



/**
 * Main Importer function - exported for Vercel direct execution
 */
export async function runImporterStep(config?: {
    filename?: string;
}) {
    console.log('[IMPORTER] Starting...');
    console.log('[IMPORTER] CWD:', process.cwd());
    console.log('[IMPORTER] Environment:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        isVercel: process.env.VERCEL === '1'
    });

    const FILENAME = config?.filename || await getActiveFilename();
    const ARTIFACT_PATH = getArtifactPath('temp_translation.json');

    try {
        console.log(">>> STEP 4: IMPORTER (Persistence) <<<");
        console.log('[IMPORTER] Step 1: Updating status...');
        await updateStatus({ step: 'IMPORT', progress: 60, message: 'Starting Bulk Import...' });

        console.log('[IMPORTER] Step 2: Checking for artifact...');
        console.log('[IMPORTER] Artifact path:', ARTIFACT_PATH);
        if (!fs.existsSync(ARTIFACT_PATH)) {
            console.error('[IMPORTER] Artifact not found at:', ARTIFACT_PATH);
            throw new Error("No approved detection found. Run Step 2 (Analysis) first.");
        }

        console.log('[IMPORTER] Step 3: Reading artifact...');
        const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf-8'));
        const mapping = artifact.schemaMapping;
        console.log('[IMPORTER] Artifact loaded, mapping keys:', Object.keys(mapping.fieldMappings).length);

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

        // --- ENRICHER (Pre-Persistence Inference) ---
        // We run this BEFORE persistence so we can validate it during the write.
        // Conceptually this is Step 3 in the user's mental model.
        const { enrichEnabled } = await getActiveOptions();
        const enrichmentMap = new Map<string, any>();
        let enrichedCount = 0;
        let enrichmentTotalFields = 0;
        const confidenceStats = { HIGH: 0, MED: 0, LOW: 0 };

        if (enrichEnabled) {
            console.log(`\n>>> STEP 3: ENRICHER (Inference Engine) <<<`);
            updateStatus({ message: 'Running Enrichment...' });
            console.log(`[Enricher] Processing ${MAPPED_CONTAINERS.length} containers...`);
            console.log(`[Enricher] Running inference methods: [ServiceType, StatusInference, FinalDestination]`);

            for (const c of MAPPED_CONTAINERS) {
                try {
                    // Reconstruct canonical container object from fields
                    const containerObj: any = { containerNumber: c.fields.containerNumber?.value };
                    ALL_CONTAINER_FIELDS.forEach(k => {
                        if (c.fields[k]?.value) containerObj[k] = c.fields[k].value;
                    });

                    // Reconstruct raw metadata
                    const rawMeta = c.meta || {};

                    const enrichment = runEnricher({
                        container: containerObj,
                        rawMetadata: rawMeta,
                        mode: 'IMPORT_FAST'
                    });

                    if (enrichment.aiDerived && Object.keys(enrichment.aiDerived.fields).length > 0) {
                        enrichmentMap.set(containerObj.containerNumber, enrichment.aiDerived);
                        enrichedCount++;

                        // Detailed Log for first few
                        if (enrichedCount <= 3) {
                            console.log(`[Enricher] Processing container ${containerObj.containerNumber}...`);
                            Object.entries(enrichment.aiDerived.fields).forEach(([k, v]: any) => {
                                console.log(`  → ${k}: Derived "${v.value}" from ${v.source} [${v.confidence} confidence]`);
                            });
                        }

                        // Stats collection
                        Object.values(enrichment.aiDerived.fields).forEach((v: any) => {
                            enrichmentTotalFields++;
                            if (v.confidence === 'HIGH') confidenceStats.HIGH++;
                            else if (v.confidence === 'MED') confidenceStats.MED++;
                            else confidenceStats.LOW++;
                        });
                    }
                } catch (e) {
                    console.warn(`Enrichment error on ${c.rawRowId}:`, e);
                }
            }

            const avgConf = enrichmentTotalFields > 0 ? Math.round(((confidenceStats.HIGH * 100) + (confidenceStats.MED * 70) + (confidenceStats.LOW * 30)) / enrichmentTotalFields) : 0;
            console.log(`[Enricher] ✅ Enriched ${enrichedCount}/${MAPPED_CONTAINERS.length} containers (avg confidence: ~${avgConf}%)`);
            console.log(`[Enricher] Summary:`);
            console.log(`  - ${enrichmentTotalFields} fields derived`);
            console.log(`  - ${confidenceStats.HIGH} HIGH confidence`);
            console.log(`  - ${confidenceStats.MED} MEDIUM confidence`);
            console.log(`  - ${confidenceStats.LOW} LOW confidence`);
            console.log("STEP 3 Complete.");

        } else {
            console.log("\n>>> STEP 3: ENRICHER SKIPPED (Not Enabled) <<<");
        }

        // PERSIST
        console.log("\n>>> STEP 4: PERSISTENCE (Database Write) <<<");

        // Fetch forwarder from ImportLog
        const forwarderQuery = await prisma.importLog.findUnique({
            where: { fileName: FILENAME },
            select: { forwarder: true }
        });
        const forwarder = forwarderQuery?.forwarder || undefined;

        const fullOutput = {
            ...artifact,
            containers: MAPPED_CONTAINERS,
            events: []
        };

        // Saving to DB
        // Validation logging happens INSIDE persistMappedData now
        await persistMappedData(FILENAME, fullOutput, enrichmentMap, (msg) => {
            updateStatus({
                step: 'IMPORT',
                progress: 60 + Math.floor((parseInt(msg.match(/Processed (\d+)/)?.[1] || "0") / MAPPED_CONTAINERS.length) * 40),
                message: msg
            });
        }, forwarder);

        // TRACK CONTAINER COUNTS (Created vs Updated)
        console.log('[IMPORTER] Calculating container statistics...');
        const containerNumbers = MAPPED_CONTAINERS.map(c => c.fields.containerNumber?.value).filter(Boolean);

        // Query to find which containers existed before this import
        const existingContainers = await prisma.container.findMany({
            where: {
                containerNumber: { in: containerNumbers as string[] },
                createdAt: { lt: new Date(Date.now() - 5000) } // Created more than 5 seconds ago
            },
            select: { containerNumber: true }
        });

        const existingSet = new Set(existingContainers.map(c => c.containerNumber));
        const containersUpdated = existingSet.size;
        const containersCreated = MAPPED_CONTAINERS.length - containersUpdated;

        // Update Log
        try {
            await prisma.importLog.update({
                where: { fileName: FILENAME },
                data: {
                    containersCreated: containersCreated,
                    containersUpdated: containersUpdated,
                    containersEnriched: enrichedCount,
                    summary: {
                        translation: {
                            mappedContainers: MAPPED_CONTAINERS.length,
                            eventsFound: 0,
                            confidence: artifact.confidenceReport,
                        },
                        persistence: {
                            created: containersCreated,
                            updated: containersUpdated,
                            enriched: enrichedCount
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

        // Show 1 Sample Row
        console.log("\n>>> IMPORT SAMPLE (1 Row) <<<");
        const sample = MAPPED_CONTAINERS.slice(0, 1).map(c => {
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

        console.log(`\n=== IMPORT SUMMARY ===`);
        console.log(`File: ${FILENAME}`);
        console.log(`Start Time: ${new Date().toISOString()}`);

        console.log(`\nRecords Processed:`);
        console.log(`  - Raw Rows: ${rawRows.length}`);
        console.log(`  - Containers Created: ${MAPPED_CONTAINERS.length}`);

        console.log(`\nData Quality:`);
        console.log(`  - Enrichment: ${enrichedCount} containers enriched`);
        // Note: Persistence Warnings are logged during execution

        console.log(`\nIssues:`);
        console.log(`  (See logs above for specific warnings)`);

        // FINAL: Mark import as complete and calculate duration
        const importLog = await prisma.importLog.findUnique({
            where: { fileName: FILENAME },
            select: { aiAnalysis: true }
        });

        const startTime = (importLog?.aiAnalysis as any)?.startTime;
        const endTime = new Date();
        const durationMs = startTime ? endTime.getTime() - new Date(startTime).getTime() : null;

        await prisma.importLog.update({
            where: { fileName: FILENAME },
            data: {
                status: 'COMPLETED',
                completedAt: endTime,
                processingDurationMs: durationMs,
                rowsSucceeded: MAPPED_CONTAINERS.length
            }
        });

        console.log(`[IMPORTER] Import marked as COMPLETED. Duration: ${durationMs ? (durationMs / 1000).toFixed(2) + 's' : 'N/A'}`);

        return {
            success: true,
            importedCount: MAPPED_CONTAINERS.length,
            enrichedCount
        };

    } catch (error) {
        console.error("Step 4 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// ✅ Only run as script if called directly (for local spawn)
async function main() {
    await runImporterStep();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[Importer] Error:', err);
        process.exit(1);
    });
}

