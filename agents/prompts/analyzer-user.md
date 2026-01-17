# Analysis Request

## 1. Canonical Schema
The following fields are defined in our system:
${canonicalSchema}

## 2. Unmapped Items to Analyze
I have found the following headers that were NOT mapped in recent imports.
Please analyze them and suggest mappings.

```json
${unmappedItems}
```

## 3. Existing Synonyms (Reference)
${existingSynonyms}

---

## Instructions
Analyze the Unmapped Items. For each item, check if it matches any Canonical Field based on the header name and the sample values provided.
Return your suggestions in the specified JSON format.
