import { FIELD_REGISTRY, findFieldDefinition } from './fieldRegistry';

export interface ExtractedField {
    canonicalField: string;
    displayLabel: string;
    value: any;
    formattedValue: string;
    originalFieldName: string;
    source: 'structured' | 'mapped' | 'unmapped_raw';
    confidence: number;
    formatType: string;
    priority: string;
    displaySection: string;
}

export interface ExtractedContainerData {
    fields: Record<string, ExtractedField>;
    bySection: {
        header: ExtractedField[];
        keyMetrics: ExtractedField[];
        commercialProfile: ExtractedField[];
        containerSpec: ExtractedField[];
        timeline: ExtractedField[];
        financial: ExtractedField[];
    };
    completeness: {
        total: number;
        populated: number;
        percentage: number;
    };
}

export function extractContainerData(container: any): ExtractedContainerData {
    const fields: Record<string, ExtractedField> = {};

    // Step 1: Extract from structured database fields
    // Note: These field names must match the actual database schema fields on the Container/Shipment objects
    // We assume 'container' passed here includes relations like Shipment if available, or flattened
    const structuredFields = [
        'containerNumber', 'status', 'carrier', 'vesselName', 'voyageNumber',
        'originPort', 'destinationPort', 'departureEstimated', 'departureActual',
        'arrivalEstimated', 'arrivalActual', 'lastFreeDay', 'businessUnit',
        'shipper', 'consignee', 'freightCost', 'weight', 'volume', 'pieces'
    ];

    for (const field of structuredFields) {
        // Fallback: Check container[field] first, then try shipment relation (container.shipment[field])
        const value = container[field] ?? container.shipment?.[field];

        if (value && value !== 'N/A' && value !== '') {
            const definition = FIELD_REGISTRY.find(d => d.canonicalField === field);
            if (definition) {
                fields[field] = {
                    canonicalField: field,
                    displayLabel: definition.displayLabel,
                    value: value,
                    formattedValue: formatValue(value, definition.formatType),
                    originalFieldName: field,
                    source: 'structured',
                    confidence: 1.0,
                    formatType: definition.formatType,
                    priority: definition.priority,
                    displaySection: definition.displaySection
                };
            }
        }
    }

    // Step 2: Extract from raw metadata (originalRow)
    // Access metadata safely
    const metadata = container.metadata as any || {};
    const originalRow = metadata.raw?.originalRow || {};

    for (const [fieldName, rawValue] of Object.entries(originalRow)) {
        if (rawValue === null || rawValue === undefined || rawValue === '') continue;

        const definition = findFieldDefinition(fieldName);
        // Only add if not already present from structured source
        if (definition && !fields[definition.canonicalField]) {
            fields[definition.canonicalField] = {
                canonicalField: definition.canonicalField,
                displayLabel: definition.displayLabel,
                value: rawValue,
                formattedValue: formatValue(rawValue, definition.formatType),
                originalFieldName: fieldName,
                source: 'unmapped_raw',
                confidence: 0.95, // High confidence for direct extraction
                formatType: definition.formatType,
                priority: definition.priority,
                displaySection: definition.displaySection
            };
        }
    }

    // Step 3: Extract from AI-analyzed unmapped fields
    const unmappedFields = metadata.mapping?.unmappedFields || {};

    for (const [fieldName, analysis] of Object.entries(unmappedFields)) {
        if (!analysis || !(analysis as any).rawValue) continue;

        const aiAnalysis = analysis as any;
        const suggestedField = aiAnalysis.suggestedCanonicalField;

        // Try to match by suggested field or by field name
        const definition = suggestedField ?
            FIELD_REGISTRY.find(d => d.canonicalField === suggestedField) :
            findFieldDefinition(fieldName);

        // Last chance: try to match by potential meaning keywords if desperate? (Skipping for now for safety)

        if (definition && !fields[definition.canonicalField]) {
            fields[definition.canonicalField] = {
                canonicalField: definition.canonicalField,
                displayLabel: definition.displayLabel,
                value: aiAnalysis.rawValue,
                formattedValue: formatValue(aiAnalysis.rawValue, definition.formatType),
                originalFieldName: fieldName,
                source: 'unmapped_raw',
                confidence: aiAnalysis.confidenceScore || 0.9,
                formatType: definition.formatType,
                priority: definition.priority,
                displaySection: definition.displaySection
            };
        }
    }

    // Step 4: Organize by section
    const bySection = {
        header: [] as ExtractedField[],
        keyMetrics: [] as ExtractedField[],
        commercialProfile: [] as ExtractedField[],
        containerSpec: [] as ExtractedField[],
        timeline: [] as ExtractedField[],
        financial: [] as ExtractedField[]
    };

    for (const field of Object.values(fields)) {
        const section = field.displaySection as keyof typeof bySection;
        if (bySection[section]) {
            bySection[section].push(field);
        }
    }

    // Sort each section by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const section of Object.keys(bySection)) {
        bySection[section as keyof typeof bySection].sort((a, b) =>
            priorityOrder[a.priority as keyof typeof priorityOrder] -
            priorityOrder[b.priority as keyof typeof priorityOrder]
        );
    }

    // Step 5: Calculate completeness
    // Only count fields that are Critical or High priority
    const criticalAndHighFields = FIELD_REGISTRY.filter(
        d => d.priority === 'critical' || d.priority === 'high'
    );
    const populatedCriticalHigh = criticalAndHighFields.filter(
        d => fields[d.canonicalField]
    );

    return {
        fields,
        bySection,
        completeness: {
            total: criticalAndHighFields.length,
            populated: populatedCriticalHigh.length,
            percentage: Math.round((populatedCriticalHigh.length / criticalAndHighFields.length) * 100) || 0
        }
    };
}

// Format value based on type
function formatValue(value: any, formatType: string): string {
    if (value === null || value === undefined) return '';

    switch (formatType) {
        case 'date':
            try {
                const date = new Date(value);
                if (isNaN(date.getTime())) return String(value);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch {
                return String(value);
            }

        case 'currency':
            const currencyNum = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            return isNaN(currencyNum) ? String(value) : `$${currencyNum.toLocaleString()}`;

        case 'weight':
            const weightNum = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            return isNaN(weightNum) ? String(value) : `${weightNum.toLocaleString()} KG`;

        case 'volume':
            const volNum = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            return isNaN(volNum) ? String(value) : `${volNum} M³`;

        case 'number':
            const num = parseFloat(String(value));
            return isNaN(num) ? String(value) : num.toLocaleString();

        case 'port':
            return String(value).toUpperCase();

        default:
            return String(value);
    }
}
