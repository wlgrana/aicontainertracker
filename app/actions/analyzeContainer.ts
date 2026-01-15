"use server";

import { highThink } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { saveAssessment } from './ai/persistence';
import { format } from 'date-fns';
import { extractInferredData } from '@/lib/utils/ai-mappings';
import { runExceptionClassifier } from '@/agents/exception-classifier';

// --- NEW IMPORTS FOR RE-AUDIT ---
import { detectSchema } from '@/agents/schema-detector';
import { normalizeData } from '@/agents/data-normalizer';

const FIELD_DEFINITIONS = {
    // Container Specific
    containerNumber: "Unique identifier for the shipping container (e.g., MSKU1234567).",
    containerType: "ISO code or description of container size/type (e.g., 40HC, 20GP).",
    sealNumber: "Security seal number attached to the container door.",
    grossWeight: "Total weight of the cargo including packaging (kg or lbs).",
    volumeCbm: "Total volume of cargo in cubic meters.",
    pieces: "Number of packages or handling units.",

    // Locations & Routing
    pol: "Port of Loading - where the container was loaded onto the vessel.",
    pod: "Port of Discharge - where the container is unloaded from the vessel.",
    finalDestination: "Ultimate delivery location for the cargo.",
    currentLocation: "Last known physical location of the container.",
    currentVessel: "Name of the vessel currently carrying the container.",
    currentVoyage: "Voyage number of the current vessel.",

    // Dates
    bookingDate: "Date the shipment was booked with the carrier.",
    etd: "Estimated Time of Departure from POL.",
    atd: "Actual Time of Departure from POL.",
    eta: "Estimated Time of Arrival at POD.",
    ata: "Actual Time of Arrival at POD.",
    lastFreeDay: "Last day to pick up container before demurrage charges apply.",
    gateOutDate: "Date container left the terminal/port.",
    emptyReturnDate: "Date empty container was returned to depot.",
    deliveryDate: "Date cargo was delivered to final destination.",
    finalDestinationEta: "Estimated arrival at the final inland destination.",

    // Parties
    shipper: "Party sending the goods.",
    consignee: "Party receiving the goods.",
    businessUnit: "Internal business unit or division owning the shipment.",
    carrier: "Shipping line or VOCC transporting the container.",

    // References
    mbl: "Master Bill of Lading number.",
    hbl: "House Bill of Lading number.",
    poNumber: "Purchase Order number.",
    customerPo: "Customer's Purchase Order number.",
    shipmentReference: "Internal shipment ID or reference number.",

    // Status
    currentStatus: "Current status code (e.g., IN_TRANSIT, DISCHARGED).",
    emptyIndicator: "Boolean indicating if container is empty (true) or loaded (false).",
    pgaHold: "Boolean indicating if a Government Agency (FDA, USDA) hold exists.",
    aceStatus: "US Customs ACE system status (e.g., RELEASED, PROCESSED)."
};

export interface ContainerAnalysis {
    riskScore?: number;
    riskFactors?: Array<{
        icon: string;
        title: string;
        desc: string;
        impact: string;
    }>;
    recommendations?: string[];
    // Deprecated fields kept for type safety
    prediction?: string;
    outcome?: string;

    dataSummary?: {
        narrative: string;
        keyDates: string[];
        financialSummary: string;
    };
    // New Meta Tables Structure
    metaTables?: {
        identity: Array<{ label: string, value: string, notes?: string }>;
        routing: Array<{ label: string, value: string, notes?: string }>;
        parties: Array<{ label: string, value: string, notes?: string }>;
        timeline: Array<{ label: string, value: string, notes?: string }>;
    };
    unmappedInsights?: {
        summary: string;
        findings: string[];
        riskImpact: string;
    };
    dataChecks?: {
        passed: boolean;
        issues: Array<{
            field: string;
            severity: 'critical' | 'warning';
            message: string;
            suggestedValue?: any;
        }>;
    };
    classification?: {
        status: {
            operational: string;
            confidence: string;
            reason: string;
        };
        attention: {
            category: string;
            urgency: string;
            headline: string | null;
            owner: string | null;
        };
    };
    timestamp?: Date | string;
    structured_metadata?: {
        container_number: string;
        business_unit: string;
        carrier_scac: string;
        current_status: string;
        pol: string;
        pod: string;
        final_destination: string;
        booking_date: string | null;
        etd: string | null;
        atd: string | null;
        eta: string | null;
        ata: string | null;
        last_free_day: string | null;
        delivery_date: string | null;
        days_in_transit: number;
        // Optional extended fields if needed, but keeping strict to prompt request for now:
        health_score?: number;
        demurrage_exposure?: string;
    };
}

