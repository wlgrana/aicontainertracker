# Dictionary Learning Test Suite - Quick Start

## 🚀 Quick Start (5 Minutes)

### 1. Prepare Environment
```bash
# Make sure dev server is running
npm run dev

# Open in browser
http://localhost:3000/import
```

### 2. Run Test 1 (Clean Slate)
```bash
# Clear dictionary
node tests/run-test1.js

# Import your test file via UI
# Watch console for: "Dictionary Summary: 0 hits, X unknown"

# Verify results
node tests/verify-test1.js
```

### 3. Run Test 2 (Dictionary Hit)
```bash
# Import SAME file again via UI
# Watch console for: "All headers found in dictionary! Skipping AI call"

# Verify results
node tests/verify-test2.js
```

### 4. Check Results
```bash
# View dictionary
http://localhost:3000/dictionary

# Should see:
# - All mappings with timesUsed = 2
# - Zero AI cost on second import
```

## 📊 What You Should See

### Test 1 Console Output
```
[Translator] Dictionary Summary: 0 hits, 15 unknown headers
[Translator] Sending 15 unknown headers to AI...
[Learner] ✅ Saved 12 high-confidence mappings to dictionary
```

### Test 2 Console Output
```
[Translator] Dictionary Summary: 15 hits, 0 unknown headers
[Translator] 🎉 All headers found in dictionary! Skipping AI call (zero cost).
[Learner] No new AI mappings to learn (all headers were from dictionary)
```

## ✅ Success Checklist

- [ ] Test 1: Mappings saved to database
- [ ] Test 2: Zero AI calls on repeat import
- [ ] Test 2: `timesUsed` incremented to 2
- [ ] `/dictionary` page shows all mappings
- [ ] Console logs match expected output

## 📁 Test Files Created

- `tests/run-test1.js` - Clear dictionary
- `tests/verify-test1.js` - Verify first import
- `tests/verify-test2.js` - Verify second import
- `tests/test1_clear.sql` - SQL to clear dictionary
- `tests/test1_verify.sql` - SQL to verify mappings
- `tests/test2_verify.sql` - SQL to verify usage
- `tests/test3_verify.sql` - SQL for mixed import
- `tests/DICTIONARY_LEARNING_TEST_GUIDE.md` - Full test guide

## 🎯 Expected Results

| Metric | Test 1 | Test 2 | Improvement |
|--------|--------|--------|-------------|
| AI Calls | 1 | **0** | 100% reduction |
| Cost | $0.XX | **$0.00** | 100% savings |
| Speed | Normal | ~90% faster | Instant lookup |

## 📝 Report Template

After running tests, fill this out:

```
TEST RESULTS - [DATE]

Test 1: Clean Slate Learning
✅ Dictionary cleared
✅ Imported file: [FILENAME]
✅ Headers analyzed: [COUNT]
✅ Mappings saved: [COUNT]
✅ Average confidence: [XX]%

Test 2: Dictionary Hit
✅ Same file imported
✅ Dictionary hits: [COUNT]
✅ AI calls: 0 ✅
✅ timesUsed incremented: YES ✅

Test 3: Mixed Import (Optional)
✅ Different file imported
✅ Dictionary hits: [COUNT]
✅ New headers: [COUNT]
✅ New mappings saved: [COUNT]

OVERALL STATUS: ✅ PASS | ⬜ FAIL

Notes:
[YOUR OBSERVATIONS]
```

## 🆘 Need Help?

Check the full test guide:
`tests/DICTIONARY_LEARNING_TEST_GUIDE.md`

Or review the implementation docs:
`DICTIONARY_LEARNING_IMPLEMENTATION.md`
