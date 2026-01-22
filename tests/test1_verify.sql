-- Test 1: Verify Learned Mappings After First Import
-- Run via: npx prisma db execute --stdin < test1_verify.sql

SELECT 
    "excelHeader", 
    "canonicalField", 
    confidence, 
    "timesUsed",
    "createdAt"
FROM "HeaderMapping" 
ORDER BY confidence DESC;

-- Expected: 
-- - Multiple rows (10-15 mappings)
-- - All timesUsed = 1 (first use)
-- - All confidence >= 0.9