export async function analyzeContainer(containerNumber: string): Promise<ContainerAnalysis> {

    // 0. PRE-FLIGHT: Run Operational Classifier to clean "Zombie Alerts"
    await runExceptionClassifier(containerNumber);

    // 1. Fetch Container Context
    const container = await prisma.container.findUnique({
        where: { containerNumber },
        include: {
            events: { orderBy: { eventDateTime: 'desc' } },
            shipmentContainers: { include: { shipment: true } }
        }
    });

    if (!container) throw new Error("Container not found");

    // 2. Prepare Data Context for AI
    const now = new Date();
    const meta = container.metadata as any;
    const inferredData = extractInferredData(meta?.mapping?.unmappedFields);

    const inferredContext = Object.entries(inferredData)
        .map(([key, data]) => `- ${key}: ${data.value} (Confidence: ${Math.round(data.confidenceScore * 100)}%, Source Field: "${data.originalFieldName}")`)
        .join('\n');

    const structuredContext = {
        status: container.currentStatus,
        lastUpdated: container.statusLastUpdated ? format(new Date(container.statusLastUpdated), 'yyyy-MM-dd') : 'Never',
        vessel: container.currentVessel || "Unassigned",
        eta: container.eta ? format(new Date(container.eta), 'yyyy-MM-dd') : "None",
        ata: container.ata ? format(new Date(container.ata), 'yyyy-MM-dd') : "None",
        pod: container.pod || "Unknown",
        pol: container.pol || "Unknown",
        lastFreeDay: container.lastFreeDay ? format(new Date(container.lastFreeDay), 'yyyy-MM-dd') : "Unknown",
        eventsCount: container.events.length,
        commercial: container.shipmentContainers[0]?.shipment ? {
            consignee: container.shipmentContainers[0].shipment.consignee,
            shipper: container.shipmentContainers[0].shipment.shipper,
            freightCost: container.shipmentContainers[0].shipment.freightCost,
            businessUnit: container.shipmentContainers[0].shipment.businessUnit
        } : "Not linked"
    };

    // 3. Construct Prompt
    const prompt = `
    Role: Logistics Data Assistant
    Task: Extract structured shipping data from raw records and classify the deployment status.

    Please analyze the provided raw container data and populated fields.
    
    OBJECTIVES:
    1. Extract metadata for the fields defined in the DICTIONARY.
    2. Analyze the timeline and events to determine the current operational status.
    3. Return the specific JSON structure requested.

    FIELD DICTIONARY:
    ${JSON.stringify(FIELD_DEFINITIONS, null, 2)}

    CURRENT DATABASE STATE:
    ${JSON.stringify(structuredContext, null, 2)}

    RAW IMPORT DATA:
    ${JSON.stringify(meta?.raw?.originalRow || "No raw data preserved", null, 2)}

    INFERRED DATA CLUES:
    ${inferredContext || "No inferred clues."}

    === INSTRUCTIONS ===
    
    1. **Data Extraction**:
       - Map values from the Raw Data to the requested fields in the metadata tables.
       - Use the Inferred Data clues if direct mapping is ambiguous.
       - prioritize accuracy over filling every field.

    2. **Status Classification**:
       Evaluate the container's journey based on the following rules:

       ## ENUMS
       
       ### status.operational
       - BOOKED: Confirmed, not moved
       - PENDING_DEPARTURE: At origin, waiting
       - DEPARTED: Left origin port
       - IN_TRANSIT: Moving
       - ARRIVING: < 72h to arrival
       - ARRIVED: At destination port
       - DISCHARGED: Unloaded from vessel
       - CUSTOMS_HOLD: Held by authorities
       - RELEASED: Cleared customs
       - OUT_FOR_DELIVERY: En route to final destination
       - DELIVERED: Completed
       - RETURNED_EMPTY: Empty container returned
       - UNKNOWN: Indeterminate

       ### status.confidence
       - VERIFIED: Confirmed by multiple signals
       - INFERRED: Deduced from partial data
       - STALE: Data > 5 days old
       - CONFLICTING: Signals disagree
       - INCOMPLETE: Missing key dates

       ### attention.category
       - ON_TRACK: Normal progress
       - DATA_CONFLICT: Evidence mismatch
       - MILESTONE_OVERDUE: Late event
       - DATA_STALE: No recent updates
       - DEMURRAGE_RISK: Detention/Demurrage likely
       - CUSTOMS_ACTION: Customs hold or exam
       - CARRIER_ISSUE: Operational delay
       - DOCUMENTATION: Paperwork issue
       - PICKUP_READY: Ready for drayage

       ### attention.urgency
       - CRITICAL: Immediate action required
       - HIGH: < 48h to deadline
       - MEDIUM: < 7 days to deadline
       - LOW: Monitor
       - NONE: Normal

       ### attention.owner
       - OPERATIONS
       - CARRIER_LIAISON
       - CUSTOMS_BROKER
       - DOCUMENTATION
       - FINANCE
       - MANAGEMENT
       - null

       ## LOGIC
       - ATA present -> Status is likely ARRIVED, DISCHARGED, or later.
       - ATD present -> Status is likely DEPARTED or IN_TRANSIT.
       - Customs Hold -> Status is CUSTOMS_HOLD.
       - If dates contradict status (e.g., ATD exists but status is BOOKED), flagged as DATA_CONFLICT.

    
    RETURN JSON ONLY matching this structure:
    {
        "structured_metadata": {
            "health_score": 0,
            "demurrage_exposure": "string (Critical|High|Medium|Low|None)",
            "container_number": "string",
            "business_unit": "string",
            "carrier_scac": "string",
            "current_status": "string",
            "pol": "string",
            "pod": "string",
            "final_destination": "string",
            "booking_date": "ISO Date String or null",
            "etd": "ISO Date String or null",
            "atd": "ISO Date String or null",
            "eta": "ISO Date String or null",
            "ata": "ISO Date String or null",
            "last_free_day": "ISO Date String or null",
            "delivery_date": "ISO Date String or null",
            "days_in_transit": 0
        },
        "metaTables": {
            "identity": [
                {"label": "Container Number", "value": "string", "notes": "string"},
                {"label": "Master Bill (MBL)", "value": "string"},
                {"label": "Carrier", "value": "string", "notes": "string"},
                {"label": "Reference", "value": "string"}
            ],
            "routing": [
                {"label": "POL", "value": "string"},
                {"label": "POD", "value": "string"},
                {"label": "Final Dest", "value": "string"}
            ],
            "parties": [
                {"label": "Shipper", "value": "string"},
                {"label": "Consignee", "value": "string"},
                {"label": "Business Unit", "value": "string"}
            ],
            "timeline": [
                {"label": "Booking Date", "value": "string"},
                {"label": "ATD", "value": "string"},
                {"label": "ETA", "value": "string"},
                {"label": "ATA", "value": "string"},
                {"label": "Days in Transit", "value": "string"},
                {"label": "Demurrage Exposure", "value": "string"}
            ]
        },
        "classification": {
            "status": {
                "operational": "string (ENUM)",
                "confidence": "string (ENUM)",
                "reason": "string"
            },
            "attention": {
                "category": "string (ENUM)",
                "urgency": "string (ENUM)",
                "headline": "string or null",
                "owner": "string or null"
            }
        }
    }
    `;

    // 4. Call AI
    const responseText = await highThink(prompt);

    // 5. Parse Response
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
        responseText.match(/```\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

    let analysis: ContainerAnalysis;
    try {
        analysis = JSON.parse(jsonStr);
        // Ensure backward compatibility or defaults
        if (!analysis.dataSummary) analysis.dataSummary = { narrative: "No summary requested.", keyDates: [], financialSummary: "" };
    } catch (e) {
        console.error("Failed to parse AI response:", responseText);
        throw new Error("AI response parsing failed");
    }

    const timestamp = new Date(); // Use single timestamp for both
    analysis.timestamp = timestamp; // Add to result

    // 6. Persist
    await saveAssessment(containerNumber, {
        riskScore: 0, // No longer used
        riskFactors: [], // No longer used
        recommendations: [], // No longer used
        prediction: analysis.classification?.status.reason || "Processed",
        outcome: analysis.classification?.attention.headline || "Complete",
        timestamp: timestamp, // Match
        structured_metadata: analysis.structured_metadata, // CRITICAL: Pass this so it can be saved!
        metaTables: analysis.metaTables, // FIX: specific retention of metaTables
        dataSummary: analysis.dataSummary,
        unmappedInsights: analysis.unmappedInsights,
        dataChecks: analysis.dataChecks,
        classification: analysis.classification // NEW: Pass classification to persistence
    });

    return analysis;
}

export async function reauditContainer(containerNumber: string) {
    console.log(`[ReAudit] Starting for container: ${containerNumber}`);

    // 1. Fetch raw context
    const container = await prisma.container.findUnique({
        where: { containerNumber },
        include: { shipmentContainers: { include: { shipment: true } } }
    });

    if (!container || !container.metadata) throw new Error("Container or metadata not found");

    const meta = container.metadata as any;
    const rawRow = meta.raw?.originalRow;
    const rawHeaders = meta.raw?.originalHeaders;

    if (!rawRow || !rawHeaders) throw new Error("Raw data preservation missing for this record.");

    // 2. Re-Detect Schema (picks up new KnownFormats or AI Logic)
    // We treat this single row as the "sample"
    const mapping = await detectSchema(rawHeaders, [rawRow]);

    // 3. Re-Normalize
    const normalized = await normalizeData(rawRow, mapping);

    if (!normalized) throw new Error("Normalization failed during audit.");

    // 4. Persist Updates (Targeted update)
    await prisma.$transaction(async (tx) => {
        // Update Container
        await tx.container.update({
            where: { containerNumber },
            data: {
                // Update critical fields that might have been missed
                lastFreeDay: normalized.container.lastFreeDay,
                atd: normalized.container.atd,
                ata: normalized.container.ata,
                eta: normalized.container.eta,
                etd: normalized.container.etd,
                gateOutDate: normalized.container.gateOutDate,
                emptyReturnDate: normalized.container.emptyReturnDate,
                grossWeight: normalized.container.grossWeight,
                pol: normalized.container.pol,
                pod: normalized.container.pod,
                carrier: normalized.container.carrier,
                containerType: normalized.container.containerType,
                // Update Metadata with new mapping insights
                metadata: normalized.metadata as any,
                // Recalculate status/exceptions
                hasException: !normalized.container.lastFreeDay,
                exceptionType: !normalized.container.lastFreeDay ? 'Missing Last Free Day' : null
            }
        });

        // Update Related Shipment if linked
        if (normalized.shipment.reference) {
            // Find shipment ID via relation or reference
            await tx.shipment.updateMany({
                where: { shipmentReference: normalized.shipment.reference },
                data: {
                    businessUnit: normalized.shipment.businessUnit,
                    shipper: normalized.shipment.shipper,
                    consignee: normalized.shipment.consignee,
                    bookingDate: normalized.shipment.bookingDate,
                    shipmentVolume: normalized.shipment.volume,
                    totalWeight: normalized.shipment.weight,
                    totalPieces: normalized.shipment.pieces,
                    transportMode: normalized.shipment.transportMode,
                    freightCost: normalized.shipment.freightCost,
                    metadata: normalized.metadata as any
                }
            });
        }
    });

    // 5. Trigger new Analysis
    return await analyzeContainer(containerNumber);
}
