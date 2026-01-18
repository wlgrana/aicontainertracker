



import { TranslatorInput, TranslatorOutput } from '../types/agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

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

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBestMatch(header: string, allFields: any): string | null {
    const normalized = normalizeHeader(header);
    // 1. Exact Name
    if (allFields[header] || allFields[normalized]) return allFields[header] ? header : normalized;
    // 2. Synonyms
    for (const [fieldKey, fieldDef] of Object.entries(allFields) as [string, any][]) {
        if (normalizeHeader(fieldKey) === normalized) return fieldKey;
        const synonyms = fieldDef.header_synonyms || [];
        let flatSynonyms: string[] = [];
        if (Array.isArray(synonyms)) {
            synonyms.forEach((x: any) => {
                if (typeof x === 'string') flatSynonyms.push(x);
                else if (typeof x === 'object') flatSynonyms.push(...Object.values(x).flat() as string[]);
            });
        } else if (typeof synonyms === 'object') flatSynonyms = Object.values(synonyms).flat() as string[];

        if (flatSynonyms.some(s => normalizeHeader(s) === normalized)) return fieldKey;
    }
    // 3. Fuzzy / Smart Match
    // Strategy: Check if normalized header contains target key or vice-versa (e.g., "OGF Date" vs "gateofdate" is hard, but "Container Number" vs "containernumber" is handled by normalization).
    // Let's add Levenshtein-like check or just checking if key is substring of header.
    for (const fieldKey of Object.keys(allFields)) {
        const normKey = normalizeHeader(fieldKey);
        // If header is "ContainerNumber" (norm: containernumber) and key is "container_number" (norm: containernumber), strict match handles it.
        // What about "Acutal Gateout"? Key "gate_out_date".
        // Levenshtein is expensive to implement here without lib.
        // Let's rely on the AI for deep fuzzy matching, this function is for "safe" dictionary enforcement.
        // However, we can handle common prefix/suffixes or simple typos?
        // Let's stick to strict normalization for safety, BUT add specific manual overrides if needed.
        // Actually, the user wants "Common Sense". If AI mapped it, and we found NO dictionary match, we currently KEEP AI MAPPING.
        // The only time we override is if `trueMatch` IS FOUND.
        // So sanitization is NOT the problem if `trueMatch` returns null.
        // If trueMatch returns null, we respect AI decision.
        // The problem is Reinforcement: "If AI left X unmapped... force X->Y".
        // If findBestMatch fails, we don't reinforce.

        // Let's relax normalization to allow partial matches if confidence is high? No, that's dangerous.
        // The BEST "Common Sense" is effectively handled by the AI prompt update I just did.
        // The Sanitization/Reinforcement should remain strict to prevent garbage.
        // But I will add a log to see if we are missing stuff.
    }
    return null;
}

function runHeuristicLogic(input: TranslatorInput, allFields: any): TranslatorOutput {
    console.log("[Translator] Running HEURISTIC LOGIC...");
    const mappings: any = {};
    const unmapped: any[] = [];
    const usedTargets = new Set<string>();

    for (const header of input.headers) {
        const bestMatch = findBestMatch(header, allFields);
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
            meta: meta,
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
        if (content) output = JSON.parse(content) as TranslatorOutput;

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

    for (const [aiTarget, rule] of Object.entries(output.schemaMapping.fieldMappings) as [string, any][]) {
        const header = rule.sourceHeader;
        const trueMatch = findBestMatch(header, allFields);

        if (trueMatch && trueMatch !== aiTarget) {
            console.log(`[Translator] Correction: Moving "${header}" from "${aiTarget}" to "${trueMatch}"`);
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
            const trueMatch = findBestMatch(header, allFields);

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

    console.log(`[Translator] Final Mapping Count: ${Object.keys(output.schemaMapping.fieldMappings).length} (vs Initial ${initialMapCount})`);

    // Ensure metadata match
    if (output.containers && output.containers.length > 0) {
        output.containers.forEach((c, i) => { if (!c.rawRowId) c.rawRowId = chunk[i]?.id; });
    }

    return output;
}
