
import * as fs from 'fs';
import yaml from 'yaml';

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

async function run() {
    const rawHeaders = ["SIZE", "ETD POL", "ETA POD", "POD", "CNTR AVAIL", "OGF DATE", "TRUCKER APPT", "EMPTY AVAIL DATE"];
    const ontology = yaml.parse(await fs.promises.readFile('agents/dictionaries/container_ontology.yml', 'utf-8'));

    console.log("Loaded Ontology. Checking mapping...");
    const allFields = { ...ontology.required_fields, ...ontology.optional_fields };

    for (const header of rawHeaders) {
        const normalized = normalizeHeader(header);
        console.log(`\nHeader: "${header}" (norm: ${normalized})`);

        let found = false;
        for (const [key, def] of Object.entries(allFields) as [string, any][]) {
            const synonyms = def.header_synonyms || [];

            let flatSynonyms: string[] = [];
            if (Array.isArray(synonyms)) {
                synonyms.forEach((x: any) => {
                    if (typeof x === 'string') flatSynonyms.push(x);
                    else if (typeof x === 'object') flatSynonyms.push(...Object.values(x).flat() as string[]);
                });
            } else if (typeof synonyms === 'object') {
                // handle map case if present
                flatSynonyms = Object.values(synonyms).flat() as string[];
            }

            // Debug specific synonyms for problematic fields
            if (header === "ETD POL" && key === "etd") console.log("  Debug ETD Synonyms:", flatSynonyms);

            const match = flatSynonyms.find(s => normalizeHeader(s) === normalized);
            if (match) {
                console.log(`  MATCH: ${key} (synonym: ${match})`);
                found = true;
            }
        }
        if (!found) console.log("  NO MATCH FOUND");
    }
}
run();
