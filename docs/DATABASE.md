# Neo DB Architecture (Neon PostgreSQL)

The **Neo DB** is a 15-table PostgreSQL schema designed to provide a robust foundation for the Shipment Tracker. It moves beyond simple flat records to modeled relationships that accurately represent the complexity of global logistics.

## Core Domain Models

### `Shipment`
Represents the commercial entity of moving goods.
- **Key Fields**: `shipmentReference`, `hbl`, `mbl`, `bookingReference`, `consignee`, `aceEntryNumber`, `businessUnit`, `freightCost`, `shipmentVolume`.
- **Purpose**: Tracks the "what" and "who" of the logistics transaction.
- **New Fields**: `metadata` (JSON), `importLogId` (Lineage).
  - `metadata.raw`: Original source row.
  - `metadata.unmapped`: Fields not matching schema.
  - `metadata.missing`: Required fields absent in source.

### `Container`
Represents the physical equipment.
- **Key Fields**: `containerNumber`, `currentStatus` (e.g., CUS, ARR), `lastFreeDay`, `gateOutDate`, `emptyReturnDate`.
- **Timestamps**: `createdAt` (Imported On), `updatedAt` (Last System Update).
- **Purpose**: Tracks the "where" and "state" of the physical goods.
- **Validation**: Linked to `TransitStage` enum table for status integrity.
- **New Fields**: `metadata` (JSON), `importLogId`.
  - `metadata.raw`: Original source row.
  - `metadata.unmapped`: Fields not matching schema.
  - `metadata.missing`: Required fields absent in source.

### `RiskAssessment` (Mission Oracle)
Stores AI-driven analysis of container progress and risk.
- **Key Fields**: `riskScore` (0-100), `riskFactors` (JSON), `recommendations` (JSON).
- **Purpose**: Persists the "thinking" of the Mission Oracle agent so analysis doesn't need to be re-run on every page load.

### `ShipmentContainer` (Junction)
Handles the Many-to-Many relationship between Shipments and Containers.
- **Purpose**: Allows one shipment to have multiple containers, and (rarely) one container to contain consolidated shipments.

## Event Sourcing & History

### `ContainerEvent`
The spine of the "Journey Timeline".
- **Concept**: Every change in state is an event.
- **Sources**: `ExcelImport`, `CarrierAPI`, `Manual`, `ACE`.
- **Fields**: `eventDateTime`, `stageName`, `location`, `vessel`, `source`.

### `ImportLog` & `RawRow`
Traceability for data ingestion.
- **Purpose**: Tracks exactly which file (and row) an update came from.
- **Key Feature**: Allows "undo" or audit of bad data sources.
- **AI Integration**: Stores `aiAnalysis` (JSON) and `aiAnalyzedAt` for Mission Oracle insights.

### `ActivityLog`
Forensic audit trail for user actions.
- **Context**: "User X changed status from A to B".
- **Fields**: `actor`, `action`, `detail`, `metadata`.

### `ACEStatusLog` (Compliance)
Tracks US Customs (CBP) status updates via ACE (Automated Commercial Environment).
- **Key Fields**: `aceDisposition`, `aceStatus`, `holdType`, `pgaAgency`.
- **Purpose**: Critical for monitoring customs holds, releases, and exam status.
- **Relationships**: Links to `Shipment` and `Container`.

### `ShipmentEvent`
High-level milestones for the commercial shipment.
- **Examples**: `Booking Confirmed`, `BL Released`, `Customs Entry Filed`.
- **Purpose**: Distinct from container-level physical moves; tracks document/financial progress.

## Operational Management

### `TransitStage`
Configuration table for the logistics lifecycle.
- **Examples**: `BOOK`, `DEP` (Departed), `ARR` (Arrived), `CUS` (Customs Hold).
- **Control**: Defines logical order and target lead times.

### `AttentionFlag`
Exception management workflow.
- **Priorities**: Critical, High, Normal.
- **State**: Active vs Resolved.

### `StatusOverride`
Context for manual interventions when the system state must be forced.

## Data Configuration & Mapping

### `CarrierFormat`
Defines how to parse Excel/CSV files from different carriers.
- **Key Fields**: `columnMapping` (JSON), `formatType`, `sampleHeaders`.
- **Purpose**: Allows the Ingestion Engine to handle diverse input formats without code changes.

### `DCSAEventMap`
Standardizes carrier-specific event codes to our internal `TransitStage` and DCSA standards.
- **Purpose**: Rosetta stone for translating "DISCHARGED" (MSC) vs "OFFLOA" (Maersk) into a unified `DIS` stage.

## Reference Data

- **`Carrier`**: Master list of shipping lines (MSC, Maersk, etc.) with API configs.
- **`Port`**: World ports with geolocation and default demurrage rules.
- **`Facility`**: Specific terminals or rail ramps within ports.
- **`DemurrageRate`**: Rule engine for calculating financial exposure.
- **`Forwarder`**: Directory of freight forwarders and brokers.
