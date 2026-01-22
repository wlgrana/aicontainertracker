-- Test 2: Verify timesUsed Incremented After Second Import
-- Run via: npx prisma db execute --stdin < test2_verify.sql

SELECT 
    "excelHeader", 
    "canonicalField", 
    "timesUsed",
    "lastUsedAt"
FROM "HeaderMapping" 
ORDER BY "timesUsed" DESC;

-- Expected: 
-- - All timesUsed = 2 (incremented from 1)
-- - lastUsedAt should be recent (just now)
