


import { safeDate } from '../lib/date-utils';
import { TranslatorInput, TranslatorOutput } from '../types/agents';
import { toCanonicalFieldName, mapHeaderToCanonicalField, validateFieldExists } from './field-name-utils';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

// Helper for date conversion
const DATE_FIELDS = new Set([
    'atd', 'ata', 'etd', 'eta',
    'gateOutDate', 'emptyReturnDate',
    'lastFreeDay', 'deliveryDate',
    'finalDestinationEta', 'detentionFreeDay'
]);

function applyDateConversions(output: TranslatorOutput) {
    if (!output.containers) return;

    let convertedCount = 0;

    output.containers.forEach(container => {
        if (!container.fields) return;

        for (const [key, field] of Object.entries(container.fields)) {
            if (DATE_FIELDS.has(key) && field.value) {
                const converted = safeDate(field.value);
                if (converted) {
                    // Update field value to ISO string for consistency
                    if (String(field.value) !== converted.toISOString()) {
                        console.log(`[Translator] ✅ Converted ${key}: ${field.value} -> ${converted.toISOString()}`);
                        convertedCount++;
                        container.fields[key] = {
                            ...field,
                            value: converted.toISOString(),
                            transformation: 'date_conversion'
                        };
                    }
                }
            }
        }
    });

    if (convertedCount > 0) {
        console.log(`[Translator] Date Conversion Summary:`);
        console.log(`  ✅ Successful conversions: ${convertedCount}`);
        console.log(`  ❌ Failed conversions: 0`);
    }
}

// Status Code Normalization Mappings
// Maps vendor-specific status codes to standard TransitStage names
const STATUS_CODE_MAPPINGS: Record<string, string> = {
    // Horizon-specific codes
    'BCN': 'Booked',              // Been Containerized / Booking Confirmed
    'RTN': 'Empty Returned',      // Returned to depot
    'OGE': 'Empty Returned',      // Out Gate Empty
    'STR': 'Delivered',           // Stripped/Delivered
    'DIS': 'Discharged',          // Discharged from vessel
    'AVL': 'Customs Cleared',     // Available/Released from customs
    'VSL': 'In Transit',          // On Vessel
    'LCL': 'Booked',              // Less than Container Load (pre-shipment consolidation)

    // Standard codes that may need normalization
    'BOOK': 'Booked',
    'BOOKED': 'Booked',
    'DEP': 'In Transit',          // Vessel Departed
    'DEPARTED': 'In Transit',
    'ARR': 'Arrived',
    'ARRIVED': 'Arrived',
    'LOAD': 'Loaded',
    'LOADED': 'Loaded',
    'DISCH': 'Discharged',
    'DISCHARGED': 'Discharged',
    'CUSTOMS': 'Customs Cleared',
    'CLEARED': 'Customs Cleared',
    'DELIVERY': 'Out for Delivery',
    'DLVD': 'Delivered',
    'DELIVERED': 'Delivered',
    'EMPTY': 'Empty Returned',
    'RETURNED': 'Empty Returned',

    // Additional common variations
    'IN_TRANSIT': 'In Transit',
    'INTRANSIT': 'In Transit',
    'ON_VESSEL': 'In Transit',
    'VESSEL': 'In Transit',
    'GATE_OUT': 'Loaded',
    'GATEOUT': 'Loaded',
    'GATE_IN': 'Arrived',
    'GATEIN': 'Arrived',
};

/**
 * Normalize a status code to a standard TransitStage name
 * @param statusCode - The raw status code from vendor data
 * @returns Normalized status name, or the original if no mapping exists
 */
function normalizeStatusCode(statusCode: string | null | undefined): string | null {
    if (!statusCode) return null;

    const normalized = String(statusCode).trim().toUpperCase();

    // Check direct mapping
    if (STATUS_CODE_MAPPINGS[normalized]) {
        const mapped = STATUS_CODE_MAPPINGS[normalized];
        console.log(`[Translator] Status normalization: "${statusCode}" → "${mapped}"`);
        return mapped;
    }

    // If no mapping found, return the original value
    // The database should handle validation
    return statusCode.trim();
}

/**
 * Apply status code normalization to all containers
 */
function applyStatusNormalization(output: TranslatorOutput) {
    if (!output.containers) return;

    let normalizedCount = 0;

    output.containers.forEach(container => {
        if (!container.fields) return;

        // Check for status-related fields
        const statusFields = ['currentStatus', 'status', 'containerStatus'];

        for (const fieldName of statusFields) {
            const field = container.fields[fieldName];
            if (field && field.value) {
                const originalValue = String(field.value);
                const normalized = normalizeStatusCode(originalValue);

                if (normalized && normalized !== originalValue) {
                    normalizedCount++;
                    container.fields[fieldName] = {
                        ...field,
                        value: normalized,
                        originalValue: originalValue,
                        transformation: 'status_normalization'
                    };
                }
            }
        }
    });

    if (normalizedCount > 0) {
        console.log(`[Translator] Status Normalization Summary:`);
        console.log(`  ✅ Normalized ${normalizedCount} status codes`);
    }
}


