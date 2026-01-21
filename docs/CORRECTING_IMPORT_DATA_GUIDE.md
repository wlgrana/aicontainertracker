# Correcting Existing Import Data - Options Guide
**Date**: January 21, 2026  
**Context**: After fixing data-normalizer bugs, existing containers need correction

---

## 🎯 Quick Decision Guide

| Scenario | Best Option | Time |
|----------|-------------|------|
| **Fix all containers quickly** | Option 1: Reprocess Script | 5 min |
| **Re-import from source file** | Option 2: Re-import | 10 min |
| **Fix specific containers only** | Option 3: Targeted SQL | 2 min |
| **Need full audit trail** | Option 2: Re-import | 10 min |

---

## Option 1: Reprocess Existing Containers ⭐ (RECOMMENDED)

### What It Does
Runs the fixed data normalizer logic on all existing containers without re-importing from Excel.

### Pros
- ✅ Fast (processes in-memory data)
- ✅ No need for original Excel file
- ✅ Updates only AI-derived fields
- ✅ Preserves all original data
- ✅ Can run multiple times safely (idempotent)

### Cons
- ⚠️ Doesn't fix any other potential import issues
- ⚠️ Relies on existing data being correct

### How to Run
```bash
# Run the reprocessing script
npx tsx scripts/fix-existing-containers.ts
```

### What Gets Updated
- `aiOperationalStatus`
- `healthScore`
- `daysInTransit`
- `aiAttentionCategory`
- `updatedAt`

### Script Location
`scripts/fix-existing-containers.ts` (already created)

---

## Option 2: Re-import from Source File

### What It Does
Deletes existing containers from the problematic import and re-imports the Excel file with the fixed logic.

### Pros
- ✅ Guaranteed to use latest logic
- ✅ Full audit trail in ImportLog
- ✅ Fixes any other import issues
- ✅ Clean slate

### Cons
- ⚠️ Requires original Excel file
- ⚠️ Takes longer (full import pipeline)
- ⚠️ Loses any manual edits to containers
- ⚠️ More complex rollback

### How to Run

#### Step 1: Identify the Import
```bash
# Find the import log
npx tsx scripts/check-recent-import.ts
```

#### Step 2: Delete Containers from Import
```typescript
// scripts/delete-import-containers.ts
import { prisma } from '../lib/prisma';

async function deleteImportContainers(importLogId: string) {
    const importLog = await prisma.importLog.findUnique({
        where: { id: importLogId }
    });

    if (!importLog) {
        throw new Error(`Import log ${importLogId} not found`);
    }

    console.log(`Deleting containers from import: ${importLog.fileName}`);

    // Delete containers from this import
    const result = await prisma.container.deleteMany({
        where: {
            metadata: {
                path: ['importContext', 'importLogId'],
                equals: importLogId
            }
        }
    });

    console.log(`Deleted ${result.count} containers`);
}

// Usage: deleteImportContainers('your-import-log-id');
```

#### Step 3: Re-import the File
```bash
# Upload the Excel file again through the UI
# OR use the import API
```

---

## Option 3: Targeted SQL Update

### What It Does
Directly updates specific containers using SQL queries.

### Pros
- ✅ Very fast
- ✅ Surgical precision
- ✅ Good for fixing specific known issues

### Cons
- ⚠️ Manual SQL required
- ⚠️ No validation
- ⚠️ Risk of mistakes
- ⚠️ Doesn't use normalizer logic

### How to Run

#### Fix Delivered Containers
```sql
-- Update containers with delivery dates to "Delivered" status
UPDATE "Container"
SET 
    "aiOperationalStatus" = 'Delivered',
    "aiAttentionCategory" = 'Resolved',
    "healthScore" = 100,
    "updatedAt" = NOW()
WHERE 
    "deliveryDate" IS NOT NULL
    AND "aiOperationalStatus" != 'Delivered';
```

#### Fix Completed Containers
```sql
-- Update containers with empty return dates to "Completed" status
UPDATE "Container"
SET 
    "aiOperationalStatus" = 'Completed',
    "aiAttentionCategory" = 'Resolved',
    "healthScore" = 100,
    "updatedAt" = NOW()
WHERE 
    "emptyReturnDate" IS NOT NULL
    AND "aiOperationalStatus" != 'Completed';
```

