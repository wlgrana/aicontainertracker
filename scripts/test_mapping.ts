
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

// --- Replicating Logic from agents/translator.ts ---

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBestMatch(header: string, allFields: any): string | null {
    const normalized = normalizeHeader(header);

    // 1. Exact Name (Check against keys)
    if (allFields[header] || allFields[normalized]) return allFields[header] ? header : normalized;

    // 2. Synonyms
    for (const [fieldKey, fieldDef] of Object.entries(allFields) as [string, any][]) {
        // Check against key name itself
        if (normalizeHeader(fieldKey) === normalized) return fieldKey;

        const synonyms = fieldDef.header_synonyms || [];
        let flatSynonyms: string[] = [];

        if (Array.isArray(synonyms)) {
            synonyms.forEach((x: any) => {
                if (typeof x === 'string') flatSynonyms.push(x);
                else if (typeof x === 'object') flatSynonyms.push(...Object.values(x).flat() as string[]);
            });
        } else if (typeof synonyms === 'object') {
            flatSynonyms = Object.values(synonyms).flat() as string[];
        }

        if (flatSynonyms.some(s => normalizeHeader(s) === normalized)) return fieldKey;
    }
    return null;
}

async function runTest() {
    const headers = [
        "Business Unit",
        "Shipment / House Bill",
        "MasterBillNumber",
        "ContainerNumber",
        "Container Type (20GP,40GP,40HC)",
        "Transport Mode (Ocean, Air, Ground)",
        "Shipping Type (FCL, LCL, Air)",
        "Shipper's Full Name",
        "Consigne's Full Name (Ship To)",
        "Ship to City",
        "Booking Date",
        "Actual Departure (ATD)",
        "Confirmed Destination Port Arrival (ATA)",
        "Acutal Gateout Date",
        "Export Departure Port",
        "Port of Unlading",
        "Port of Destination",
        "Carrier Code (SCAC) - shipping line",
        "Shipment Pieces (Pallets)",
        "Shipment Volume (M3)",
        "Shipment Actual Weight (KG's)",
        "OCEAN FREIGHT COSTS",
        "Notes",
        "EReturn Date"
    ];

    console.log("Loading Ontology...");
    const ontPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');
    const ONTOLOGY = yaml.parse(await fs.promises.readFile(ontPath, 'utf-8'));
    const allFields = { ...ONTOLOGY.required_fields, ...ONTOLOGY.optional_fields };

    console.log("\n--- TESTING HEADERS AGAINST DICTIONARY ---\n");

    let matchCount = 0;
    for (const h of headers) {
        const match = findBestMatch(h, allFields);
        const status = match ? `✅ MATCH -> ${match}` : `❌ NO MATCH`;
        console.log(`[${h}]  ==>  ${status}`);
        if (match) matchCount++;
    }

    console.log(`\nScore: ${matchCount} / ${headers.length} mapped.`);
}

runTest();
