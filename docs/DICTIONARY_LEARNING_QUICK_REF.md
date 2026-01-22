# Dictionary Learning - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Seed dictionary (one-time setup)
node prisma/seed-dictionary.js

# 2. Start dev server
npm run dev

# 3. View dictionary
http://localhost:3000/dictionary
```

## 📊 Key Stats

| Metric | Value |
|--------|-------|
| **YAML Seed Mappings** | 288 |
| **Baseline Confidence** | 100% |
| **Immediate Cost Savings** | 70-80% |
| **Steady State Savings** | 95-100% |

## 🔍 How It Works

```
Import Flow:
1. Load Dictionary (288+ mappings)
2. Check Headers
   ├─→ Known → Use Dictionary (zero cost)
   └─→ Unknown → Send to AI
3. Merge Results
4. Save High-Confidence AI Mappings (≥90%)
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `prisma/seed-dictionary.js` | YAML seed script |
| `agents/translator.ts` | Dictionary lookup |
| `lib/dictionary-helper.ts` | Core operations |
| `app/dictionary/page.tsx` | Admin UI |
| `docs/DICTIONARY_LEARNING.md` | Full docs |

## 🎯 Expected Console Output

### First Import
```
[Translator] Loaded 288 header mappings from database
[Translator] Dictionary Summary: 12 hits, 3 unknown headers
[Translator] Sending 3 unknown headers to AI...
[Learner] ✅ Saved 2 high-confidence mappings
```

### Second Import (Same File)
```
[Translator] Loaded 290 header mappings from database
[Translator] Dictionary Summary: 15 hits, 0 unknown headers
[Translator] 🎉 All headers found in dictionary! Skipping AI call (zero cost).
```

## 💰 Cost Savings

| Import # | Headers to AI | Cost | Savings |
|----------|---------------|------|---------|
| 1st | 3/15 (20%) | $0.004 | 80% |
| 2nd+ | 0/15 (0%) | $0.00 | 100% |

## 🛠️ Common Commands

```bash
# View all mappings
SELECT * FROM "HeaderMapping" ORDER BY "timesUsed" DESC;

# Count mappings
SELECT COUNT(*) FROM "HeaderMapping";

# YAML seeds vs AI learned
SELECT 
  CASE WHEN confidence = 1.0 THEN 'YAML' ELSE 'AI' END as source,
  COUNT(*) as count
FROM "HeaderMapping"
GROUP BY source;

# Re-seed dictionary
node prisma/seed-dictionary.js
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Dictionary not loading | Run `node prisma/seed-dictionary.js` |
| Headers not matching | Check case/whitespace, add to YAML |
| Mappings not saving | Check AI confidence ≥ 0.9 |
| UI not showing data | Verify API at `/api/dictionary` |

## 📍 Admin UI Features

**Location**: `/dictionary`

**Features**:
- ✅ Stats dashboard (Total, High Confidence, Most Used, Avg)
- ✅ Full mappings table
- ✅ Delete functionality
- ✅ Refresh button
- ✅ Color-coded confidence badges

## 🎓 Learning Threshold

**Current**: 0.9 (90% confidence)  
**Location**: `lib/import-orchestrator.ts` line 307

```typescript
const savedCount = await saveHeaderMappingsBatch(mappingsToLearn, 0.9);
//                                                                  ^^^
//                                                           Adjust here
```

## 📚 Documentation

- **Full Docs**: [docs/DICTIONARY_LEARNING.md](./DICTIONARY_LEARNING.md)
- **Implementation**: [DICTIONARY_LEARNING_IMPLEMENTATION.md](../DICTIONARY_LEARNING_IMPLEMENTATION.md)
- **Quick Ref**: [DICTIONARY_LEARNING_QUICK_REF.md](./DICTIONARY_LEARNING_QUICK_REF.md)

## ✅ Health Check

```bash
# Run this to verify system health
node tests/final-report.js
```

**Expected Output**:
- ✅ 288 mappings in database
- ✅ Dictionary UI accessible
- ✅ Recent imports showing dictionary hits

---

**Last Updated**: 2026-01-21  
**Version**: 1.0.0  
**Status**: Production Ready ✅
