# Agent & Prompt Audit

This document identifies all AI agents, their defining prompts, and their invocation processes within the Shipment Tracker application.

> **[2026-01-15 UPDATE]**: The architecture is transitioning to a 4-Agent System (Archivist, Translator, Auditor, Oracle Chat). Legacy agents are marked below.

## New 4-Agent Architecture

### 1. Archivist (The "Librarian")
*   **File**: `agents/archivist.ts`
*   **Function**: `archiveExcelFile(input)`
*   **Role**: **Programmatic (No AI)**. Ingests raw Excel files, captures every row as-is ("Zero Data Loss"), and creates the initial `ImportLog`. Ensures full traceability.
*   **Invocation**: `lib/import-orchestrator.ts` (Step 1).
*   **Model**: N/A (Pure TypeScript).

### 2. Translator (The "Mapper")
*   **File**: `agents/translator.ts`
*   **Function**: `runTranslator(input)`
*   **Role**: **AI (Batch)**. Analyzes headers to detect schema, performs data transformation (e.g., Excel dates), generates normalized `Container` records, and derives `ContainerEvent` history.
*   **Invocation**: `lib/import-orchestrator.ts` (Step 2).
*   **System Prompt**: `agents/prompts/translator-system.md`
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

### 3. Auditor (The "Reconciler")
*   **File**: `agents/auditor.ts`
*   **Function**: `runAuditor(input)`
*   **Role**: **AI (Post-Persistence Verification)**. Acts as a data reconciliation layer. Runs *after* data is written to the database. compares the original raw Excel row against the final database record to catch lost data, mapping errors, or unmapped fields.
*   **Invocation**: `lib/import-orchestrator.ts` (Step 6 - Post-Persistence).
*   **System Prompt**: `agents/prompts/auditor-system.md`
*   **Model**: High Reasoning (GPT-4o / DeepSeek).

#### System Prompt Excerpt
```markdown
You are the Auditor Agent for a logistics data system. Your job is to verify that raw import data was correctly transferred to the database.

## THE PROBLEM YOU SOLVE
The Translator creates a mapping from raw Excel fields to database columns. But sometimes:
1. Mapped fields don't actually get populated (data is LOST)
2. Date conversions go wrong (data is WRONG)
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