#### Fix Days in Transit for Delivered Containers
```sql
-- Recalculate days in transit for delivered containers
UPDATE "Container"
SET 
    "daysInTransit" = EXTRACT(DAY FROM ("deliveryDate" - "atd"))::INTEGER,
    "updatedAt" = NOW()
WHERE 
    "deliveryDate" IS NOT NULL
    AND "atd" IS NOT NULL;
```

---

## Option 4: Hybrid Approach (Best of Both Worlds)

### What It Does
1. Run reprocessing script for AI metrics
2. Then run targeted SQL for specific known issues
3. Optionally re-import specific problematic files

### Pros
- ✅ Comprehensive fix
- ✅ Fast for most containers
- ✅ Surgical for edge cases

### Cons
- ⚠️ More complex
- ⚠️ Requires coordination

### How to Run
```bash
# Step 1: Reprocess all containers
npx tsx scripts/fix-existing-containers.ts

# Step 2: Run targeted SQL for any remaining issues
# (Use Prisma Studio or psql)

# Step 3: Re-import specific problematic files if needed
```

---

## Recommended Approach

### For Your Situation (Status Bug)

**Use Option 1: Reprocess Script** ⭐

**Why?**
1. The bug was in the AI metrics calculation, not the data import
2. All the source data is correct (delivery dates, etc.)
3. Just need to recalculate derived fields
4. Fast and safe

**Steps:**
```bash
# 1. Run the reprocessing script
npx tsx scripts/fix-existing-containers.ts

# 2. Verify the fix
# Check a few containers in the UI or database

# 3. Monitor for any issues
# Check dashboard for correct statuses
```

---

## Verification Steps

After running any fix, verify the results:

### 1. Check Specific Container
```typescript
// scripts/verify-fix.ts
import { prisma } from '../lib/prisma';

async function verifyFix(containerNumber: string) {
    const container = await prisma.container.findUnique({
        where: { containerNumber }
    });

    console.log('Container:', containerNumber);
    console.log('Delivery Date:', container?.deliveryDate);
    console.log('AI Status:', container?.aiOperationalStatus);
    console.log('Health Score:', container?.healthScore);
    console.log('Days in Transit:', container?.daysInTransit);
    console.log('Attention:', container?.aiAttentionCategory);
}

verifyFix('HDMU2765032');
```

### 2. Check All Delivered Containers
```sql
-- Should return 0 rows if fix worked
SELECT 
    "containerNumber",
    "deliveryDate",
    "aiOperationalStatus",
    "healthScore"
FROM "Container"
WHERE 
    "deliveryDate" IS NOT NULL
    AND "aiOperationalStatus" != 'Delivered';
```

### 3. Check Health Scores
```sql
-- Delivered containers should have high health scores
SELECT 
    "containerNumber",
    "deliveryDate",
    "healthScore"
FROM "Container"
WHERE 
    "deliveryDate" IS NOT NULL
    AND "healthScore" < 90;
```

---

## Rollback Plan

If something goes wrong:

### Option 1 Rollback
```sql
-- Revert to previous values (if you saved them)
-- Unfortunately, we don't have a backup of the old values
-- Best to just re-run the script
```

### Option 2 Rollback
```sql
-- Restore from backup
-- OR re-import from original Excel file
```

### Option 3 Rollback
```sql
-- Run opposite SQL statements
-- OR restore from database backup
```

---

## Best Practices

### Before Running Any Fix
1. ✅ **Backup database** (or at least the Container table)
2. ✅ **Test on a few containers first**
3. ✅ **Document what you're doing**
4. ✅ **Have rollback plan ready**

### During Fix
1. ✅ **Monitor progress**
2. ✅ **Check for errors**
3. ✅ **Verify results incrementally**

### After Fix
1. ✅ **Verify all containers**
2. ✅ **Check dashboard**
3. ✅ **Test UI**
4. ✅ **Document results**

---

## Summary

**For the status bug fix, use Option 1: Reprocess Script**

```bash
# Simple, fast, and safe
npx tsx scripts/fix-existing-containers.ts
```

This will:
- ✅ Fix all containers in ~5 minutes
- ✅ Update AI metrics with correct logic
- ✅ Preserve all original data
- ✅ Can be run multiple times safely

**Verification:**
```bash
# Check the problematic container
npx tsx -e "import {prisma} from './lib/prisma'; prisma.container.findUnique({where:{containerNumber:'HDMU2765032'}}).then(c=>console.log(c))"
```

You should see:
- `aiOperationalStatus: 'Delivered'`
- `healthScore: 100` (or close to it)
- `aiAttentionCategory: 'Resolved'`
