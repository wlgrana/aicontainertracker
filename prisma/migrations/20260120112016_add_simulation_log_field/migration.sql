-- CreateEnum
CREATE TYPE "AgentStage" AS ENUM ('ARCHIVIST', 'TRANSLATOR', 'PERSISTENCE', 'AUDITOR', 'IMPROVEMENT_ANALYZER', 'ENRICHER');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ContainerEventType" AS ENUM ('BOOK', 'DEP', 'ARR', 'DIS', 'CUS', 'REL', 'OGF', 'DLV', 'EMP', 'ARCH_CAP', 'TRANS_START', 'TRANS_DONE', 'PERSIST_DONE', 'AUDIT_START', 'AUDIT_DONE', 'IMPROVEMENT_ITERATION');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ImportLog" (
    "fileName" TEXT NOT NULL,
    "fileURL" TEXT,
    "importedBy" TEXT,
    "importedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "carrierFormatId" TEXT,
    "importType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "aiAnalysis" JSONB,
    "aiAnalyzedAt" TIMESTAMP(3),
    "forwarder" TEXT,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "simulationLog" TEXT,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("fileName")
);

-- CreateTable
CREATE TABLE "RawRow" (
    "id" TEXT NOT NULL,
    "importLogId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "containerId" TEXT,
    "originalHeaders" TEXT,

    CONSTRAINT "RawRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitStage" (
    "stageName" TEXT NOT NULL,
    "stageCode" TEXT,
    "sequence" INTEGER NOT NULL,
    "category" TEXT,
    "expectedDays" INTEGER,
    "alertAfterDays" INTEGER,
    "responsibleTeam" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dcsaEventType" TEXT,
    "dcsaEventCategory" TEXT,
    "dcsaFacilityType" TEXT,

    CONSTRAINT "TransitStage_pkey" PRIMARY KEY ("stageName")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "shipmentReference" TEXT NOT NULL,
    "hbl" TEXT,
    "mbl" TEXT,
    "bookingReference" TEXT,
    "shipmentType" TEXT,
    "carrier" TEXT,
    "forwarder" TEXT,
    "shipper" TEXT,
    "consignee" TEXT,
    "pol" TEXT,
    "pod" TEXT,
    "finalDestination" TEXT,
    "contents" TEXT,
    "supplier" TEXT,
    "totalWeight" DOUBLE PRECISION,
    "totalPieces" INTEGER,
    "customerReference" TEXT,
    "poNumber" TEXT,
    "incoTerms" TEXT,
    "expectedContainers" INTEGER,
    "blType" TEXT,
    "blStatus" TEXT,
    "paymentStatus" TEXT,
    "paymentDueDate" TIMESTAMP(3),
    "amountDue" DOUBLE PRECISION,
    "releaseStatus" TEXT,
    "releaseDate" TIMESTAMP(3),
    "holdReason" TEXT,
    "notes" TEXT,
    "aceEntryNumber" TEXT,
    "aceEntryType" TEXT,
    "dutyAmount" DOUBLE PRECISION,
    "liquidationStatus" TEXT,
    "liquidationDate" TIMESTAMP(3),
    "bookingDate" TIMESTAMP(3),
    "businessUnit" TEXT,
    "destinationCity" TEXT,
    "freightCost" DOUBLE PRECISION,
    "shipmentVolume" DOUBLE PRECISION,
    "transportMode" TEXT,
    "importLogId" TEXT,
    "metadata" JSONB,
    "customerPo" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("shipmentReference")
);

-- CreateTable
CREATE TABLE "Container" (
    "containerNumber" TEXT NOT NULL,
    "containerType" TEXT,
    "currentStatus" TEXT,
    "currentLocation" TEXT,
    "currentVessel" TEXT,
    "currentVoyage" TEXT,
    "mbl" TEXT,
    "carrier" TEXT,
    "pol" TEXT,
    "pod" TEXT,
    "etd" TIMESTAMP(3),
    "atd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "ata" TIMESTAMP(3),
    "lastFreeDay" TIMESTAMP(3),
    "detentionFreeDay" TIMESTAMP(3),
    "statusLastUpdated" TIMESTAMP(3),
    "hasException" BOOLEAN NOT NULL DEFAULT false,
    "exceptionType" TEXT,
    "exceptionOwner" TEXT,
    "exceptionNotes" TEXT,
    "exceptionDate" TIMESTAMP(3),
    "manualPriority" TEXT,
    "priorityReason" TEXT,
    "prioritySetBy" TEXT,
    "prioritySetDate" TIMESTAMP(3),
    "notes" TEXT,
    "emptyIndicator" BOOLEAN,
    "sealNumber" TEXT,
    "grossWeight" DOUBLE PRECISION,
    "carrierEventId" TEXT,
    "aceEntryNumber" TEXT,
    "aceDisposition" TEXT,
    "aceStatus" TEXT,
    "aceLastUpdated" TIMESTAMP(3),
    "pgaHold" BOOLEAN,
    "pgaAgency" TEXT,
    "pgaHoldReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emptyReturnDate" TIMESTAMP(3),
    "gateOutDate" TIMESTAMP(3),
    "importLogId" TEXT,
    "metadata" JSONB,
    "aiAnalysis" JSONB,
    "aiDerived" JSONB,
    "aiLastUpdated" TIMESTAMP(3),
    "daysInTransit" INTEGER,
    "demurrageExposure" TEXT,
    "healthScore" INTEGER,
    "businessUnit" TEXT,
    "aiAssessment" JSONB,
    "aiAttentionCategory" TEXT,
    "aiAttentionHeadline" TEXT,
    "aiDataConfidence" TEXT,
    "aiOperationalStatus" TEXT,
    "aiRecommendedOwner" TEXT,
    "aiStatusReason" TEXT,
    "aiUrgencyLevel" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "finalDestination" TEXT,
    "finalDestinationEta" TIMESTAMP(3),
    "hbl" TEXT,
    "loadType" TEXT,
    "meta" JSONB,
    "pieces" INTEGER,
    "serviceType" TEXT,
    "volumeCbm" DOUBLE PRECISION,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("containerNumber")
);

-- CreateTable
CREATE TABLE "ShipmentContainer" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "piecesInContainer" INTEGER,
    "weightInContainer" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "ShipmentContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerEvent" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "stageName" TEXT,
    "eventDateTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "facilityId" TEXT,
    "vessel" TEXT,
    "voyage" TEXT,
    "source" TEXT,
    "sourceFileId" TEXT,
    "updatedBy" TEXT,
    "updatedOn" TIMESTAMP(3),
    "previousStatus" TEXT,
    "exceptionCleared" BOOLEAN,
    "notes" TEXT,
    "eventCategory" TEXT,
    "eventClassifier" TEXT,
    "dcsaEventType" TEXT,
    "transportMode" TEXT,
    "facilityType" TEXT,
    "emptyIndicator" BOOLEAN,
    "carrierEventId" TEXT,
    "meta" JSONB,

    CONSTRAINT "ContainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDateTime" TIMESTAMP(3) NOT NULL,
    "documentType" TEXT,
    "source" TEXT,
    "sourceFileId" TEXT,
    "updatedBy" TEXT,
    "updatedOn" TIMESTAMP(3),
    "previousBLStatus" TEXT,
    "newBLStatus" TEXT,
    "notes" TEXT,
    "dcsaEventType" TEXT,
    "carrierEventId" TEXT,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ACEStatusLog" (
    "id" TEXT NOT NULL,
    "containerId" TEXT,
    "shipmentId" TEXT,
    "aceDisposition" TEXT,
    "aceStatus" TEXT,
    "previousACEStatus" TEXT,
    "holdType" TEXT,
    "pgaAgency" TEXT,
    "holdReason" TEXT,
    "eventDateTime" TIMESTAMP(3),
    "source" TEXT,
    "sourceFileId" TEXT,
    "updatedOn" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ACEStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "facilityName" TEXT NOT NULL,
    "facilityCode" TEXT,
    "facilityType" TEXT,
    "portId" TEXT,
    "address" TEXT,
    "unLocationCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("facilityName")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "carrierName" TEXT NOT NULL,
    "scac" TEXT,
    "shortName" TEXT,
    "trackingURL" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dcsaCompliant" BOOLEAN,
    "apiEndpoint" TEXT,
    "apiCredentialRef" TEXT,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("carrierName")
);

