# Manual Mapping & Translator Review

## Overview

The **Translator Review** step is a "Human-in-the-Loop" checkpoint that allows users to verify and correct the AI's schema detection before any data is persisted. This ensures high data quality and allows for handling unique or unrecognized file formats.

## The Workflow

1.  **Archivist (Step 1)**: Ingests the file.
2.  **Translator (Step 2)**: AI attempts to map source headers (e.g., "Est. Dep") to database fields (e.g., `etd`).
3.  **Review (Step 2.5 - NEW)**: **The pipeline PAUSES explicitly.**
4.  **User Action**: The user reviews the mapped and unmapped fields.
5.  **Proceed**: The user clicks "Confirm & Proceed," sending the corrected map to the Auditor.

## The Interface

### 1. Mapped Fields Section
Shows the high-confidence matches found by the AI.
- **Source**: The header from your Excel file.
- **Target**: The database field it will populate.
- **Action**: You can change the target using the dropdown if the AI made a mistake.

### 2. Unmapped Fields Section
Shows headers that the AI could not identify.
- **Critical Control**: You can manually assign these "Left Over" columns to a database field.
- **Example**: If you have a column "NVOCC Name", the AI might miss it. You can manually select "Forwarder" from the dropdown to ensure this data is saved.

## Special Field: Forwarder

The `forwarder` field is a key metadata attributes for containers.

- **Storage**: Unlike other fields that might default to `null`, the Forwarder is now stored directly on the `Container` record.
- **Mapping**: You can map any source column (e.g., "Forwarder", "Agent", "NVOCC") to the `forwarder` target field.
- **Dashboard**: Mapped forwarders appear in the "Forwarder" column of the Master Inventory Ledger and can be filtered.

## Best Practices

- **Review Low Confidence**: Always verify mappings flagged with a low confidence score.
- **Check Specific Dates**: Ensure `etd`, `atd`, `eta`, and `ata` are mapped to the correct date columns.
- **Map Forwarder**: If your data contains forwarder info, always map it manually if the AI misses it.
