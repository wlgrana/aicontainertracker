import { highThink } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { detectFormat } from '@/lib/formatDetection';

export interface UnmappedFieldInsight {
    potentialMeaning: string;
    suggestedCanonicalField?: string;
    confidenceScore: number;
    dataType?: string;
}

export interface SchemaMapping {
    carrierFormatId?: string; // If found in DB
    forwarderName: string;
    columnMapping: Record<string, string>; // CanonicalField -> HeaderName
    unmappedFields?: Record<string, UnmappedFieldInsight>; // HeaderName -> Insight
    confidence: number;
    statusCache?: Map<string, string>;
}

// Fields from the Shipment + Container tables we want to map to
const CANONICAL_FIELDS = [
    "shipment_reference", // Shipment.shipmentReference
    "hbl",
    "mbl",
    "carrier",
    "forwarder",
    "pol",
    "pod",
    "container_number", // Container.containerNumber
    "container_type",
    "event_date",       // For ContainerEvent
    "event_location",
    "event_status",     // For TransitStage mapping
    "vessel",
    "voyage",
    // New Fields
    "business_unit",
    "transport_mode",
    "freight_cost",
    "volume",
    "booking_date",
    "gate_out_date",
    "empty_return_date",
    "destination_city",
    "shipper",
    "consignee",
    "pieces",
    "weight",
    "notes",
    // Operational Critical Fields - ADDED FOR ROBUSTNESS
    "last_free_day",
    "departure_date",      // ATD
    "port_arrival_date",   // ATA
    "estimated_arrival_pod", // ETA
    "seal_number",
    "pickup_appointment",
    "final_destination_eta",
    "actual_delivery_date"
];

export async function detectSchema(headers: string[], sampleRows: any[]): Promise<SchemaMapping> {
    // STEP 1: Check for known format first (Code-defined)
    const formatDetection = detectFormat(headers);

    if (formatDetection.isKnownFormat && formatDetection.format) {
        console.log(`Detected known format: ${formatDetection.format.name}`);

        // Use direct mapping from known format
        const columnMapping: Record<string, string> = {};

        for (const header of headers) {
            const headerLower = header.toLowerCase().trim();

            // Find matching key in format's column mapping
            for (const [formatKey, canonicalField] of Object.entries(formatDetection.format.columnMapping)) {
                if (headerLower === formatKey.toLowerCase().trim() ||
                    headerLower.includes(formatKey.toLowerCase().trim()) ||
                    formatKey.toLowerCase().trim().includes(headerLower)) {
                    columnMapping[canonicalField] = header;
                    break;
                }
            }
        }

        return {
            carrierFormatId: formatDetection.format.id,
            forwarderName: formatDetection.format.name,
            columnMapping: columnMapping,
            confidence: formatDetection.confidence,
            statusCache: new Map(), // Initialize empty map to match type
            unmappedFields: {}, // Explicitly set empty
        };
    }

    // STEP 2: Fall back to AI-based detection (or exact database match)
    return await detectSchemaWithAI(headers, sampleRows);
}

