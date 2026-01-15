Audit this container import. Compare raw data against the database row.

## CONTAINER NUMBER
${containerNumber}

## RAW DATA (from Excel)
${JSON.stringify(rawData.raw.originalRow, null, 2)}

## MAPPING USED
${JSON.stringify(rawData.mapping, null, 2)}

## DATABASE ROW (current state)
${JSON.stringify(databaseRow, null, 2)}

---

Check every field. Find what was LOST, what is WRONG, and what is UNMAPPED.
Generate corrections for all issues.

Return JSON only.
