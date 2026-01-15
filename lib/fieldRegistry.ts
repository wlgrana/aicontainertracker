export interface FieldDefinition {
    canonicalField: string;
    displayLabel: string;
    displaySection: 'header' | 'keyMetrics' | 'commercialProfile' | 'containerSpec' | 'timeline' | 'financial';
    formatType: 'text' | 'date' | 'currency' | 'number' | 'weight' | 'volume' | 'port' | 'reference';
    priority: 'critical' | 'high' | 'medium' | 'low';

    // Alternative field names that map to this canonical field
    aliases: string[];
}

export const FIELD_REGISTRY: FieldDefinition[] = [
    // === CRITICAL FIELDS ===
    {
        canonicalField: 'containerNumber',
        displayLabel: 'Container Number',
        displaySection: 'header',
        formatType: 'reference',
        priority: 'critical',
        aliases: ['container', 'container_number', 'container #', 'cntr', 'container no']
    },
    {
        canonicalField: 'lastFreeDay',
        displayLabel: 'Last Free Day',
        displaySection: 'keyMetrics',
        formatType: 'date',
        priority: 'critical',
        aliases: ['lfd', 'last free day', 'free time expiry', 'demurrage start']
    },

    // === HIGH PRIORITY - DATES ===
    {
        canonicalField: 'departureActual',
        displayLabel: 'Actual Departure',
        displaySection: 'containerSpec',
        formatType: 'date',
        priority: 'high',
        aliases: ['actual departure', 'atd', 'departure date', 'sailed date', 'vessel departure', 'actual departure (atd)']
    },
    {
        canonicalField: 'arrivalActual',
        displayLabel: 'Actual Arrival',
        displaySection: 'containerSpec',
        formatType: 'date',
        priority: 'high',
        aliases: ['actual arrival', 'ata', 'arrival date', 'confirmed arrival', 'confirmed destination port arrival', 'confirmed destination port arrival (ata)', 'confirmed destination (ata)']
    },
    {
        canonicalField: 'departureEstimated',
        displayLabel: 'Estimated Departure',
        displaySection: 'containerSpec',
        formatType: 'date',
        priority: 'high',
        aliases: ['estimated departure', 'etd', 'expected departure']
    },
    {
        canonicalField: 'arrivalEstimated',
        displayLabel: 'Estimated Arrival',
        displaySection: 'keyMetrics',
        formatType: 'date',
        priority: 'high',
        aliases: ['estimated arrival', 'eta', 'expected arrival']
    },
    {
        canonicalField: 'bookingDate',
        displayLabel: 'Booking Date',
        displaySection: 'containerSpec',
        formatType: 'date',
        priority: 'high',
        aliases: ['booking date', 'booked date', 'booking']
    },
    {
        canonicalField: 'gateoutDate',
        displayLabel: 'Gate Out Date',
        displaySection: 'timeline',
        formatType: 'date',
        priority: 'high',
        aliases: ['gateout', 'gate out', 'actual gateout', 'actual gateout date', 'gate out date']
    },
    {
        canonicalField: 'emptyReturnDate',
        displayLabel: 'Empty Return Date',
        displaySection: 'containerSpec',
        formatType: 'date',
        priority: 'medium',
        aliases: ['empty return', 'empty return date', 'container return']
    },

    // === HIGH PRIORITY - BUSINESS ===
    {
        canonicalField: 'businessUnit',
        displayLabel: 'Business Unit',
        displaySection: 'commercialProfile',
        formatType: 'text',
        priority: 'high',
        aliases: ['business unit', 'bu', 'business_unit', 'dept', 'department', 'division']
    },
    {
        canonicalField: 'shipper',
        displayLabel: 'Shipper',
        displaySection: 'commercialProfile',
        formatType: 'text',
        priority: 'high',
        aliases: ['shipper', 'shipper name', 'shipper\'s full name', 'shippers full name', 'ship from', 'shipper full name']
    },
    {
        canonicalField: 'consignee',
        displayLabel: 'Consignee',
        displaySection: 'commercialProfile',
        formatType: 'text',
        priority: 'high',
        aliases: ['consignee', 'consignee name', 'consigne\'s full name', 'consignees full name', 'consignee\'s full name (ship to)', 'ship to name', 'ship to']
    },

    // === HIGH PRIORITY - LOCATIONS ===
    {
        canonicalField: 'originPort',
        displayLabel: 'Origin Port',
        displaySection: 'containerSpec',
        formatType: 'port',
        priority: 'high',
        aliases: ['origin port', 'port of loading', 'pol', 'departure port', 'load port', 'export departure port']
    },
    {
        canonicalField: 'destinationPort',
        displayLabel: 'Destination Port',
        displaySection: 'containerSpec',
        formatType: 'port',
        priority: 'high',
        aliases: ['destination port', 'port of destination', 'port of discharge', 'pod', 'discharge port']
    },
    {
        canonicalField: 'unladingPort',
        displayLabel: 'Port of Unlading',
        displaySection: 'containerSpec',
        formatType: 'port',
        priority: 'high',
        aliases: ['port of unlading', 'unlading port', 'discharge port']
    },
    {
        canonicalField: 'destinationCity',
        displayLabel: 'Destination City',
        displaySection: 'commercialProfile',
        formatType: 'text',
        priority: 'high',
        aliases: ['ship to city', 'destination city', 'delivery city', 'final destination', 'dest city']
    },

    // === MEDIUM PRIORITY - FINANCIAL ===
    {
        canonicalField: 'freightCost',
        displayLabel: 'Freight Cost',
        displaySection: 'financial',
        formatType: 'currency',
        priority: 'medium',
        aliases: ['freight cost', 'ocean freight', 'ocean freight costs', 'shipping cost', 'freight charges', 'ocean cost']
    },

    // === MEDIUM PRIORITY - CARGO ===
    {
        canonicalField: 'volume',
        displayLabel: 'Volume',
        displaySection: 'commercialProfile',
        formatType: 'volume',
        priority: 'medium',
        aliases: ['volume', 'shipment volume', 'cbm', 'm3', 'cubic', 'shipment volume (m3)']
    },
    {
        canonicalField: 'weight',
        displayLabel: 'Weight',
        displaySection: 'commercialProfile',
        formatType: 'weight',
        priority: 'medium',
        aliases: ['weight', 'shipment weight', 'actual weight', 'gross weight', 'kg', 'shipment actual weight', 'shipment actual weight (kg\'s)', 'shipment actual weight (kg)']
    },
    {
        canonicalField: 'pieces',
        displayLabel: 'Pieces',
        displaySection: 'commercialProfile',
        formatType: 'number',
        priority: 'medium',
        aliases: ['pieces', 'shipment pieces', 'pallets', 'cartons', 'piece count', 'shipment pieces (pallets)']
    },

    // === MEDIUM PRIORITY - REFERENCES ===
    {
        canonicalField: 'houseBill',
        displayLabel: 'House Bill',
        displaySection: 'commercialProfile',
        formatType: 'reference',
        priority: 'medium',
        aliases: ['house bill', 'hbl', 'shipment bill', 'hawb', 'shipment / house bill']
    },
    {
        canonicalField: 'masterBill',
        displayLabel: 'Master Bill',
        displaySection: 'commercialProfile',
        formatType: 'reference',
        priority: 'medium',
        aliases: ['master bill', 'mbl', 'master bill number', 'mawb', 'masterbillnumber']
    },
    {
        canonicalField: 'carrierCode',
        displayLabel: 'Carrier Code',
        displaySection: 'containerSpec',
        formatType: 'text',
        priority: 'medium',
        aliases: ['carrier code', 'scac', 'carrier', 'carrier code (scac)', 'carrier code (scac) - shipping line']
    },

    // === LOW PRIORITY - CONTAINER DETAILS ===
    {
        canonicalField: 'containerType',
        displayLabel: 'Container Type',
        displaySection: 'containerSpec',
        formatType: 'text',
        priority: 'low',
        aliases: ['container type', 'type', 'equipment type', 'container type (20gp,40gp,40hc)']
    },
    {
        canonicalField: 'transportMode',
        displayLabel: 'Transport Mode',
        displaySection: 'containerSpec',
        formatType: 'text',
        priority: 'low',
        aliases: ['transport mode', 'mode', 'shipping mode', 'transport mode (ocean, air, ground)']
    },
    {
        canonicalField: 'shippingType',
        displayLabel: 'Shipping Type',
        displaySection: 'containerSpec',
        formatType: 'text',
        priority: 'low',
        aliases: ['shipping type', 'fcl', 'lcl', 'shipping type (fcl, lcl, air)']
    },
    {
        canonicalField: 'notes',
        displayLabel: 'Notes',
        displaySection: 'commercialProfile',
        formatType: 'text',
        priority: 'low',
        aliases: ['notes', 'remarks', 'comments', 'reference', 'memo']
    }
];

// Helper to find field definition by any name
export function findFieldDefinition(fieldName: string): FieldDefinition | null {
    const nameLower = fieldName.toLowerCase().trim();

    return FIELD_REGISTRY.find(def =>
        def.canonicalField.toLowerCase() === nameLower ||
        def.displayLabel.toLowerCase() === nameLower ||
        def.aliases.some(alias =>
            alias.toLowerCase() === nameLower ||
            nameLower.includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(nameLower)
        )
    ) || null;
}