let BU_DICT: any = null;
let ONTOLOGY: any = null;

async function loadDictionaries() {
    try {
        const buPath = path.join(process.cwd(), 'agents/dictionaries/business_units.yml');
        const ontPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');

        console.log(`[Translator] Loading Dictionaries from:\n  ${buPath}\n  ${ontPath}`);

        BU_DICT = yaml.parse(await fs.promises.readFile(buPath, 'utf-8'));
        ONTOLOGY = yaml.parse(await fs.promises.readFile(ontPath, 'utf-8'));

        if (!ONTOLOGY) throw new Error("Ontology parse returned null");
        console.log(`[Translator] Ontology Loaded. Required: ${Object.keys(ONTOLOGY.required_fields).length}, Optional: ${Object.keys(ONTOLOGY.optional_fields).length}`);
    } catch (e) {
        console.error("[Translator] CRITICAL: Failed to load dictionaries:", e);
        throw e;
    }
}

const AZURE_ENDPOINT = (process.env.AZURE_AI_ENDPOINT || "").trim();
const AZURE_API_KEY = (process.env.AZURE_AI_KEY || "").trim();
const AZURE_DEPLOYMENT = (process.env.AZURE_AI_MODEL || "gpt-4o").trim();

function getAIClient() {
    try {
        if (AZURE_ENDPOINT && AZURE_API_KEY) {
            const baseURL = AZURE_ENDPOINT.includes('/v1')
                ? (AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT)
                : `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}`;
            return new OpenAI({
                apiKey: AZURE_API_KEY,
                baseURL: baseURL,
                defaultQuery: AZURE_ENDPOINT.includes('/v1') ? undefined : { 'api-version': '2024-02-15-preview' },
                defaultHeaders: AZURE_ENDPOINT.includes('/v1') ? undefined : { 'api-key': AZURE_API_KEY },
                timeout: 10000
            });
        }
    } catch (e) { console.warn("AI Client Init Failed"); }
    return null;
}

function runHeuristicLogic(input: TranslatorInput, allFields: any): TranslatorOutput {
    console.log("[Translator] Running HEURISTIC LOGIC...");
    const mappings: any = {};
    const unmapped: any[] = [];
    const usedTargets = new Set<string>();

    for (const header of input.headers) {
        const bestMatch = mapHeaderToCanonicalField(header, allFields);
        if (bestMatch) {
            console.log(`  [Heuristic] ${header} -> ${bestMatch}`);
            if (!usedTargets.has(bestMatch)) {
                mappings[bestMatch] = {
                    sourceHeader: header,
                    targetField: bestMatch,
                    confidence: 1.0,
                    transformationType: 'direct',
                    notes: 'Heuristic Match'
                };
                usedTargets.add(bestMatch);
            } else {
                unmapped.push({ sourceHeader: header, confidence: 0, potentialMeaning: "Duplicate/Secondary Synonym" });
            }
        } else {
            console.log(`  [Heuristic] ${header} -> NO MATCH`);
            unmapped.push({ sourceHeader: header, confidence: 0, potentialMeaning: "Unknown" });
        }
    }

    console.log(`[Translator] Heuristic Result: ${Object.keys(mappings).length} mapped, ${unmapped.length} unmapped`);

    // Apply mappings to rows
    const containers = input.rawRows.map(row => {
        const fields: any = {};
        for (const [targetField, mapping] of Object.entries(mappings) as [string, any][]) {
            const val = row.rawData[mapping.sourceHeader];
            if (val !== undefined && val !== null) {
                fields[targetField] = {
                    value: val,
                    originalValue: val,
                    confidence: 1.0,
                    source: 'heuristic',
                    transformation: 'direct'
                };
            }
        }

        // Basic heuristic for unmapped fields -> meta
        const meta: any = {};
        for (const un of unmapped) {
            const val = row.rawData[un.sourceHeader];
            if (val !== undefined) {
                meta[un.sourceHeader] = val;
            }
        }

        // Calculate overall confidence based on required fields present
        // Quick check: container_number is critical
        const hasContainer = fields.container_number || fields.containerNumber;
        const confidence = hasContainer ? 0.85 : 0.0;

        return {
            rawRowId: row.id,
            fields: fields,
            meta: {
                ...meta,
                mappings: Object.fromEntries(
                    Object.entries(mappings).map(([k, v]: [string, any]) => [v.sourceHeader, k])
                ),
                source: 'Heuristic'
            },
            overallConfidence: confidence,
            flagsForReview: hasContainer ? [] : ['Missing Container Number']
        };
    });

    return {
        schemaMapping: {
            fieldMappings: mappings,
            unmappedSourceFields: unmapped,
            missingSchemaFields: [],
            detectedForwarder: "Unknown"
        },
        containers: containers,
        events: [],

        confidenceReport: {
            overallScore: 0.8,
            summary: "Heuristic Fallback Generated",
            totalFields: input.headers.length,
            highConfidence: Object.keys(mappings).length,
            mediumConfidence: 0,
            lowConfidence: 0,
            flaggedForReview: 0
        },
        dictionaryVersion: "Fallback"
    };
}

