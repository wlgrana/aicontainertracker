-- AlterTable
ALTER TABLE "Container" ADD COLUMN     "rawStatus" TEXT;

-- AlterTable
ALTER TABLE "ImportLog" ADD COLUMN     "containersCreated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "containersEnriched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "containersUpdated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discrepanciesFound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discrepanciesPatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "fileStoragePath" TEXT,
ADD COLUMN     "importSource" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "overallConfidence" DECIMAL(3,2),
ADD COLUMN     "processingDurationMs" INTEGER,
ADD COLUMN     "unmappedFieldsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Container_rawStatus_idx" ON "Container"("rawStatus");

-- CreateIndex
CREATE INDEX "ImportLog_importedOn_idx" ON "ImportLog"("importedOn" DESC);

-- CreateIndex
CREATE INDEX "ImportLog_status_idx" ON "ImportLog"("status");

-- CreateIndex
CREATE INDEX "ImportLog_forwarder_idx" ON "ImportLog"("forwarder");

-- CreateIndex
CREATE INDEX "ImportLog_importSource_idx" ON "ImportLog"("importSource");
