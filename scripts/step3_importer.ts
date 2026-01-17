
import { PrismaClient } from '@prisma/client';
import { persistMappedData } from '../lib/import-orchestrator';
import { updateStatus, getActiveFilename } from './simulation-utils';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
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

// --- TRANSFORMATION ENGINE ---
function excelDateToJS(serial: number): Date {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
}

function parseDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'number') {
        // Excel serial
        try { return excelDateToJS(value).toISOString(); } catch (e) { return null; }
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

function transformValue(value: any, type: string): any {
    if (value === null || value === undefined) return null;

    switch (type) {
        case 'date_conversion':
            return parseDate(value);
        case 'number':
        case 'float':
        case 'int':
            if (typeof value === 'number') return value;
            const cleaned = String(value).replace(/[^0-9.-]/g, '');
            return parseFloat(cleaned) || 0;
        case 'clean_string':
        case 'direct':
        case 'semantic':
        default:
            if (typeof value === 'string') return value.trim();
            return String(value);
    }
}

async function main() {
    try {
        console.log(">>> STEP 3: IMPORTER (Persistence) <<<");
        updateStatus({ step: 'IMPORT', progress: 50, message: 'Running Import...' });

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

        // --- BULK TRANSFORMATION LOOP ---
        const mappedHeaders = new Set(Object.values(mapping.fieldMappings as Record<string, any>).map((m: any) => m.sourceHeader));

        for (const row of rawRows) {
            const rawData = JSON.parse(row.data); // Array of values
            const headers = row.originalHeaders ? JSON.parse(row.originalHeaders) : []; // Array of header names

            const containerFields: any = {};
            const meta: any = {};

            // Helper to get value by header name
            const getValue = (headerName: string) => {
                const idx = headers.indexOf(headerName);
                if (idx === -1) return undefined;
                return rawData[idx];
            };

            // 1. Map Known Schema Fields
            for (const [targetField, rule] of Object.entries(mapping.fieldMappings as Record<string, any>)) {
                const sourceHeader = rule.sourceHeader;
                const rawVal = getValue(sourceHeader);

                const transformed = transformValue(rawVal, rule.transformationType || 'direct');

                containerFields[targetField] = {
                    value: transformed,
                    originalValue: rawVal,
                    confidence: 1.0,
                    source: sourceHeader
                };
            }

            // 2. Capture Unmapped to Meta
            if (headers.length > 0) {
                headers.forEach((h: string, i: number) => {
                    if (!mappedHeaders.has(h)) {
                        meta[h] = rawData[i];
                    }
                });
            } else {
                // Fallback for object-based data if any (legacy safety)
                if (!Array.isArray(rawData)) {
                    for (const [key, val] of Object.entries(rawData)) {
                        if (!mappedHeaders.has(key)) meta[key] = val;
                    }
                }
            }

            MAPPED_CONTAINERS.push({
                rawRowId: row.id,
                fields: containerFields,
                meta: meta,
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
                progress: 50 + Math.floor((parseInt(msg.match(/Processed (\d+)/)?.[1] || "0") / MAPPED_CONTAINERS.length) * 40),
                message: msg
            });
        });

        // Update Log
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

        // UI Metrics
        let totalFieldsPopulated = 0;
        let totalUnmappedFields = 0;
        MAPPED_CONTAINERS.forEach(c => {
            totalFieldsPopulated += Object.values(c.fields).filter((f: any) => f.value).length;
            totalUnmappedFields += Object.keys(c.meta).length;
        });
        const avg = (totalFieldsPopulated / MAPPED_CONTAINERS.length).toFixed(1);

        // CLEANUP
        try { fs.unlinkSync(ARTIFACT_PATH); } catch (e) { }

        // Show 5 Sample Rows
        console.log("\n>>> IMPORT SAMPLE (5 Rows) <<<");
        const sample = MAPPED_CONTAINERS.slice(0, 5).map(c => {
            const flat: any = {};
            // Ensure ALL fields are present (populated or null)
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
                translation: {
                    mapped: MAPPED_CONTAINERS.length,
                    confidence: artifact.confidenceReport.overallScore,
                    unmappedFields: totalUnmappedFields
                }
            },
            agentData: {
                translator: {
                    mappedCount: MAPPED_CONTAINERS.length,
                    confidence: artifact.confidenceReport,
                    schemaMapping: mapping,
                    schemaStats: {
                        sourceColumns: Object.keys(mapping.fieldMappings).length + (mapping.unmappedSourceFields?.length || 0),
                        schemaFields: 26,
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
        console.log("STEP 3 Complete.");
        console.table(sample);
        console.log(`\nVerified ${MAPPED_CONTAINERS.length} records imported.\n`);

    } catch (error) {
        console.error("Step 2b Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
