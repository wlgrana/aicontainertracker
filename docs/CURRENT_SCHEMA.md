# Shipment Tracker Database Schema

This document reflects the latest database schema pulled from Neon as of 2026-01-15.

## Overview

The schema is designed for a "Zero Data Loss" architecture with a hybrid model of structured columns and JSON metadata. Key entities include `Container`, `Shipment`, and `ImportLog`.

## Models

### ImportLog
Tracks file imports (Excel/CSV).
- **fileName** (ID): Unique file name.
- **status**: 'PENDING', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW'.
- **aiAnalysis**: JSON blob for initial AI insights.
- **summary**: JSON blob for the final Auditor agent report.
- **completedAt**: Timestamp when the import workflow (including agents) finished.
- **Relations**: `rawRows`, `containers`, `containerEvents`, `shipments`, `shipmentEvents`.

### RawRow
Stores raw rows from imported files for auditability.
- **id** (ID): UUID.
- **data**: JSON string containing the raw row data.
- **originalHeaders**: JSON string of the file headers.
- **containerId**: Link to the `Container` created from this row (nullable).
- **Relations**: `importLog`, `container`.

### Container
Core entity representing a shipping container.
- **containerNumber** (ID): Standard 11-char container number.
- **forwarder**: (String) Forwarder/NVOCC name.
- **currentStatus**: References `TransitStage` (e.g., 'BOOK', 'DEP', 'ARR').
- **meta**: JSON field for agent-specific metadata (mapping confidence, flags).
- **aiAnalysis** & **aiAssessment**: JSON fields for detailed AI reasoning.
- **aiOperationalStatus**, **aiAttentionCategory**: Structured fields for filtering (e.g., 'ON_TRACK', 'CRITICAL').
- **Relations**: `events`, `rawRows`, `shipmentContainers`, `stage`, `importLog`.

### Shipment
Represents a bill of lading or booking containing multiple containers.
- **shipmentReference** (ID): Unique reference (MBL or Booking Ref).
- **customerPo**: Explicit field for Customer PO.
- **metadata**: JSON field for extensible data.
- **Relations**: `shipmentContainers`, `shipmentEvents`, `importLog`.

### TransitStage
Reference table for standard shipping stages.
- **stageName** (ID): e.g., 'Booked', 'Vessel Departed'.
- **stageCode**: Short code (e.g., 'BOOK', 'DEP').
- **sequence**: Logic order (10, 20, 30...).
- **Relations**: `containers`, `containerEvents`.

### ContainerEvent
Individual history events for a container.
- **id** (ID): UUID.
- **stageName**: The stage reached (e.g., 'Vessel Departed').
- **eventDateTime**: When the event occurred.
- **meta**: JSON field for confidence scores and derivation logic.
- **source**: 'ExcelImport', 'CarrierAPI', 'Manual'.
- **Relations**: `container`, `stage`, `importLog`.

### ShipmentContainer
Link table between Shipments and Containers.
- **id** (ID): UUID.
- **Relations**: `shipment`, `container`.

### Facility, Port, Carrier
Reference tables for logistics entities.
- **Facility**: Terminals, warehouses.
- **Port**: Global ports (UNLOCODE).
- **Carrier**: Shipping lines (SCAC).

### Agent-Specific Fields
- **Container.meta**: Stores `mappingConfidence` (float) and `flags` (array of strings) from the Translator agent.
- **ContainerEvent.meta**: Stores `confidence` (float) and `derivedFrom` (string source field) from the Translator agent.
- **ImportLog.summary**: Stores the Auditor's final approval report.

### AgentProcessingLog
Detailed audit trail for the agent pipeline.
- **stage**: 'ARCHIVIST', 'TRANSLATOR', 'PERSISTENCE', 'AUDITOR'.
- **mappings**: Field-level AI decisions.
- **confidence**: Score for the operation.
- **Relations**: `container`.

## Relationships

- **One-to-Many**: `ImportLog` -> `RawRow`
- **One-to-Many**: `Container` -> `ContainerEvent`
- **One-to-Many**: `Shipment` -> `ShipmentContainer` -> `Container`
- **One-to-One**: `RawRow` -> `Container` (optional link)

## Enums (Implicit in Code)
- **TransitStage Codes**: BOOK, DEP, ARR, DIS, CUS, REL, OGF, DLV, EMP
