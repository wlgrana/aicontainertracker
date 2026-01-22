-- Test 1: Clear Dictionary for Clean Slate Test
-- Run this in Prisma Studio or via: npx prisma db execute --stdin < test1_clear.sql

DELETE FROM "HeaderMapping";

-- Verify it's empty
SELECT COUNT(*) as total_mappings FROM "HeaderMapping";
-- Expected: 0
