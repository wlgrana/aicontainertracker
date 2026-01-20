
import { PrismaClient } from '@prisma/client';
import { runTranslator } from '../agents/translator';
import { updateStatus, getActiveFilename } from './simulation-utils';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Main Translator function - exported for Vercel direct execution
 */
export async function runTranslatorStep() {
    const FILENAME = getActiveFilename();
    const ARTIFACT_PATH = path.join(process.cwd(), 'artifacts', 'temp_translation.json');

    try {
        console.log(">>> STEP 2: TRANSLATOR (Schema Discovery) <<<");
        updateStatus({ step: 'TRANSLATOR', progress: 40, message: 'Identifying Schema Pattern with AI...' });

        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: FILENAME },
            orderBy: { rowNumber: 'asc' }
        });

        if (rawRows.length === 0) throw new Error("No raw rows found. Run Step 1 first.");
        const headers = JSON.parse(rawRows[0].originalHeaders || '[]');

        const containerFields = [
            "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod", "finalDestination",
            "eta", "ata", "etd", "atd", "finalDestinationEta",
            "lastFreeDay", "emptyReturnDate", "gateOutDate",
            "pieces", "grossWeight", "volumeCbm",
            "sealNumber", "containerType",
            "mbl", "hbl", "shipmentReference",
            "consignee", "shipper", "customerPo"
        ];

        const transitStages = await prisma.transitStage.findMany();

        const sampleSize = 5;
        const limitedRows = rawRows.slice(0, sampleSize);
        console.log(`Sending sample of ${limitedRows.length} rows to AI for Schema Discovery...`);

        // 1. RUN TRANSLATOR (AI)
        const translatorOutput = await runTranslator({
            importLogId: FILENAME,
            headers: headers,
            rawRows: limitedRows.map(r => ({
                id: r.id,
                rowIndex: r.rowNumber,
                rawData: JSON.parse(r.data)
            })),
            existingSchemaFields: containerFields,
            transitStages: transitStages.map(s => ({ code: s.stageCode, name: s.stageName, definition: null }))
        });

        // NORMALIZE MAPPING KEYS to camelCase (DB Schema format)
        const normalizedMappings: any = {};
        for (const [target, rule] of Object.entries(translatorOutput.schemaMapping.fieldMappings) as [string, any][]) {
            let camelTarget = target.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

            // SPECIAL FIX: Ontology has 'mbl_or_booking' -> 'mblOrBooking', but DB has 'mbl'
            if (camelTarget === 'mblOrBooking') camelTarget = 'mbl';

            normalizedMappings[camelTarget] = {
                ...rule,
                targetField: camelTarget
            };
        }
        translatorOutput.schemaMapping.fieldMappings = normalizedMappings;

        // 2. STRICT RECALCULATION FOR UI CONSISTENCY
        const allHeaders = headers;
        const mappedSourceHeaders = new Set<string>();
        const mappedTargetFields = new Set<string>();

        for (const [target, rule] of Object.entries(translatorOutput.schemaMapping.fieldMappings) as [string, any][]) {
            mappedSourceHeaders.add(rule.sourceHeader);
            mappedTargetFields.add(target);
        }

        // A. True Unmapped List (Left Over)
        const trueUnmappedHeaders = allHeaders.filter((h: string) => !mappedSourceHeaders.has(h));

        // B. True Missing DB Fields (Empty)
        const trueMissingDBFields = containerFields.filter(f => !mappedTargetFields.has(f));

        // Overwrite standard output to ensure consistency
        translatorOutput.schemaMapping.unmappedSourceFields = trueUnmappedHeaders.map((h: string) => ({
            sourceHeader: h,
            sampleValue: null,
            suggestedField: null,
            confidence: 0,
            potentialMeaning: "Unknown"
        }));

        // 3. SAVE ARTIFACT FOR REVIEW & INGESTION
        if (!fs.existsSync(path.dirname(ARTIFACT_PATH))) fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });

        const artifact = {
            ...translatorOutput,
            _meta: {
                isSample: true,
                sampleSize: sampleSize,
                totalAvailableRows: rawRows.length
            }
        };

        fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
        console.log(`Schema Definition saved to ${ARTIFACT_PATH}`);

        // 4. UPDATE UI STATUS
        updateStatus({
            step: 'TRANSLATOR_REVIEW',
            progress: 45,
            message: 'Schema Detected. Review Mapping Rules.',
            metrics: {
                source: { totalRows: rawRows.length },
                translation: {
                    mapped: 0,
                    confidence: translatorOutput.confidenceReport.overallScore,
                    unmappedFields: trueUnmappedHeaders.length
                }
            },
            agentData: {
                translator: {
                    mappedCount: 0,
                    confidence: translatorOutput.confidenceReport,
                    sampleContainer: translatorOutput.containers[0] || null,
                    schemaMapping: {
                        ...translatorOutput.schemaMapping,
                        missingSchemaFields: trueMissingDBFields
                    },
                    schemaStats: {
                        sourceColumns: allHeaders.length,
                        schemaFields: containerFields.length,
                        mapped: mappedTargetFields.size,
                        unmapped: trueUnmappedHeaders.length,
                        missing: trueMissingDBFields.length
                    }
                }
            }
        });
        console.log("STEP 2 Complete. Waiting for user approval to run Bulk Ingestion.");

        return {
            success: true,
            mappedFields: mappedTargetFields.size,
            unmappedFields: trueUnmappedHeaders.length
        };

    } catch (error) {
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        console.error("Step 2 Failed:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// ✅ Only run as script if called directly (for local spawn)
async function main() {
    await runTranslatorStep();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[Translator] Error:', err);
        process.exit(1);
    });
}
