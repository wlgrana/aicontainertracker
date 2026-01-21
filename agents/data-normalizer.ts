import { highThink, lowThink } from '@/lib/ai';
import { SchemaMapping } from './schema-detector';

interface EnhancedContainerMetadata {
    raw: {
        originalRow: Record<string, any>;
        originalHeaders: string[];
    };
    mapping: {
        mappedFields: Record<string, string>;
        unmappedFields: {
            [originalHeader: string]: {
                rawValue: any;
                potentialMeaning?: string;
                suggestedCanonicalField?: string;
                confidenceScore?: number;
            }
        };
    };
    // importContext is handled by the caller/route or implicitly by the record's relation to ImportLog
}

interface NormalizedData {
    shipment: {
        reference?: string;
        businessUnit?: string;
        transportMode?: string;
        freightCost?: number;
        volume?: number;
        bookingDate?: string; // ISO

        destinationCity?: string;
        shipper?: string;
        consignee?: string;
        mbl?: string;
        pol?: string;
        pod?: string;
        pieces?: number;
        weight?: number;
        notes?: string;
    };
    container: {
        containerNumber: string;
        containerType?: string;
        carrier?: string;
        mbl?: string;
        pol?: string;
        pod?: string;
        atd?: string;
        ata?: string;
        eta?: string;
        etd?: string;
        lastFreeDay?: string;
        grossWeight?: number;
        gateOutDate?: string; // ISO
        emptyReturnDate?: string; // ISO

        // New Logistics Metrics
        daysInTransit?: number;
        healthScore?: number;
        aiOperationalStatus?: string;
        aiAttentionCategory?: string;
    };
    event: {
        stageName: string; // Must match TransitStage.stageName
        eventDateTime: string; // ISO
        location?: string;
    };
    metadata: EnhancedContainerMetadata;
}

const STAGE_CODES = [
    "BOOK", "CEP", "CGI", "STUF", "LOA", "DEP", "TS1", "TSD", "TSL", "TS1D",
    "ARR", "DIS", "INSP", "CUS", "REL", "AVL", "CGO", "OFD", "DEL", "STRP", "RET"
];

// Fields that are critical for minimum viable record creation
const REQUIRED_FIELDS = ["container_number", "event_status", "event_date"];

