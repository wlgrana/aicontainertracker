
import { type UnmappedFieldInsight } from "@/agents/schema-detector";

export const UNMAPPED_TO_DISPLAY_MAPPING: Record<string, { displayField: string; displaySection: string; patterns: string[] }> = {
    // Dates
    'actual_departure_date': {
        displayField: 'departureActual',
        displaySection: 'containerSpecification',
        patterns: ['ACTUAL DEPARTURE', 'ATD', 'DEPARTURE DATE', 'VESSEL SAILED']
    },
    'actual_arrival_date': {
        displayField: 'arrivalActual',
        displaySection: 'containerSpecification',
        patterns: ['ACTUAL ARRIVAL', 'ATA', 'ARRIVAL DATE', 'PORT ARRIVAL']
    },
    'estimated_arrival': {
        displayField: 'arrivalEstimated',
        displaySection: 'containerSpecification',
        patterns: ['ETA', 'ESTIMATED ARRIVAL', 'EXPECTED ARRIVAL']
    },

    // Financial
    'freight_cost': {
        displayField: 'freightCost',
        displaySection: 'commercialProfile',
        patterns: ['FREIGHT COST', 'OCEAN FREIGHT', 'SHIPPING COST', 'FREIGHT CHARGES']
    },

    // Locations
    'destination_port': {
        displayField: 'destinationPort',
        displaySection: 'containerSpecification',
        patterns: ['PORT OF DESTINATION', 'DESTINATION PORT', 'DISCHARGE PORT', 'POD']
    },
    'destination_city': {
        displayField: 'destinationCity',
        displaySection: 'commercialProfile',
        patterns: ['SHIP TO CITY', 'DESTINATION CITY', 'DELIVERY CITY', 'FINAL DESTINATION']
    },

    // Cargo Details
    'weight': {
        displayField: 'weight',
        displaySection: 'commercialProfile',
        patterns: ['WEIGHT', 'GROSS WEIGHT', 'ACTUAL WEIGHT', 'SHIPMENT WEIGHT']
    },
    'volume': {
        displayField: 'volume',
        displaySection: 'commercialProfile',
        patterns: ['VOLUME', 'CBM', 'SHIPMENT VOLUME', 'CUBIC METERS']
    },
    'pieces': {
        displayField: 'pieces',
        displaySection: 'commercialProfile',
        patterns: ['PIECES', 'PIECE COUNT', 'SHIPMENT PIECES', 'CARTONS']
    },

    // Parties
    'shipper': {
        displayField: 'shipper',
        displaySection: 'commercialProfile',
        patterns: ['SHIPPER', 'SHIPPER NAME', 'SHIPPER FULL NAME']
    },
    'consignee': {
        displayField: 'consignee',
        displaySection: 'commercialProfile',
        patterns: ['CONSIGNEE', 'CONSIGNEE NAME', 'SHIP TO NAME']
    },

    // Additional Common Fields
    'shipping_type': {
        displayField: 'shippingType',
        displaySection: 'commercialProfile',
        patterns: ['SHIPPING TYPE', 'LCL/FCL', 'LOAD TYPE']
    }
};

export interface InferredFieldData {
    value: any;
    originalFieldName: string;
    confidenceScore: number;
    source: 'unmapped_ai_analyzed';
    suggestedField: string;
}

export interface ContainerUnmappedField extends UnmappedFieldInsight {
    rawValue: any;
}

export function extractInferredData(
    unmappedFields: Record<string, ContainerUnmappedField> | undefined,
    confidenceThreshold: number = 0.85
): Record<string, InferredFieldData> {

    const inferredData: Record<string, InferredFieldData> = {};

    if (!unmappedFields) return inferredData;

    for (const [fieldName, insight] of Object.entries(unmappedFields)) {
        // Only use high-confidence fields
        if ((insight.confidenceScore || 0) < confidenceThreshold) continue;

        // Check if this field maps to a display field
        const suggestedField = insight.suggestedCanonicalField;
        if (!suggestedField) continue;

        const mappingConfig = UNMAPPED_TO_DISPLAY_MAPPING[suggestedField];

        if (mappingConfig) {
            inferredData[mappingConfig.displayField] = {
                value: insight.rawValue,
                originalFieldName: fieldName,
                confidenceScore: insight.confidenceScore || 0,
                source: 'unmapped_ai_analyzed',
                suggestedField
            };
        }
    }

    return inferredData;
}
