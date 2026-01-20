# 🐛 Quick Debugging Reference

## Check Execution Mode

### In Vercel Function Logs:
```
[VERCEL MODE] Running steps inline (blocking)  ← CORRECT
[LOCAL MODE] Using spawn for background execution  ← WRONG (should not appear on Vercel)
```

### In Step Logs:
```
[ARCHIVIST] Environment: { VERCEL: '1', isVercel: true }  ← CORRECT
```

---

## Common Error Patterns

### ❌ Child Process Error (BAD)
```
Error: spawn ENOENT
Error: Cannot spawn child process
```
**Cause:** Inline execution is NOT working
**Fix:** Check that control route detects `process.env.VERCEL === '1'`

### ✅ Inline Execution (GOOD)
```
[VERCEL] Starting Step 1 (Archivist) inline...
[VERCEL] Step 1 completed: { success: true, rowCount: 100 }
```

### ❌ Timeout Error (BAD)
```
Error: Function execution timeout
FUNCTION_INVOCATION_TIMEOUT
```
**Cause:** Step took >60s (Pro) or >10s (Free)
**Fix:** Reduce data size or upgrade to Pro tier

### ❌ File Not Found (BAD)
```
Error: ENOENT: no such file or directory, open './artifacts/...'
```
**Cause:** Not using `/tmp` on Vercel
**Fix:** Verify `getArtifactPath()` is being used

---

## Quick Checks

### 1. Is Vercel Environment Detected?
```bash
vercel logs --prod | grep "VERCEL MODE"
```
Should see: `[VERCEL MODE] Running steps inline (blocking)`

### 2. Are Steps Running Inline?
```bash
vercel logs --prod | grep "VERCEL.*Step.*inline"
```
Should see: `[VERCEL] Starting Step X inline...`

### 3. Any Spawn Errors?
```bash
vercel logs --prod | grep -i "spawn\|child"
```
Should see: **NO RESULTS**

### 4. Check File Paths:
```bash
vercel logs --prod | grep "/tmp"
```
Should see: `/tmp/simulation_status.json`, `/tmp/artifacts/...`

---

## Test Locally First

Before testing on Vercel, verify local execution still works:

```bash
# Start dev server
npm run dev

# Test import simulation
# Should spawn child processes (non-blocking)
```

---

## Monitor Live Logs

```bash
# Watch logs in real-time
vercel logs --prod --follow

# Filter for specific function
vercel logs --prod --follow | grep "simulation/control"
```

---

## Quick Production Test

1. Go to: https://shipment-tracker-wlgranas-projects.vercel.app/import
2. Upload file
3. Click "Start"
4. Open DevTools Console (F12)
5. Watch for:
   - ✅ No spawn errors
   - ✅ Status updates after ~10-60s
   - ✅ Step completes successfully

---

## Emergency Rollback

If something breaks:

```bash
# Quick rollback to previous deployment
vercel rollback
```

Or via dashboard:
1. Go to https://vercel.com/wlgranas-projects/shipment-tracker
2. Click "Deployments"
3. Find previous working deployment
4. Click "Promote to Production"