export async function normalizeData(row: any, mapping: SchemaMapping): Promise<NormalizedData | null> {
    // 1. Extract raw values based on mapping
    const getVal = (field: string) => row[mapping.columnMapping[field]];

    let rawContainer = getVal('container_number')?.toString() || "";
    // Standardization: Remove non-alphanumeric and uppercase
    rawContainer = rawContainer.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!rawContainer || rawContainer.length < 4) return null;

    const rawStatus = getVal('event_status')?.toString() || "";
    const rawDate = getVal('event_date');

    // Helper to parse dates
    const parseDate = (val: any): string | undefined => {
        if (!val) return undefined;

        let d: Date;
        if (typeof val === 'number') {
            // Excel serial date handling
            // Excel base date: Dec 30 1899 usually (25569 days offset from Unix epoch)
            // If number is small (e.g. < 10000), it's likely not a date (or very old), but let's assume > 20000 (~1954)
            if (val > 20000) {
                d = new Date(Math.round((val - 25569) * 86400 * 1000));
            } else {
                d = new Date(val); // Treat as timestamp ms (will result in 1970 for small nums, but correct for timestamps)
            }
        } else {
            d = new Date(val);
        }

        // Heuristic: Filter out epoch start (1970) or very old dates which often mean 0/Empty in Excel
        if (isNaN(d.getTime()) || d.getFullYear() < 2000) {
            return undefined;
        }

        return d.toISOString();
    };

    // Helper to parse numbers
    const parseNum = (val: any): number | undefined => {
        if (!val) return undefined;
        // Handle "$1,234.50" or "1,200.00"
        const clean = val.toString().replace(/[^0-9.]/g, '');
        const n = parseFloat(clean);
        return isNaN(n) ? undefined : n;
    };

    // Extract critical dates early for logic overrides
    const gateOutVal = parseDate(getVal('gate_out_date'));
    const emptyReturnVal = parseDate(getVal('empty_return_date'));

    // 2. Identify Metadata Categories (Mapped, Unmapped)
    const mappedHeaders = new Set(Object.values(mapping.columnMapping));
    const allHeaders = Object.keys(row);

    const unmappedFields: EnhancedContainerMetadata['mapping']['unmappedFields'] = {};

    allHeaders.forEach(header => {
        if (!mappedHeaders.has(header)) {
            // Check if we have AI insights from the schema detector
            const insight = mapping.unmappedFields?.[header];

            unmappedFields[header] = {
                rawValue: row[header],
                potentialMeaning: insight?.potentialMeaning || "Unknown - No AI insight available",
                suggestedCanonicalField: insight?.suggestedCanonicalField,
                confidenceScore: insight?.confidenceScore
            };
        }
    });

    // 3. Use AI (Low Think) to normalize Status -> Stage code if needed
    let stageName = 'DIS'; // Default fallback

    const normalizeStatus = async (status: string) => {
        // Check cache if provided
        if (mapping.statusCache && mapping.statusCache.has(status)) {
            return mapping.statusCache.get(status)!;
        }

        let code = 'DIS';
        if (!process.env.AZURE_AI_KEY) {
            const low = status.toLowerCase();
            if (low.includes('gate') || low.includes('out')) code = 'CGO';
            else if (low.includes('disch') || low.includes('arr')) code = 'DIS';
            else if (low.includes('book')) code = 'BOOK';
            else if (low.includes('del') || low.includes('ogf')) code = 'DEL';
        } else {
            try {
                const prompt = `
                Map this logistics status text "${status}" to EXACTLY one of these standard codes:
                ${STAGE_CODES.join(", ")}.
                Return ONLY the code.
                `;
                const text = await lowThink(prompt);
                code = text.trim().toUpperCase();

                // Clean potential formatting like "CODE (Explanation)" -> CODE
                code = code.split(' ')[0].replace(/[^A-Z0-9]/g, '');

                if (!STAGE_CODES.includes(code)) {
                    // Fallback check
                    if (status.toLowerCase().includes('gate')) code = 'CGO';
                    else if (status.toLowerCase().includes('disch')) code = 'DIS';
                    else code = 'DIS'; // Safe default
                }
            } catch (e) {
                console.warn("AI Normalization failed, using fallback logic");
                if (status.toLowerCase().includes('gate')) code = 'CGO';
                else if (status.toLowerCase().includes('disch')) code = 'DIS';
            }
        }

        // Update cache
        if (mapping.statusCache) {
            mapping.statusCache.set(status, code);
        }
        return code;
    };

    stageName = await normalizeStatus(rawStatus);

    // --- LOGIC INJECTION: Date-Based Overrides ---
    // 3b. Delivery Date Heuristic (Force DEL if present)
    // Scan for "Actual Delivery" or "Delivery Date" even if not standard mapped
    let deliveryDateVal: string | undefined;
    const deliveryKey = allHeaders.find(h => {
        const lower = h.toLowerCase();
        return (lower.includes('actual') && lower.includes('del')) || lower === 'delivery date' || lower === 'date delivered';
    });
    if (deliveryKey) {
        deliveryDateVal = parseDate(row[deliveryKey]);
    }

    if (deliveryDateVal) {
        stageName = 'DEL';
    } else if (emptyReturnVal) {
        stageName = 'RET';
    } else if (gateOutVal) {
        if (!['DEL', 'RET', 'STRP'].includes(stageName)) {
            stageName = 'CGO';
        }
    }

    // 4. Date normalization
    let eventDate = new Date();
    if (rawDate) {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
            eventDate = parsedDate;
        }
    }

    // Construct the Enhanced Metadata
    const metadata: EnhancedContainerMetadata = {
        raw: {
            originalRow: row,
            originalHeaders: allHeaders
        },
        mapping: {
            mappedFields: mapping.columnMapping,
            unmappedFields: unmappedFields
        }
    };

    // --- LOGIC INJECTION: Calculate AI Metrics ---
    const now = new Date();
    let daysInTransit = 0;

    // Calculate Days In Transit (from ATD/ETD to Delivery or Now)
    const departureDate = parseDate(getVal('departure_date')) || parseDate(getVal('etd'));
    if (departureDate) {
        const start = new Date(departureDate);
        // For delivered containers, calculate to delivery date; otherwise to now
        const endDate = deliveryDateVal ? new Date(deliveryDateVal) : now;
        const diffTime = Math.abs(endDate.getTime() - start.getTime());
        daysInTransit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate Health Score (Simple Logic)
    let healthScore = 100;
    const lfd = parseDate(getVal('last_free_day'));
    if (lfd) {
        const lfdDate = new Date(lfd);
        // Only penalize if past LFD AND not delivered AND not returned
        if (now > lfdDate && !deliveryDateVal && !emptyReturnVal) {
            healthScore -= 50; // Critical hit if past LFD and not delivered/returned
        } else if ((lfdDate.getTime() - now.getTime()) < (2 * 24 * 60 * 60 * 1000) && !deliveryDateVal && !emptyReturnVal) {
            healthScore -= 20; // Risk if < 2 days and not delivered/returned
        }
    } else if (!deliveryDateVal && !emptyReturnVal) {
        // Only penalize for missing LFD if container is still active
        healthScore -= 10;
    }

    // Determine AI Standard Status - Complete mapping for all stage codes
    let aiStatus = 'In Transit'; // Default
    if (stageName === 'DEL' || deliveryDateVal) aiStatus = 'Delivered';
    else if (stageName === 'RET' || emptyReturnVal) aiStatus = 'Completed';
    else if (stageName === 'CGO') aiStatus = 'Gated Out';
    else if (stageName === 'OFD') aiStatus = 'Out for Delivery';
    else if (stageName === 'STRP') aiStatus = 'Empty Return';
    else if (['REL', 'AVL'].includes(stageName)) aiStatus = 'Available for Pickup';
    else if (['DIS', 'INSP'].includes(stageName)) aiStatus = 'Discharged';
    else if (stageName === 'ARR' || parseDate(getVal('port_arrival_date'))) aiStatus = 'Arrived at Port';
    else if (stageName === 'CUS') aiStatus = 'Customs Hold';
    else if (['BOOK', 'CEP', 'CGI', 'STUF', 'LOA'].includes(stageName)) aiStatus = 'Booked';
    else if (['DEP', 'TS1', 'TSD', 'TSL', 'TS1D'].includes(stageName)) aiStatus = 'In Transit';

    // Determine Attention Category
    let attention = 'Routine';
    if (deliveryDateVal || emptyReturnVal) attention = 'Resolved';
    else if (healthScore < 60) attention = 'Critical';
    else if (healthScore < 90) attention = 'Warning';



    return {
        shipment: {
            reference: getVal('shipment_reference')?.toString(),
            businessUnit: getVal('business_unit')?.toString(),
            transportMode: getVal('transport_mode')?.toString(),
            freightCost: parseNum(getVal('freight_cost')),
            volume: parseNum(getVal('volume')),
            bookingDate: parseDate(getVal('booking_date')),

            destinationCity: getVal('destination_city')?.toString(),
            shipper: getVal('shipper')?.toString(),
            consignee: getVal('consignee')?.toString(),
            mbl: getVal('mbl')?.toString(),
            pol: getVal('pol')?.toString(),
            pod: getVal('pod')?.toString(),
            pieces: parseNum(getVal('pieces')),
            weight: parseNum(getVal('weight')),
            notes: getVal('notes')?.toString()
        },
        container: {
            containerNumber: rawContainer,
            containerType: getVal('container_type')?.toString(),
            carrier: getVal('carrier')?.toString(),
            mbl: getVal('mbl')?.toString(),
            pol: getVal('pol')?.toString(),
            pod: getVal('pod')?.toString(),
            atd: parseDate(getVal('departure_date')),
            ata: parseDate(getVal('port_arrival_date')),
            eta: parseDate(getVal('eta')),
            etd: parseDate(getVal('etd')),
            lastFreeDay: parseDate(getVal('last_free_day')),
            grossWeight: parseNum(getVal('weight')),
            gateOutDate: parseDate(getVal('gate_out_date')),
            emptyReturnDate: parseDate(getVal('empty_return_date')),

            // New Fields
            daysInTransit: daysInTransit,
            healthScore: healthScore,
            aiOperationalStatus: aiStatus,
            aiAttentionCategory: attention
        },
        event: {
            stageName,
            eventDateTime: eventDate.toISOString(),
            location: getVal('event_location')?.toString()
        },
        metadata: metadata
    };
}
