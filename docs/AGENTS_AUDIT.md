# Agent & Prompt Audit

This document identifies all AI agents, their defining prompts, and their invocation processes within the Shipment Tracker application.

> **[2026-01-15 UPDATE]**: The architecture is transitioning to a 4-Agent System (Archivist, Translator, Auditor, Oracle Chat). Legacy agents are marked below.

## New 4-Agent Architecture

### 1. Archivist (The "Librarian")
*   **File**: `agents/archivist.ts`
*   **Function**: `archiveExcelFile(input)`
*   **Role**: **Programmatic (No AI)**. Ingests raw Excel files, captures every row as-is ("Zero Data Loss"), and creates the initial `ImportLog`. Ensures full traceability.
*   **Invocation**: `lib/import-orchestrator.ts` (Step 1).
*   **Logging**: Retroactively logged to `AgentProcessingLog` (Stage: `ARCHIVIST`) during persistence.
*   **Model**: N/A (Pure TypeScript).

### 2. Translator (The "Mapper")
*   **File**: `agents/translator.ts`
*   **Function**: `runTranslator(input)`
*   **Role**: **AI (Batch)**. Analyzes headers to detect schema, performs data transformation (e.g., Excel dates), generates normalized `Container` records, and derives `ContainerEvent` history.
*   **Invocation**: `lib/import-orchestrator.ts` (Step 2).
*   **System Prompt**: `agents/prompts/translator-system.md`
*   **Logging**: Retroactively logged to `AgentProcessingLog` (Stage: `TRANSLATOR`) with field-level confidence scores and dictionary versions.
*   **Model**: High Reasoning (e.g., GPT-4o / DeepSeek via Azure).

#### System Prompt Excerpt
```markdown
You are the Translator Agent for a logistics shipment tracking system. Your job is to map raw Excel data to a structured database schema and generate container events.

## YOUR RESPONSIBILITIES
1. **Schema Detection**: Analyze headers to identify the data source (forwarder/carrier) and create field mappings
2. **Data Transformation**: Convert raw values to proper types (especially Excel serial dates)
3. **Event Generation**: Extract milestone events from date fields and status codes
4. **Confidence Scoring**: Rate each mapping's reliability
...
```

### 3. Auditor (The "Quality Gate" & "Reconciler")
*   **File**: `agents/auditor.ts`
*   **Function**: `runAuditor(input)`
*   **Role**: **AI (Pre-Persistence Verification + Self-Healing)**. 
    1.  **Quality Gate**: Runs *before* database import (Step 3). Simulates the transformation in-memory for a **1-Row Fast Check**.
    2.  **Self-Healing**: If it detects high-confidence unmapped fields (e.g., missed "ETD"), it **automatically patches** the transformation artifact (`temp_translation.json`) before the Importer runs.
    3.  **Audit**: Verifies that no data will be lost during the actual commit.
*   **Invocation**: `scripts/step3_auditor.ts` (Step 3) and `lib/import-orchestrator.ts` (Post-Persistence check).
*   **System Prompt**: `agents/prompts/auditor-system.md`
*   **Logging**: Logs findings to `AgentProcessingLog`. In "Dry Run" mode (Step 3), logging is skipped to avoid foreign key errors.
*   **Resilience**: 
    *   **Timeout**: 30 seconds per container (increased from 15s).
    *   **Retries**: Exponential backoff (up to 2 retries) for transient AI errors.
    *   **Validation**: Strict input checks to ensure raw data availability.
*   **Model**: High Reasoning (GPT-4o / DeepSeek).

#### System Prompt Excerpt
```markdown
You are the Auditor Agent for a logistics data system. Your job is to verify that raw import data was correctly transferred to the database.

## THE PROBLEM YOU SOLVE
The Translator creates a mapping from raw Excel fields to database columns. But sometimes:
1. Mapped fields don't actually get populated (data is LOST)
2. Date conversions go wrong (data is WRONG or Excel Serial `45719`)
3. Valuable data has no database column (data is UNMAPPED)

You catch all of these.
```

