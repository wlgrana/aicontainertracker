
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

async function main() {
    const ontologyPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');
    const fileContent = fs.readFileSync(ontologyPath, 'utf-8');
    const ontology = yaml.parse(fileContent);

    let promoted = 0;
    const newPending: any[] = [];

    if (ontology.pending_fields) {
        console.log(`Checking ${ontology.pending_fields.length} pending fields...`);

        for (const p of ontology.pending_fields) {
            const fieldDef = ontology.required_fields?.[p.canonicalField]
                || ontology.optional_fields?.[p.canonicalField];

            // Use field threshold OR 0.90 default
            const threshold = fieldDef?.confidence_threshold || 0.90;

            console.log(`Checking "${p.unmappedHeader}" (${p.confidence}) against threshold ${threshold}...`);

            if (p.confidence >= threshold) {
                // PROMOTE
                if (fieldDef) {
                    if (!fieldDef.header_synonyms) fieldDef.header_synonyms = [];

                    if (Array.isArray(fieldDef.header_synonyms)) {
                        if (!fieldDef.header_synonyms.includes(p.unmappedHeader)) {
                            fieldDef.header_synonyms.push(p.unmappedHeader);
                            promoted++;
                            console.log(`✅ Promoted: ${p.unmappedHeader} -> ${p.canonicalField}`);
                        } else {
                            console.log(`⚠️  Already exists: ${p.unmappedHeader}`);
                        }
                    }
                }
            } else {
                newPending.push(p); // Keep pending
            }
        }

        ontology.pending_fields = newPending;
    }

    if (promoted > 0) {
        fs.writeFileSync(ontologyPath, yaml.stringify(ontology));
        console.log(`\nSaved ${promoted} promotions to ontology.`);
    } else {
        console.log("\nNo changes made.");
    }
}

main();
