# Dictionary Learning - Test Execution Guide

## 🎯 Objective
Verify that the dictionary learning system:
1. Learns from successful imports
2. Reuses learned mappings (zero AI cost)
3. Handles mixed imports (partial dictionary hits)

## 📋 Prerequisites
- Dev server running: `npm run dev`
- Test Excel file ready
- Access to `/import` page
- Access to Azure AI Foundry dashboard (optional)

---

## Test 1: Clean Slate Learning

### Step 1: Clear Dictionary
```bash
node tests/run-test1.js
```
**Expected output**: "Deleted X mappings"

### Step 2: Import Test File
1. Navigate to `http://localhost:3000/import`
2. Upload your test Excel file
3. **WATCH THE CONSOLE LOGS** for:
   - `[Translator] Dictionary Summary: 0 hits, X unknown headers`
   - `[Translator] Sending X unknown headers to AI...`
   - `[Learner] ✅ Saved Y high-confidence mappings`

**📋 ACTION**: Copy the FULL console output and paste below:
```
[PASTE CONSOLE OUTPUT HERE]
```

### Step 3: Verify Database
```bash
node tests/verify-test1.js
```

**📋 ACTION**: Copy the output and paste below:
```
[PASTE VERIFICATION OUTPUT HERE]
```

### Step 4: Check `/dictionary` Page
1. Navigate to `http://localhost:3000/dictionary`
2. Verify stats and table

**📋 ACTION**: Describe what you see:
```
Total Mappings: __
High Confidence: __
Most Used: __
[PASTE SCREENSHOT OR DESCRIPTION]
```

---

## Test 2: Dictionary Hit (Cost Savings)

### Step 1: Import SAME File Again
1. Navigate to `http://localhost:3000/import`
2. Upload the **EXACT SAME** Excel file
3. **WATCH THE CONSOLE LOGS** for:
   - `[Translator] Dictionary Summary: X hits, 0 unknown headers`
   - `[Translator] 🎉 All headers found in dictionary! Skipping AI call`
   - `[Learner] No new AI mappings to learn`

**📋 ACTION**: Copy the FULL console output and paste below:
```
[PASTE CONSOLE OUTPUT HERE]
```

### Step 2: Verify Usage Incremented
```bash
node tests/verify-test2.js
```

**📋 ACTION**: Copy the output and paste below:
```
[PASTE VERIFICATION OUTPUT HERE]
```

### Step 3: Check Azure AI Logs (Optional)
1. Go to Azure AI Foundry portal
2. Check API usage for the time period
3. Confirm **ZERO** new API calls during second import

**📋 ACTION**: Note the API call count:
```
First import: __ API calls
Second import: __ API calls (should be 0)
```

---

## Test 3: Mixed Import

### Step 1: Import Different File
1. Prepare a different Excel file with:
   - Some headers that match Test 1 (e.g., "Container #", "Status")
   - Some new headers (e.g., "Vessel Name", "ETA")
2. Upload to `/import`
3. **WATCH THE CONSOLE LOGS** for:
   - `[Translator] Dictionary Summary: X hits, Y unknown headers`
   - `[Translator] Sending Y unknown headers to AI...`
   - `[Learner] ✅ Saved Z new mappings`

**📋 ACTION**: Copy the FULL console output and paste below:
```
[PASTE CONSOLE OUTPUT HERE]
```

### Step 2: Verify Mixed Results
```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.headerMapping.findMany({ orderBy: { timesUsed: 'desc' } })
  .then(m => {
    console.table(m.map(x => ({
      header: x.excelHeader,
      field: x.canonicalField,
      used: x.timesUsed
    })));
    console.log('Total:', m.length);
    console.log('Used 3x:', m.filter(x => x.timesUsed === 3).length);
    console.log('Used 1x:', m.filter(x => x.timesUsed === 1).length);
  })
  .finally(() => prisma.\$disconnect());
"
```

**📋 ACTION**: Copy the output and paste below:
```
[PASTE VERIFICATION OUTPUT HERE]
```

---

## ✅ Success Criteria

### Test 1 ✅
- [ ] Dictionary was empty before import
- [ ] All headers sent to AI
- [ ] 10-15 mappings saved (confidence ≥ 0.9)
- [ ] All `timesUsed = 1`

### Test 2 ✅
- [ ] All headers found in dictionary
- [ ] **ZERO AI calls** (check logs for "Skipping AI call")
- [ ] All `timesUsed = 2` (incremented)
- [ ] No new mappings saved

### Test 3 ✅
- [ ] Mixed results: X dictionary hits, Y AI calls
- [ ] Only unknown headers sent to AI
- [ ] New mappings saved for unknown headers
- [ ] Original mappings have `timesUsed = 3`
- [ ] New mappings have `timesUsed = 1`

---

## 🎉 Expected Cost Savings

| Import | Headers Analyzed | AI Cost | Savings |
|--------|-----------------|---------|---------|
| Test 1 | 15 (all via AI) | $0.XX | Baseline |
| Test 2 | 0 (all from dict) | **$0.00** | **100%** ✅ |
| Test 3 | 8 (partial AI) | $0.XX | ~60% |

---

## 📝 Notes Section

Use this space to record any observations, issues, or questions:

```
[YOUR NOTES HERE]
```

---

## 🐛 Troubleshooting

**Issue**: Dictionary not being used
- Check: `[Translator] Loaded X header mappings` - should be > 0
- Fix: Verify database has mappings: `SELECT COUNT(*) FROM "HeaderMapping"`

**Issue**: Mappings not being saved
- Check: `[Learner]` logs for save confirmation
- Fix: Verify AI confidence ≥ 0.9

**Issue**: `timesUsed` not incrementing
- Check: Database query shows same count
- Fix: Verify `lastUsedAt` is updating

---

**Test Date**: __________
**Tester**: __________
**Status**: ⬜ Pass | ⬜ Fail | ⬜ Partial