-- CreateTable
CREATE TABLE "Port" (
    "portName" TEXT NOT NULL,
    "portCode" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "defaultFreeDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acePortCode" TEXT,
    "cbpDistrict" TEXT,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("portName")
);

-- CreateTable
CREATE TABLE "Forwarder" (
    "forwarderName" TEXT NOT NULL,
    "shortName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customsBroker" TEXT,
    "aceFilerCode" TEXT,

    CONSTRAINT "Forwarder_pkey" PRIMARY KEY ("forwarderName")
);

-- CreateTable
CREATE TABLE "DemurrageRate" (
    "name" TEXT NOT NULL,
    "carrierId" TEXT,
    "portId" TEXT,
    "containerType" TEXT,
    "freeDays" INTEGER,
    "dailyRate" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "DemurrageRate_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "CarrierFormat" (
    "formatName" TEXT NOT NULL,
    "carrierId" TEXT,
    "formatType" TEXT,
    "columnMapping" TEXT,
    "sampleHeaders" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "CarrierFormat_pkey" PRIMARY KEY ("formatName")
);

-- CreateTable
CREATE TABLE "DCSAEventMap" (
    "name" TEXT NOT NULL,
    "carrierId" TEXT,
    "sourceEventCode" TEXT,
    "sourceEventName" TEXT,
    "dcsaEventType" TEXT,
    "transitStageName" TEXT,
    "eventCategory" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DCSAEventMap_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "AttentionFlag" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "flaggedBy" TEXT,
    "flaggedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner" TEXT,
    "notes" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "AttentionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "containerId" TEXT,
    "shipmentId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "detail" TEXT,
    "source" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusOverride" (
    "id" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskFactors" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProcessingLog" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "stage" "AgentStage" NOT NULL,
    "status" "ProcessingStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "input" JSONB,
    "output" JSONB,
    "confidence" DOUBLE PRECISION,
    "mappings" JSONB,
    "unmappedFields" JSONB,
    "dictionaryVersion" TEXT,
    "findings" JSONB,
    "discrepancies" JSONB,
    "improvementsSuggested" JSONB,
    "improvementsApplied" JSONB,
    "artifactPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementJob" (
    "id" TEXT NOT NULL,
    "importLogId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 3,
    "targetCaptureRate" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "totalContainers" INTEGER NOT NULL DEFAULT 0,
    "containersProcessed" INTEGER NOT NULL DEFAULT 0,
    "initialCaptureRate" DOUBLE PRECISION,
    "currentCaptureRate" DOUBLE PRECISION,
    "finalCaptureRate" DOUBLE PRECISION,
    "synonymsAdded" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedCompletionAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "improvementsApplied" JSONB,
    "logs" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprovementJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_containerId_key" ON "RiskAssessment"("containerId");

-- CreateIndex
CREATE INDEX "AgentProcessingLog_containerId_idx" ON "AgentProcessingLog"("containerId");

-- CreateIndex
CREATE INDEX "AgentProcessingLog_stage_idx" ON "AgentProcessingLog"("stage");

-- CreateIndex
CREATE INDEX "AgentProcessingLog_timestamp_idx" ON "AgentProcessingLog"("timestamp");

-- CreateIndex
CREATE INDEX "ImprovementJob_importLogId_idx" ON "ImprovementJob"("importLogId");

-- CreateIndex
CREATE INDEX "ImprovementJob_status_idx" ON "ImprovementJob"("status");

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_carrierFormatId_fkey" FOREIGN KEY ("carrierFormatId") REFERENCES "CarrierFormat"("formatName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRow" ADD CONSTRAINT "RawRow_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRow" ADD CONSTRAINT "RawRow_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("fileName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_currentStatus_fkey" FOREIGN KEY ("currentStatus") REFERENCES "TransitStage"("stageName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentContainer" ADD CONSTRAINT "ShipmentContainer_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentContainer" ADD CONSTRAINT "ShipmentContainer_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("shipmentReference") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("facilityName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_previousStatus_fkey" FOREIGN KEY ("previousStatus") REFERENCES "TransitStage"("stageName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_stageName_fkey" FOREIGN KEY ("stageName") REFERENCES "TransitStage"("stageName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("shipmentReference") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ACEStatusLog" ADD CONSTRAINT "ACEStatusLog_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ACEStatusLog" ADD CONSTRAINT "ACEStatusLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("shipmentReference") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ACEStatusLog" ADD CONSTRAINT "ACEStatusLog_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("portName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemurrageRate" ADD CONSTRAINT "DemurrageRate_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("carrierName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemurrageRate" ADD CONSTRAINT "DemurrageRate_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("portName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierFormat" ADD CONSTRAINT "CarrierFormat_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("carrierName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCSAEventMap" ADD CONSTRAINT "DCSAEventMap_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("carrierName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCSAEventMap" ADD CONSTRAINT "DCSAEventMap_transitStageName_fkey" FOREIGN KEY ("transitStageName") REFERENCES "TransitStage"("stageName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttentionFlag" ADD CONSTRAINT "AttentionFlag_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusOverride" ADD CONSTRAINT "StatusOverride_containerNumber_fkey" FOREIGN KEY ("containerNumber") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProcessingLog" ADD CONSTRAINT "AgentProcessingLog_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("containerNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementJob" ADD CONSTRAINT "ImprovementJob_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("fileName") ON DELETE SET NULL ON UPDATE CASCADE;