async function detectSchemaWithAI(headers: string[], sampleRows: any[]): Promise<SchemaMapping> {
    // 1. Check if we have an exact match in CarrierFormat
    const headerString = headers.sort().join(',');
    const savedFormat = await prisma.carrierFormat.findFirst({
        where: { sampleHeaders: headerString, isActive: true }
    });

    if (savedFormat && savedFormat.columnMapping) {
        return {
            carrierFormatId: savedFormat.formatName,
            forwarderName: savedFormat.carrierId || "Known Format",
            columnMapping: JSON.parse(savedFormat.columnMapping),
            confidence: 1.0
        };
    }

    // 2. AI Detection (High Think)
    if (!process.env.AZURE_AI_KEY) {
        console.log("AZURE_AI_KEY missing, using mock detection");
        return {
            forwarderName: "Mock-Carrier",
            columnMapping: headers.reduce((acc, h) => {
                const low = h.toLowerCase();
                if (low.includes('cont') || low.includes('cntr')) acc['container_number'] = h;
                if (low.includes('status')) acc['event_status'] = h;
                if (low.includes('date')) acc['event_date'] = h;
                if (low.includes('type') || low.includes('size')) acc['container_type'] = h;
                if (low.includes('loc')) acc['event_location'] = h;
                return acc;
            }, {} as Record<string, string>),
            unmappedFields: {},
            confidence: 0.9 // High confidence for mock so it doesn't always pause
        };
    }

    const prompt = `
    You are a logistics data expert. Analyze these Excel headers and sample rows to create a schema mapping.

    HEADERS: ${JSON.stringify(headers)}
    SAMPLE DATA: ${JSON.stringify(sampleRows.slice(0, 3), null, 2)}
    CANONICAL FIELDS: ${CANONICAL_FIELDS.join(", ")}

    Your Goal:
    1. Identify the Carrier or Forwarder if possible.
    2. Map the provided HEADERS to the CANONICAL FIELDS.
    3. IMPORTANT: For EVERY header that CANNOT be mapped to a canonical field, you MUST provide an "unmappedField" analysis.

    For Unmapped Fields, analyze:
    - potentialMeaning: A clear description of what this field likely represents in shipping/logistics context
    - suggestedCanonicalField: A camelCase field name we could add to our schema
    - confidenceScore: How confident you are (0-1.0)
    - dataType: The data type (string, number, date, currency)

    Common shipping field patterns to recognize:
    - "LFD", "LAST FREE DAY" -> last_free_day (critical for demurrage)
    - "FREIGHT COST", "OCEAN COST" -> freight_cost
    - "SHIP TO", "DESTINATION" -> destination_city
    - "SHIPPER" -> shipper, "CONSIGNEE" -> consignee
    - "BOOKING", "BL", "BOL" -> shipment_reference or mbl
    - "WEIGHT", "VOLUME", "PIECES" -> weight, volume, pieces
    - "HANDOFF", "DELIVERY" -> event_date (or actual_delivery_date)
    - "ATD", "ETD", "ATA", "ETA" -> departure_date, port_arrival_date, estimated_arrival_pod

    Response Format (JSON Only):
    {
      "forwarderName": "string",
      "mappedFields": { 
          "canonical_field_name": { "originalHeader": "Header Name", "confidenceScore": 0.9 }
      },
      "unmappedFields": {
         "Original Header Name": {
            "potentialMeaning": "What this field likely represents",
            "suggestedCanonicalField": "suggestedNameForFuture",
            "confidenceScore": 0.8,
            "dataType": "string"
         }
      },
      "overallConfidence": 0.85
    }
    Canonical Field Reference:
    - shipment_reference: The main tracking number
    - container_number: Standard 11-char container ID
    - event_status: Text description of the milestone (e.g. "Discharged", "Gate Out")
    - event_date: The timestamp of the status
    - last_free_day: The specific date when free time expires (LFD)
    - departure_date / port_arrival_date: Actual vessel movements
    `;

    try {
        const textResponse = await highThink(prompt);
        const text = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        // Transform AI response to internal SchemaMapping format
        const columnMapping: Record<string, string> = {};
        if (parsed.mappedFields) {
            for (const [canonical, info] of Object.entries(parsed.mappedFields)) {
                // Handle both simple string mapping (legacy prompt style) or object style
                if (typeof info === 'string') {
                    columnMapping[canonical] = info;
                } else if (typeof info === 'object' && (info as any).originalHeader) {
                    columnMapping[canonical] = (info as any).originalHeader;
                }
            }
        }

        // FAILSAFE: If AI returns no mappings (or very few), fallback to heuristics
        if (Object.keys(columnMapping).length === 0) {
            console.log("AI returned empty mapping. Falling back to heuristic matching.");
            const heuristicMapping = headers.reduce((acc, h) => {
                const low = h.toLowerCase();
                // Common matches
                if (low.includes('cont') || low.includes('cntr')) acc['container_number'] = h;
                if (low.includes('ref') || low.includes('shipment') || low.includes('booking')) acc['shipment_reference'] = h;
                if (low.includes('status') || low.includes('state')) acc['event_status'] = h;
                if (low.includes('date') || low.includes('eta') || low.includes('etd')) acc['event_date'] = h;
                if (low.includes('pod') || low.includes('dest')) acc['pod'] = h;
                if (low.includes('pol') || low.includes('origin')) acc['pol'] = h;
                if (low.includes('carrier') || low.includes('vessel')) acc['vessel'] = h;
                return acc;
            }, {} as Record<string, string>);

            return {
                forwarderName: parsed.forwarderName || "Unknown (Heuristic)",
                columnMapping: heuristicMapping,
                unmappedFields: {},
                confidence: 0.4
            };
        }

        return {
            forwarderName: parsed.forwarderName || "Unknown",
            columnMapping: columnMapping,
            unmappedFields: parsed.unmappedFields || {},
            confidence: parsed.overallConfidence || 0.5
        };

    } catch (e) {
        console.error("AI Schema Detection Failed:", e);
        // Fallback to basic heuristics if AI fails
        return {
            forwarderName: "Unknown (Fallback)",
            columnMapping: headers.reduce((acc, h) => {
                if (h.toLowerCase().includes('cont')) acc['container_number'] = h;
                if (h.toLowerCase().includes('status')) acc['event_status'] = h;
                if (h.toLowerCase().includes('date')) acc['event_date'] = h;
                return acc;
            }, {} as Record<string, string>),
            unmappedFields: {},
            confidence: 0.3
        };
    }
}
