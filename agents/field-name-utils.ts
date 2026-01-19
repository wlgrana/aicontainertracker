
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts a field name to its canonical snake_case form.
 * Handles:
 * - "metadata.fieldName" -> "field_name"
 * - "camelCase" -> "camel_case"
 * - "PascalCase" -> "pascal_case"
 * - "UPPER_CASE" -> "upper_case"
 */
export function toCanonicalFieldName(field: string): string {
    if (!field) return '';

    // 1. Remove metadata prefix
    let name = field.replace(/^metadata\./, '');

    // 2. Convert to snake_case
    // Replace camelCase logic: insert underscore before capital letters, unless it's start.
    // Also handle existing underscores/spaces.
    name = name
        // Insert underscore before capital letters coming after lowercase/number
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, ''); // Trim underscores

    return name;
}

/**
 * Validates if the given canonical field exists in the ontology.
 */
export function validateFieldExists(canonicalField: string | null | undefined, ontology: any): boolean {
    if (!canonicalField) return false;
    if (!ontology) return false;

    return Boolean(
        ontology.required_fields?.[canonicalField] ||
        ontology.optional_fields?.[canonicalField]
    );
}

/**
 * Normalizes a header string for comparison (lowercase, alphanumeric only).
 */
export function normalizeHeader(h: string): string {
    if (!h) return '';
    return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Tries to find a canonical field for the given header using ontology synonyms.
 */
export function mapHeaderToCanonicalField(header: string, ontology: any): string | null {
    if (!ontology) return null;

    const normalizedHeader = normalizeHeader(header);
    const allFields = {
        ...ontology.required_fields,
        ...ontology.optional_fields,
        ...Object.fromEntries(
            Object.entries(ontology.metadata_fields || {}).map(([k, v]) => [`metadata.${k}`, v])
        )
    };

    for (const [canonicalField, def] of Object.entries(allFields) as [string, any][]) {
        // 1. Exact match (normalized)
        if (normalizeHeader(canonicalField) === normalizedHeader) {
            return canonicalField;
        }

        // 2. Synonym match
        if (def.header_synonyms) {
            let synonyms: string[] = [];
            if (Array.isArray(def.header_synonyms)) {
                synonyms = def.header_synonyms;
            } else if (typeof def.header_synonyms === 'object') {
                // Handle nested synonyms like { mbl: [...], booking: [...] }
                synonyms = Object.values(def.header_synonyms).flat() as string[];
            }

            if (synonyms.some(s => normalizeHeader(s) === normalizedHeader)) {
                return canonicalField;
            }
        }
    }

    return null;
}