### 4. Oracle Chat (The "Assistant")
*   **File**: `agents/oracle-chat.ts`
*   **Function**: `runOracleChat(messages, context)`
*   **Role**: **AI (Interactive)**. Provides a conversational interface for users to query container status and perform actions (add notes, update status) via tool calling.
*   **Invocation**: UI Chat Component.
*   **System Prompt**: `agents/prompts/oracle-system.md`
*   **Tools**: `add_note`, `update_status`, `update_field`, `create_attention_flag`, `resolve_attention_flag`.
*   **Model**: Standard Chat (GPT-4o / DeepSeek).

#### System Prompt Excerpt
```markdown
You are the Oracle, an intelligent logistics assistant for the Shipment Tracker system.

## YOUR CAPABILITIES
1. **Answer Questions**: Explain container status, timeline, risks, and data
2. **Provide Context**: Explain where data came from and confidence levels
3. **Execute Actions**: Use tools to modify data when requested
4. **Proactive Insights**: Highlight risks, anomalies, or items needing attention
...
```


### 5. Learner (The "Optimizer")
*   **File**: `agents/improvement-analyzer.ts`
*   **Function**: `runImprovementAnalyzer(input)`
*   **Role**: **AI (High Reasoning)**. 
    1. **Success Discovery**: Reinforces high-confidence AI mappings from the processed batch.
    2. **Gap Analysis**: Analyzes unmapped headers stored in metadata.
    3. **Reinforcement Learning**: Consumes "Auto-Patches" from the Auditor to learn from validated corrections.
*   **Invocation**: `scripts/step5_learner.ts` (Step 5).
*   **Model**: High Reasoning (GPT-4o / DeepSeek).

### 6. Dictionary Updater (The "Scribe")
*   **File**: `agents/dictionary-updater.ts`
*   **Function**: `updateDictionaries(improvements, path)`
*   **Role**: **Heuristic/Rule-based**. Applies approved changes to the persistent YAML dictionaries. Features **Smart Canonicalization** to robustly map flexible inputs (e.g., `metadata.bookingDate`) to standard schema fields (`booking_date`).
*   **Invocation**: `scripts/step5_learner.ts`.

### 7. Enricher (The "Analyst")
*   **File**: `agents/enricher.ts`
*   **Function**: `runEnricher(input)`
*   **Role**: **Deterministic/Heuristic**.
    1.  **Inference**: Derives operational data (`ServiceType`, `Status`) from raw metadata using regex and date triangulation.
    2.  **Safety**: Runs post-persistence and adheres to "Zero Overwrite" policy (only fills gaps).
*   **Invocation**: `scripts/step4_importer.ts` (Step 4.5).
*   **Output**: stored in `Container.aiDerived` (JSONB).
*   **Model**: N/A (Rule-based Typescript).

### 8. Improvement Orchestrator (The "Conductor")
*   **File**: `agents/improvement-orchestrator.ts`
*   **Function**: `runImprovementLoop(config)`
*   **Role**: **Logic**. Manages the multi-iteration loop, tracking scores and deciding when to stop based on success criteria.
*   **Invocation**: `lib/import-orchestrator.ts` (when `useImprovementMode` is true).

---


## Legacy Agents (Deprecated)

These agents are part of the previous generation architecture and are being replaced by the Auditor/Translator workflow.

### 1. Schema Detector (The "Gatekeeper") [DEPRECATED]
*   **File**: `agents/schema-detector.ts`
*   **Function**: `detectSchema(headers, sampleRows)`
*   **Role**: Mapped raw headers to canonical fields. Replaced by **Translator**.

### 2. Data Normalizer (The "Translator") [DEPRECATED]
*   **File**: `agents/data-normalizer.ts`
*   **Function**: `normalizeData(row, mapping)`
*   **Role**: Row-level transformation. Replaced by **Translator**.

### 3. Exception Classifier (The "Watchdog") [DEPRECATED]
*   **File**: `agents/exception-classifier.ts`
*   **Function**: `runExceptionClassifier(containerId)`
*   **Role**: Identified operational keys. Replaced by **Auditor** (validation) and **Oracle Chat** (proactive insights).

### 4. Mission Oracle - Import Analysis (The "Manager") [DEPRECATED]
*   **File**: `app/actions/analyzeImport.ts`
*   **Invocation**: Batch Summary. Replaced by **Auditor** (final report).
