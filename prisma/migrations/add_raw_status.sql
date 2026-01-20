-- Add rawStatus field to store carrier's original status codes
ALTER TABLE "Container" 
ADD COLUMN IF NOT EXISTS "rawStatus" TEXT;

-- Preserve existing data by copying currentStatus to rawStatus
UPDATE "Container" 
SET "rawStatus" = "currentStatus" 
WHERE "rawStatus" IS NULL;

-- Drop the foreign key constraint that's causing imports to fail
ALTER TABLE "Container" 
DROP CONSTRAINT IF EXISTS "Container_currentStatus_fkey";

-- Make currentStatus nullable (can be NULL if unmapped)
ALTER TABLE "Container" 
ALTER COLUMN "currentStatus" DROP NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "Container_rawStatus_idx" ON "Container"("rawStatus");
