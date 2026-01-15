# AI Integration Overview (DeepSeek / Mission Oracle)

This document outlines the integration of **DeepSeek-V3** (via Azure AI Foundry) within the Shipment Tracker. The system uses a tiered approach ("High/Medium/Low Think") to balance reasoning depth and performance.

## AI Configuration (`lib/ai.ts`)

The application centralizes AI interaction via the OpenAI-compatible Azure AI client. three abstractions are exported:

-   **High Think** (Temp 0.2): Critical reasoning, JSON extraction, and detailed analysis.
-   **Medium Think** (Temp 0.4): Classification and pattern matching.
-   **Low Think** (Temp 0.7): Text hygiene and fuzzy matching.

## Integration Points

### 1. Mission Oracle & Status Classification
*   **Location**: `app/actions/analyzeContainer.ts`
*   **Model**: High Think
*   **Purpose**: The core "Truth Engine" of the platform. It analyzes conflicting data signals (e.g., ATD vs. DB Status) to determine the *actual* operational reality.
*   **Capabilities**:
    *   **Status Classification**: Deterministic evaluation of container status (Rules 1-5).
    *   **Risk Assessment**: Generates executive summaries and impact scores.
    *   **Data Validation**: Cross-checks "Official" DB data against "Raw" source data.
*   **Output**: A rich JSON object containing both the `classification` (Status, Confidence, Reason) and `riskFactors`.

### 2. Intelligent Schema Detection
*   **Location**: `agents/schema-detector.ts`
*   **Model**: High Think
*   **Purpose**: Automatically maps arbitrary carrier report headers to the `Container` schema.
*   **Workflow**:
    1.  Ingests raw headers and sample rows.
    2.  DeepSeek infers the column mapping (e.g., "Est Arr" -> `eta`).
    3.  Returns a JSON mapping object used for ingestion.

### 3. Data Normalization
*   **Location**: `agents/data-normalizer.ts`
*   **Model**: Low Think
*   **Purpose**: Standardizes diverse carrier values into system ENUMs.
*   **Workflow**:
    1.  Receives raw values (e.g., "Gate Out Full", "Dsch").
    2.  Maps them to canonical codes (`CGO`, `DIS`).
    3.  Ensures data consistency across all carriers.

### 4. Exception Classification
*   **Location**: `agents/exception-classifier.ts`
*   **Model**: Medium Think
*   **Purpose**: Identifies "Zombie" containers or subtle logic gaps.
*   **Workflow**:
    1.  Checks if a container is "stuck" (no updates vs. last free day).
    2.  Flags `hasException` boolean on the container record.

## Classification Logic

The **Mission Oracle** applies strict priority rules to determine status:
1.  **Dates > Status Codes**: If an `ATD` (Actual Departure) date exists, the container is `DEPARTED` or `IN_TRANSIT`, even if the carrier status says `BOOKED`.
2.  **Arrivals**: If `ATA` exists, it is `ARRIVED` or later.
3.  **Transit Time**: Calculates days in transit and flags overdue shipments based on route heuristics.

## Environment Setup
Requires `AZURE_AI_KEY`, `AZURE_AI_ENDPOINT`, and `AZURE_AI_MODEL`.
