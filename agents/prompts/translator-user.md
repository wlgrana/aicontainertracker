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
