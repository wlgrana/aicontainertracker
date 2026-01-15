export interface KnownFormatDefinition {
    id: string;
    name: string;
    description: string;

    // Headers that MUST exist to match this format (case-insensitive)
    requiredHeaders: string[];

    // Direct column mapping: originalHeader -> canonicalField
    columnMapping: Record<string, string>;

    // Optional: specific transformations for this format
    transformations?: Record<string, (value: any) => any>;
}

export const KNOWN_FORMATS: KnownFormatDefinition[] = [
    {
        id: 'standard_container_export_v1',
        name: 'Standard Container Export',
        description: 'Common format with Business Unit, Shipment details, and full logistics data',

        requiredHeaders: [
            'Business Unit',
            'ContainerNumber',
            'Shipper\'s Full Name',
            'Ship to City',
            'Actual Departure' // Softened constraint to match both "Actual Departure (ATD)" and "Actual Departure Date"
        ],

        columnMapping: {
            // Business & Reference
            'Business Unit': 'business_unit',
            'BusinessUnit': 'business_unit',
            'Shipment / House Bill': 'shipment_reference',
            'House Bill': 'shipment_reference',
            'MasterBillNumber': 'mbl',
            'Master Bill': 'mbl',
            'ContainerNumber': 'container_number',
            'Container #': 'container_number',
            'Notes': 'notes',

            // Container Details
            'Container Type (20GP,40GP,40HC)': 'container_type',
            'Container Type (20GP, 40HC, 40HQ)': 'container_type', // Variant
            'Container Type': 'container_type',
            'Transport Mode (Ocean, Air, Ground)': 'transport_mode',
            'Shipping Type (FCL, LCL, Air)': 'shipping_type',
            'Carrier Code (SCAC) - shipping line': 'carrier',
            'Carrier Code (SCAC) - Shipping line': 'carrier', // Casing definition
            'Carrier': 'carrier',

            // Parties
            'Shipper\'s Full Name': 'shipper',
            'Consignee\'s Full Name (Ship To)': 'consignee',
            'Consignee\'s Full Name': 'consignee',
            'Consigne\'s Full Name (Ship To)': 'consignee', // Handle typo variant

            // Locations
            'Ship to City': 'destination_city',
            'Export Departure Port': 'pol',
            'Port of Unlading': 'pod',
            'Port of Destination': 'pod',

            // Dates
            'Booking Date': 'booking_date',
            'Actual Departure (ATD)': 'departure_date', // START FIX: Align with normalizer (departure_date)
            'Actual Departure Date': 'departure_date',  // Variant
            'Confirmed Destination Port Arrival (ATA)': 'port_arrival_date', // Align with normalizer (port_arrival_date)
            'Confirmed Destination (ATA)': 'port_arrival_date',
            'Actual Gateout Date': 'gate_out_date',
            'Empty Return Date': 'empty_return_date',
            'Last Free Day': 'last_free_day',

            // Cargo Details
            'Shipment Pieces (Pallets)': 'pieces',
            'Shipment Volume (M3)': 'volume',
            'Shipment Actual Weight (KG\'s)': 'weight',
            'Shipment Actual Weight (KG)': 'weight', // Variant
            'Shipment Actual Weight (KGS)': 'weight', // Variant found in file

            // Financial
            'OCEAN FREIGHT COSTS': 'freight_cost',
            'Ocean Freight Costs': 'freight_cost'
        },

        transformations: {
            'booking_date': (val) => parseDate(val),
            'departure_date': (val) => parseDate(val),
            'port_arrival_date': (val) => parseDate(val),
            'gate_out_date': (val) => parseDate(val),
            'empty_return_date': (val) => parseDate(val),
            'last_free_day': (val) => parseDate(val),
            'freight_cost': (val) => parseCurrency(val),
            'weight': (val) => parseNumber(val),
            'volume': (val) => parseNumber(val),
            'pieces': (val) => parseNumber(val)
        }
    }
];

// Helper functions
function parseDate(value: any): string | null {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
    } catch {
        return null;
    }
}

function parseCurrency(value: any): number | null {
    if (!value) return null;
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
}

function parseNumber(value: any): number | null {
    if (!value) return null;
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
}
