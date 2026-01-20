SELECT "containerNumber", "rawStatus", "currentStatus" 
FROM "Container" 
WHERE "rawStatus" IS NOT NULL 
LIMIT 10;
