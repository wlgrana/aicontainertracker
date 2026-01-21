-- Fix status constraint: Drop foreign key on currentStatus to allow NULL values
-- This is part of the "Zero Data Loss" flexible status architecture

-- Drop the foreign key constraint if it exists
ALTER TABLE "Container" 
DROP CONSTRAINT IF EXISTS "Container_currentStatus_fkey";

-- The currentStatus field is now optional and can be NULL
-- rawStatus will always store the carrier's original value
-- This allows us to preserve unknown status codes without failing imports
