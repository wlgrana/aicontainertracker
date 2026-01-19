# 🗄️ Database Architecture

The Shipment Tracker uses a robust **15-table PostgreSQL schema** hosted on Neon. It is designed to handle high-fidelity logistics data, complex relationships between shipments and containers, and rich AI-generated insights.

## 🔌 Infrastructure & Connection
- **Database Provider**: [Neon](https://neon.tech) (PostgreSQL)
- **Vercel Project**: `shipment-tracker`
- **Vercel Organization**: `wlgranas-projects`
- **Connection**: Managed via `DATABASE_URL` in Vercel Environment Variables.

### 🔑 Connection Parameters
| Parameter | Value |
| :--- | :--- |
| **Host** | `ep-small-voice-ahhy8aje-pooler.c-3.us-east-1.aws.neon.tech` |
| **Database** | `neondb` |
| **User** | `neondb_owner` |
| **PSQL Command** | `psql 'postgres://neondb_owner:[PASSWORD]@ep-small-voice-ahhy8aje-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'` |

## 🏗️ Zero Data Loss (Hybrid Data Model)

This system implements a **"Zero Data Loss"** philosophy. Unlike traditional ELT pipelines that discard unmapped columns, we preserve **100% of the raw input data**.

### The "Hybrid" Approach
**Persistence Strategy**: Optimized Batch Upserts (Chunk Size: 50) + Parallel execution for high-performance ingestion.

Every `Container` and `Shipment` record stores data in two parallel layers:

1.  **Structured Columns (The "Canonical" Layer)**
    - High-confidence, standard logistics fields (e.g., `containerNumber`, `pol`, `atd`).
    - Used for indexing, filtering, and standard reporting.
    - **Recently Verified**: `pol`, `pod`, `mbl`, `aet`, `ata`, `grossWeight` are now persisted directly here.

2.  **Metadata JSON (The "Preservation" Layer)**
    - Stores the **entire raw row** from the source file.
    - Stores the **AI's field mapping logic** (which column mapped to which field).
    - Stores **Unmapped Fields** with AI-generated confidence scores.
    - **Field Locking (`lockedFields`)**:
        - A list of field names that have been manually edited by a user.
        - **Critical Function**: The AI "Mission Oracle" and the ingestion pipeline check this list before updates. If a field is present here, the automation **skips** updating that specific field, preserving the user's manual "Source of Truth".

> **Result**: The UI can display a unified view of "Official" database fields + "Inferred" raw data, ensuring users never see "N/A" when the data exists in the source file.

---

## 🌟 Core Entities

### `Shipment`
The central entity representing a commercial booking.
- **Key Fields**: `shipmentReference`, `mbl`, `hbl`, `businessUnit`, `freightCost`, `forwarder`
- **Route Fields**: `pol`, `pod`, `destinationCity`
- **Parties**: `shipper`, `consignee`
- **Relationships**: One-to-Many with `ShipmentContainer`

### `Container`
Represents a physical shipping container.
- **Key Fields**: `containerNumber`, `containerType`, `carrier`
- **Status Fields**: `currentStatus` (e.g., 'DIS'), `lastFreeDay`, `pgaHold`
- **Dates**: `etd`, `atd` (Actual Departure), `eta`, `ata` (Actual Arrival), `gateOutDate`
- **AI Fields (New)**: 
    - `aiOperationalStatus` (ENUM)
    - `aiAttentionCategory` (ENUM)
    - `aiUrgencyLevel` (ENUM)
    - `aiDataConfidence` (ENUM)
    - `aiStatusReason` (String)
    - `aiAttentionHeadline` (String)
    - `aiAssessment` (Full JSON Blob)
- **Relationships**: Linked to `TransitStage`, `Shipment`, and `RiskAssessment`

### `ContainerEvent`
An immutable record of a specific event in a container's journey.
- **Key Fields**: `eventDateTime`, `stageName`, `location`, `source`
- **Purpose**: Powers the "Mission Progress" timeline.
- **Source**: Can be `FileImport` (batch) or `System` (manual/API).

---

## 🧠 AI & Intelligence Storage

### `ImportLog`
Stores the raw ingestion history and AI schema analysis.
- **`fileName`**: Unique identifier for the upload.
- **`forwarder`**: (New) The verified source/provider of the data file.
- **`aiAnalysis` (JSON)**: Stores the AI-detected schema:
    - **`columnMapping`**: Map of raw headers to canonical fields.
    - **`unmappedFields`**: Detailed AI analysis of unknown columns:
        ```json
        {
          "ACE Disposition": {
            "potentialMeaning": "U.S. Customs ACE Disposition Code",
            "suggestedCanonicalField": "aceDispositionCode",
            "confidenceScore": 0.95,
            "rawValue": "1C"
          }
        }
        ```

### `RiskAssessment`
Stores the output of the "Mission Oracle" AI analysis.
- **`riskScore`**: 0-100 integer representing shipment risk.
- **`riskFactors` (JSON)**: Detailed breakdown of contributing factors (e.g., "Customs Hold", "Missing LFD").
- **`recommendations` (JSON)**: AI-generated actionable steps for the user.

### `AgentProcessingLog`
The forensic audit trail for the AI ingestion pipeline.
- **`stage`**: Enum (`ARCHIVIST`, `TRANSLATOR`, `PERSISTENCE`, `AUDITOR`).
- **`status`**: `STARTED`, `COMPLETED`, `FAILED`.
- **`confidence`**: Overall confidence score for the stage.
- **`mappings` (JSON)**: Detailed field-level mapping reasoning (Translator).
- **`discrepancies` (JSON)**: Data loss or errors detected by the Auditor.
- **`dictionaryVersion`**: Version string of the dictionary used for translation.
- **`timestamp`**: Exact time of execution.

### `ImprovementJob` (New)
Tracks the lifecycle of an autonomous batch improvement process.
- **`importLogId`**: The batch being improved.
- **`status`**: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`.
- **`currentIteration`**: Number of times the loop has run (default max 3).
- **`synonymsAdded`**: Count of new dictionary entries learned.
- **`targetCaptureRate`**: The quality goal (default 0.95).
- **`logs` (JSON)**: Detailed breakdown of what the Analyzer found and what the Updater changed.

---

## ⚙️ Reference Data

- **`TransitStage`**: Configurable lifecycle stages (e.g., "Gate Out", "Vessel Departure").
- **`Carrier`**: Carrier profiles with SCAC codes and tracking URLs.
- **`Port`**: Global port data including default free-time rules.
- **`CarrierFormat`**: "Self-Healing" schema registry. Automatically learns and caches new carrier layouts after successful processing to bypass AI detection in future dry runs.

## 🛡️ Operational Tables

- **`AttentionFlag`**: High-priority manual flags for executive review.
- **`StatusOverride`**: Audit trail of manual status corrections.
- **`ActivityLog`**: System-wide audit log of all user actions.

## 🧩 AI Classification Enums

The **Mission Oracle** uses strict enumerations to classify shipment status and urgency. These values are stored in the `classification` JSON object and mapped to `aiOperationalStatus`, `aiAttentionCategory`, etc.

### `status.operational`
Where the shipment **actually** is (Truth Engine determination):
- `BOOKED`: Booking confirmed, nothing has moved yet
- `PENDING_DEPARTURE`: At origin, waiting to load
- `DEPARTED`: Left origin port, in transit
- `IN_TRANSIT`: Confirmed moving, has tracking
- `ARRIVING`: ETA within 72 hours
- `ARRIVED`: Vessel at destination, not discharged
- `DISCHARGED`: Off vessel, in terminal yard
- `CUSTOMS_HOLD`: Held by CBP/PGA
- `RELEASED`: Cleared customs, awaiting pickup
- `OUT_FOR_DELIVERY`: In drayage to final destination
- `DELIVERED`: At final destination
- `RETURNED_EMPTY`: Container returned
- `UNKNOWN`: Cannot determine from data

### `status.confidence`
- `VERIFIED`: Multiple sources confirm this status
- `INFERRED`: Determined from partial data (e.g., ATD exists so must be in transit)
- `STALE`: Data is old, status may have changed
- `CONFLICTING`: Evidence contradicts database status
- `INCOMPLETE`: Critical data missing to determine

### `attention.category`
- `ON_TRACK`: No issues, progressing normally
- `DATA_CONFLICT`: Database status contradicts evidence
- `MILESTONE_OVERDUE`: Expected event hasn't occurred
- `DATA_STALE`: No updates in too long
- `DEMURRAGE_RISK`: At or approaching LFD
- `CUSTOMS_ACTION`: Customs hold or issue
- `CARRIER_ISSUE`: Carrier-side problem
- `DOCUMENTATION`: Missing/incorrect docs
- `PICKUP_READY`: Cleared and waiting

### `attention.urgency`
- `CRITICAL`: Today (money being lost, customs hold)
- `HIGH`: Within 48 hours
- `MEDIUM`: This week
- `LOW`: Monitor
- `NONE`: No action needed
