-- Test 3: Verify Mixed Import Results
-- Run via: npx prisma db execute --stdin < test3_verify.sql

-- Show all mappings with usage stats
SELECT 
    "excelHeader", 
    "canonicalField", 
    confidence,
    "timesUsed",
    "createdAt",
    "lastUsedAt"
FROM "HeaderMapping" 
ORDER BY "timesUsed" DESC, confidence DESC;

-- Expected: 
-- - Original mappings have timesUsed = 3 (used in all 3 imports)
-- - New mappings have timesUsed = 1 (only in third import)
-- - Total count increased by ~6 new mappings

-- Summary stats
SELECT 
    COUNT(*) as total_mappings,
    AVG(confidence) as avg_confidence,
    MAX("timesUsed") as max_usage,
    MIN("timesUsed") as min_usage
FROM "HeaderMapping";