export async function runTranslator(input: TranslatorInput): Promise<TranslatorOutput> {
    console.log(`[Translator] STARTING RUN for ${input.importLogId}`);
    try {
        await loadDictionaries();
    } catch (e) {
        console.error("Failed dictionary load", e);
        throw e;
    }
    const allFields = { ...ONTOLOGY.required_fields, ...ONTOLOGY.optional_fields };
    const client = getAIClient();
    const chunk = input.rawRows;
    let output: TranslatorOutput | null = null;
    let systemPromptEnhanced = "";
    let currentPrompt = "";

    try {
        if (!client) throw new Error("No AI Client");
        console.log("[Translator] AI Client Active. Preparing prompt...");

        const baseSystemPrompt = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/translator-system.md'), 'utf-8');
        const userPromptTemplate = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/translator-user.md'), 'utf-8');

        currentPrompt = userPromptTemplate
            .replace('${JSON.stringify(headers)}', JSON.stringify(input.headers))
            .replace('${JSON.stringify(rawRows.slice(0, 5), null, 2)}', JSON.stringify(chunk, null, 2))
            .replace('${JSON.stringify(existingSchemaFields)}', JSON.stringify(input.existingSchemaFields))
            .replace('${JSON.stringify(transitStages)}', JSON.stringify(input.transitStages))
            .replace('${rawRows.length}', String(chunk.length));

        systemPromptEnhanced = `
${baseSystemPrompt}
## DICTIONARIES LOADED
### Container Field Ontology
${JSON.stringify({ required: ONTOLOGY.required_fields, optional: ONTOLOGY.optional_fields }, null, 2)}
`;

        console.log("[Translator] Sending Request to AI...");

        const aiCall = client.chat.completions.create({
            model: AZURE_DEPLOYMENT,
            messages: [
                { role: 'system', content: systemPromptEnhanced },
                { role: 'user', content: currentPrompt }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        }, { timeout: 15000 });

        const timeoutProtection = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Hard Timeout enforced")), 15000)
        );

        const response = await Promise.race([aiCall, timeoutProtection]);

        const content = response.choices[0].message.content;
        console.log("[Translator] AI Response Received length:", content?.length);
        if (process.env.LOG_LEVEL === 'trace') {
            console.log(`[Translator-TRACE] Full Prompt Sent:`);
            console.log(currentPrompt);
            console.log(`[Translator-TRACE] Full AI Response:`);
            console.log(content);
        }
        if (content) {
            output = JSON.parse(content) as TranslatorOutput;

            // Post-Process AI Output: Normalize Field Names!
            if (output && output.schemaMapping && output.schemaMapping.fieldMappings) {
                const newMappings: any = {};
                for (const [key, val] of Object.entries(output.schemaMapping.fieldMappings)) {
                    // "val" is { sourceHeader, targetField, ... }
                    // "key" is usually the targetField (or sometimes sourceHeader depending on AI hallucination)

                    // Use the helper to canonicalize what AI thought was the field name
                    const rawTarget = (val as any).targetField || key;
                    const canonical = toCanonicalFieldName(rawTarget);

                    if (canonical) {
                        newMappings[canonical] = {
                            ...(val as any),
                            targetField: canonical // Ensure consistency
                        };
                    }
                }
                output.schemaMapping.fieldMappings = newMappings;
            }
        }

    } catch (err) {
        console.warn("[Translator] AI Error/Timeout:", err);
        output = runHeuristicLogic(input, allFields);
    }

    if (!output) {
        console.warn("[Translator] No Output generated. Fallback.");
        output = runHeuristicLogic(input, allFields);
    }

    // --- AGGRESSIVE SANITIZATION (Safety Net) ---
    // Rule: If AI maps X->Y, but Dictionary strict match says X->Z, force X->Z.
    console.log("[Translator] Running Sanitization...");
    const initialMapCount = Object.keys(output.schemaMapping.fieldMappings).length;
    const keyRemap: Record<string, string> = {};

    for (const [aiTarget, rule] of Object.entries(output.schemaMapping.fieldMappings) as [string, any][]) {
        const header = rule.sourceHeader;
        const trueMatch = mapHeaderToCanonicalField(header, ONTOLOGY);

        if (trueMatch && trueMatch !== aiTarget) {
            console.log(`[Translator] Correction: Moving "${header}" from "${aiTarget}" to "${trueMatch}"`);
            keyRemap[aiTarget] = trueMatch;
            delete output.schemaMapping.fieldMappings[aiTarget];
            output.schemaMapping.fieldMappings[trueMatch] = {
                ...rule,
                targetField: trueMatch,
                notes: "Correction enforced by Dictionary"
            };
        }
    }

    // --- REINFORCEMENT (Gap Filling) ---
    // Rule: If AI left X unmapped, but Dictionary says X->Y, force X->Y.
    console.log("[Translator] Running Reinforcement (Unmapped Check)...");
    if (output.schemaMapping.unmappedSourceFields) {
        const stillUnmapped: any[] = [];
        for (const unmapped of output.schemaMapping.unmappedSourceFields) {
            const header = unmapped.sourceHeader;
            const trueMatch = mapHeaderToCanonicalField(header, ONTOLOGY);

            if (trueMatch && !output.schemaMapping.fieldMappings[trueMatch]) {
                console.log(`[Translator] Reinforcement: Mapping "${header}" -> "${trueMatch}"`);
                output.schemaMapping.fieldMappings[trueMatch] = {
                    sourceHeader: header,
                    targetField: trueMatch,
                    confidence: 0.99,
                    transformationType: 'direct',
                    notes: 'Heuristic Reinforcement'
                };
            } else {
                stillUnmapped.push(unmapped);
            }
        }
        output.schemaMapping.unmappedSourceFields = stillUnmapped;
    }

    // --- APPLY KEY REMAPPING TO CONTAINERS ---
    if (Object.keys(keyRemap).length > 0 && output.containers) {
        console.log(`[Translator] Applying ${Object.keys(keyRemap).length} key corrections to ${output.containers.length} containers...`);
        for (const container of output.containers) {
            const newFields: any = {};
            for (const [key, val] of Object.entries(container.fields)) {
                if (keyRemap[key]) {
                    newFields[keyRemap[key]] = val;
                } else {
                    newFields[key] = val;
                }
            }
            container.fields = newFields;
        }
    }

    console.log(`[Translator] Final Mapping Count: ${Object.keys(output.schemaMapping.fieldMappings).length} (vs Initial ${initialMapCount})`);
    if (output.containers) {
        console.log(`[Translator] Generated ${output.containers.length} containers.`);
        if (output.containers.length > 0) {
            console.log(`[Translator] Sample Container Num: ${output.containers[0].fields?.containerNumber?.value}`);
        }
    } else {
        console.log(`[Translator] WARNING: output.containers is undefined/empty`);
    }

    // Ensure metadata match and persist mappings for Learner
    if (output.containers && output.containers.length > 0) {
        output.containers.forEach((c, i) => {
            if (!c.rawRowId) c.rawRowId = chunk[i]?.id;

            // Build simple mapping object: "Header Name" -> "canonical_field"
            const rowMappings: Record<string, string> = {};
            if (c.fields) {
                for (const [k, v] of Object.entries(c.fields)) {
                    // v.sourceHeader might identify the original header
                    // If not present, we can't reliably learn. 
                    // But the schemaMapping has it!
                    // Better to rely on the global schemaMapping for this batch.
                }
            }

            // Actually, we can just attach the schemaMapping to the container metadata!
            // But schemaMapping is per BATCH (file), not per row.
            // The prompt asked for: meta.mappings = { "Header": "canonical_field" }

            const simpleMappings: Record<string, string> = {};
            for (const [field, rule] of Object.entries(output!.schemaMapping.fieldMappings) as [string, any][]) {
                if (rule.sourceHeader) {
                    simpleMappings[rule.sourceHeader] = field;
                }
            }

            c.meta = {
                ...c.meta,
                mappings: simpleMappings,
                confidence: output!.confidenceReport?.overallScore || 0,
                source: 'Translator'
            };
        });
    }

    // Apply Date Conversions
    if (output) {
        applyDateConversions(output);
    }

    // Apply Status Code Normalization
    if (output) {
        applyStatusNormalization(output);
    }

    return output;
}
