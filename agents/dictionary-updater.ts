
import { AnalyzerOutput, AnalyzerSuggestion } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { toCanonicalFieldName, normalizeHeader } from './field-name-utils';

function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function findFieldDefinition(ontology: any, canonicalField: string): any {
    // 1. Normalize to snake_case first (baseline)
    const normalized = toCanonicalFieldName(canonicalField);

    // 2. Derive camelCase
    const camelCase = toCamelCase(normalized);

    // 3. Define variations to check
    const variations = [
        canonicalField,                 // Original input
        camelCase,                      // camelCase (target in ontology?)
        normalized,                     // snake_case
        normalized.replace(/_/g, ''),   // flatcase
    ];

    for (const variant of variations) {
        // Check required, optional, then pending (though pending is not usually a definition source)
        // Usually we only check definitions in required/optional for adding synonyms.
        const fieldDef = ontology.required_fields?.[variant] || ontology.optional_fields?.[variant];

        if (fieldDef) {
            return {
                def: fieldDef,
                actualKey: variant
            };
        }
    }
    return null;
}

export interface UpdaterOutput {
    synonymsAdded: number;
    pendingAdded: number;
    details: string[];
}

export async function updateDictionaries(analysis: AnalyzerOutput): Promise<UpdaterOutput> {
    console.log(`[Updater] 📥 Processing ${analysis.suggestions.length} suggestions...`);

    const ontologyPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');

    let ontology: any;
    try {
        const fileContent = fs.readFileSync(ontologyPath, 'utf-8');
        ontology = yaml.parse(fileContent);
    } catch (e) {
        console.error(`[Updater] Failed to load ontology from ${ontologyPath}`, e);
        return { synonymsAdded: 0, pendingAdded: 0, details: ["Error loading ontology"] };
    }

    // Ensure sections exist
    if (!ontology.required_fields) ontology.required_fields = {};
    if (!ontology.optional_fields) ontology.optional_fields = {};
    if (!ontology.pending_fields) ontology.pending_fields = [];

    let synonymsAdded = 0;
    let pendingAdded = 0;
    const details: string[] = [];
    const fieldsUpdated = new Set<string>();

    for (const suggestion of analysis.suggestions) {
        const rawHeader = suggestion.unmappedHeader;
        let targetField = suggestion.canonicalField;

        // 1. Normalize Target Field (Handle metadata.foo -> foo, camelCase -> snake_case)
        // We defer strict normalization to findFieldDefinition to allow multiple attempts

        // 2. Find Field Definition
        const fieldInfo = findFieldDefinition(ontology, targetField);
        const fieldDef = fieldInfo?.def;

        // 3. Robust Synonym Search
        if (!fieldDef) {
            console.log(`[Updater] ⚠️  Field '${targetField}' (from '${suggestion.canonicalField}') not found in ontology. Skipping.`);

            // If high confidence, add to pending for manual review
            if (suggestion.confidence > 0.8) {
                const isPending = ontology.pending_fields.some((p: any) =>
                    normalizeHeader(p.unmappedHeader) === normalizeHeader(rawHeader) &&
                    p.canonicalField === targetField
                );

                if (!isPending) {
                    ontology.pending_fields.push({
                        ...suggestion,
                        canonicalField: targetField,
                        timestamp: new Date().toISOString()
                    });
                    pendingAdded++;
                    details.push(`📋 Pending Review: "${rawHeader}" → ${targetField} (Unknown Field)`);
                }
            }
            continue;
        }

        // Use the actual key found in ontology
        targetField = fieldInfo.actualKey;
        console.log(`[Updater] ✅ Found field '${targetField}' (from '${suggestion.canonicalField}')`);

        // 4. Update Logic
        const threshold = fieldDef.confidence_threshold || 0.85;

        if (suggestion.action === 'ADD_SYNONYM' && suggestion.confidence >= threshold) {
            // Initialize header_synonyms if needed
            if (!fieldDef.header_synonyms) {
                fieldDef.header_synonyms = [];
            }

            // Check existence (Case insensitive check)
            const existingSynonyms = new Set<string>();

            const addSynonymsToSet = (syns: any) => {
                if (Array.isArray(syns)) {
                    syns.forEach(s => existingSynonyms.add(normalizeHeader(s)));
                } else if (typeof syns === 'object') {
                    Object.values(syns).flat().forEach((s: any) => existingSynonyms.add(normalizeHeader(s)));
                }
            };
            addSynonymsToSet(fieldDef.header_synonyms);

            if (!existingSynonyms.has(normalizeHeader(rawHeader))) {
                // If it's a simple array, push. If object, this is tricky.
                if (Array.isArray(fieldDef.header_synonyms)) {
                    fieldDef.header_synonyms.push(rawHeader);
                    synonymsAdded++;
                    fieldsUpdated.add(targetField);
                    details.push(`✅ Added synonym: "${rawHeader}" → ${targetField}`);
                    console.log(`[Updater] ✅ Linked "${rawHeader}" to ${targetField}`);
                } else {
                    // For MVP, if it's an object, we can't easily auto-add without knowing the sub-key.
                    // But we can check if we want to convert it? No, keep it safe.
                    details.push(`⚠️  Skipped complex field ${targetField} (nested synonyms)`);
                }
            } else {
                console.log(`[Updater] ⏭️  Synonym "${rawHeader}" already exists for ${targetField}`);
            }

        } else if (suggestion.confidence >= 0.70) {
            // Low confidence -> Pending
            const isPending = ontology.pending_fields.some((p: any) =>
                normalizeHeader(p.unmappedHeader) === normalizeHeader(rawHeader));

            if (!isPending) {
                ontology.pending_fields.push({
                    ...suggestion,
                    canonicalField: targetField,
                    timestamp: new Date().toISOString()
                });
                pendingAdded++;
                details.push(`📋 Added to Pending: "${rawHeader}" → ${targetField} (Conf: ${suggestion.confidence})`);
            }
        }
    }

    // Save
    if (synonymsAdded > 0 || pendingAdded > 0) {
        // Bump version
        const versionParts = (ontology.version || "1.0.0").split('.').map(Number);
        versionParts[2]++;
        ontology.version = versionParts.join('.');
        ontology.last_updated = new Date().toISOString().split('T')[0];

        fs.writeFileSync(ontologyPath, yaml.stringify(ontology));
        console.log(`[Updater] 💾 Saved Ontology v${ontology.version}`);
    }

    return { synonymsAdded, pendingAdded, details };
}
