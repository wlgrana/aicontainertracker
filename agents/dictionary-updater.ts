
import { AnalyzerOutput, AnalyzerSuggestion } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface UpdaterOutput {
    synonymsAdded: number;
    pendingAdded: number;
    details: string[];
}

export async function updateDictionaries(analysis: AnalyzerOutput): Promise<UpdaterOutput> {
    console.log(`[Updater] Processing ${analysis.suggestions.length} suggestions...`);

    const ontologyPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');
    const fileContent = fs.readFileSync(ontologyPath, 'utf-8');
    const ontology = yaml.parse(fileContent);

    let addedCount = 0;
    let pendingCount = 0;
    const details: string[] = [];

    for (const suggestion of analysis.suggestions) {
        // Check if we should auto-approve based on field-specific threshold
        let fieldDef = ontology.required_fields?.[suggestion.canonicalField]
            || ontology.optional_fields?.[suggestion.canonicalField];

        const threshold = fieldDef?.confidence_threshold || 0.90;

        if (suggestion.action === 'ADD_SYNONYM' && suggestion.confidence >= threshold) {
            // Add to header_synonyms
            if (fieldDef) {
                if (!fieldDef.header_synonyms) fieldDef.header_synonyms = [];

                // Handle complex synonym structure (array vs object with keys like 'atd', 'etd')
                if (Array.isArray(fieldDef.header_synonyms)) {
                    if (!fieldDef.header_synonyms.includes(suggestion.unmappedHeader)) {
                        fieldDef.header_synonyms.push(suggestion.unmappedHeader);
                        addedCount++;
                        details.push(`Added "${suggestion.unmappedHeader}" to ${suggestion.canonicalField}`);
                    }
                } else if (typeof fieldDef.header_synonyms === 'object') {
                    // For nested synonyms (e.g. arrival_date -> ata, eta), we need to know which sub-key.
                    // The Analyzer might not return sub-key.
                    // For MVP, we skip complex fields or assume default.
                    // Or check if Analyzer return matched sub-types. 
                    // To be safe, we might skip complex fields or default to 'default'.
                    details.push(`Skipped complex field ${suggestion.canonicalField} (nested synonyms not supported yet)`);
                }
            } else {
                console.warn(`[Updater] Canonical field ${suggestion.canonicalField} not found.`);
            }
        } else if (suggestion.confidence >= 0.70) {
            // Add to pending_fields
            if (!ontology.pending_fields) ontology.pending_fields = [];
            ontology.pending_fields.push({
                ...suggestion,
                timestamp: new Date().toISOString()
            });
            pendingCount++;
        }
    }

    if (addedCount > 0 || pendingCount > 0) {
        // Increment version
        const versionParts = (ontology.version || "1.0.0").split('.').map(Number);
        versionParts[2]++; // Patch bump
        ontology.version = versionParts.join('.');
        ontology.last_updated = new Date().toISOString().split('T')[0];

        // Write back
        fs.writeFileSync(ontologyPath, yaml.stringify(ontology));
        console.log(`[Updater] Updated ontology to version ${ontology.version}`);
    }

    return {
        synonymsAdded: addedCount,
        pendingAdded: pendingCount,
        details
    };
}
