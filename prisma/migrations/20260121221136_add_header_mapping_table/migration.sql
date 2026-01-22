-- DropForeignKey
ALTER TABLE "Container" DROP CONSTRAINT "Container_currentStatus_fkey";

-- CreateTable
CREATE TABLE "HeaderMapping" (
    "id" TEXT NOT NULL,
    "excelHeader" TEXT NOT NULL,
    "canonicalField" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeaderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeaderMapping_excelHeader_idx" ON "HeaderMapping"("excelHeader");

-- CreateIndex
CREATE INDEX "HeaderMapping_canonicalField_idx" ON "HeaderMapping"("canonicalField");

-- CreateIndex
CREATE INDEX "HeaderMapping_timesUsed_idx" ON "HeaderMapping"("timesUsed" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HeaderMapping_excelHeader_canonicalField_key" ON "HeaderMapping"("excelHeader", "canonicalField");
