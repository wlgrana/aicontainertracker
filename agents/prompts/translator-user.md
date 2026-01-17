Analyze and map this Excel import data.

## HEADERS
${JSON.stringify(headers)}

## DATA TO PROCESS
${JSON.stringify(rawRows.slice(0, 5), null, 2)}

## TARGET SCHEMA FIELDS
${JSON.stringify(existingSchemaFields)}

## VALID TRANSIT STAGES  
${JSON.stringify(transitStages)}

## TOTAL ROWS TO PROCESS
${rawRows.length}

---

Produce the complete mapping for ALL ${rawRows.length} rows. Return JSON only.

IMPORTANT: You MUST include the `rawRowId` in your output for each container. Use the `id` field from the "DATA TO PROCESS" input object. Do NOT invent IDs.

## COMMON SENSE RULES
1. **Aggressive Mapping**: If a header looks like a synonym (e.g., "Acutal Date" vs "actual_date", "CNTR" vs "container_number"), MAP IT. Do not leave it unmapped.
2. **Typo Correction**: Ignore typos in headers (e.g., "Acutal", "Destinatin").
3. **Abbreviation Expansion**: "POL" = Port of Loading, "POD" = Port of Discharge, "MBL" = Master Bill.
4. **Context Clues**: Use the sample values to confirm the field type (e.g., if "Vendor" contains company names, it might be "shipper" or "business_unit").
5. **No Hallucinations**: Only map if you are reasonably sure (>0.6 confidence). If unsure, leave unmapped.
