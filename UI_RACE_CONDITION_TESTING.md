# UI Race Condition Fix - Testing Guide

## Quick Test Scenarios

### 🧪 Test 1: Rapid Click Protection
**Objective**: Verify duplicate requests are blocked

**Steps**:
1. Navigate to `/import` page
2. Open browser DevTools → Network tab
3. Click the "Start" button **5-10 times rapidly** (as fast as you can)

**Expected Results**:
- ✅ Only **ONE** POST request to `/api/simulation/control` appears in Network tab
- ✅ Console shows: `[UI] Ignoring duplicate START request (too soon - Xms)`
- ✅ Button shows loading spinner and becomes disabled
- ✅ No error dialogs appear

**Failure Indicators**:
- ❌ Multiple POST requests in Network tab
- ❌ "Cannot proceed from current state" error dialog
- ❌ Button remains clickable during processing

---

### 🧪 Test 2: Auto-Proceed Smooth Flow
**Objective**: Verify auto-run completes without conflicts

**Steps**:
1. Navigate to `/import` page
2. Ensure "Auto-Run" toggle is **enabled** (amber/yellow)
3. Open browser console (F12)
4. Click "Start" button **once**
5. Watch the simulation progress through all steps

**Expected Results**:
- ✅ Simulation progresses: ARCHIVIST → TRANSLATOR → AUDITOR → IMPORT → IMPROVEMENT
- ✅ Console shows: `[UI] Auto-proceed: ARCHIVIST_COMPLETE -> proceed`
- ✅ No error dialogs appear
- ✅ Each step completes and auto-advances to the next

**Failure Indicators**:
- ❌ Simulation stalls at any step
- ❌ "Cannot proceed from current state" error dialog
- ❌ Console shows errors or warnings

---

### 🧪 Test 3: Manual Override During Auto-Run
**Objective**: Verify manual clicks take precedence over auto-proceed

**Steps**:
1. Navigate to `/import` page
2. Enable "Auto-Run" toggle
3. Click "Start" button
4. **Immediately after** ARCHIVIST completes, **manually click** "Proceed to Translation" button
5. Observe console logs

**Expected Results**:
- ✅ Manual click is processed
- ✅ Console shows: `[UI] Auto-proceed skipped - user action in progress`
- ✅ Only ONE proceed request sent (visible in Network tab)
- ✅ No duplicate requests or errors

**Failure Indicators**:
- ❌ Two proceed requests in Network tab
- ❌ Error dialog appears
- ❌ Console shows duplicate request warnings

---

### 🧪 Test 4: Button Disabled State
**Objective**: Verify buttons are disabled during processing

**Steps**:
1. Navigate to `/import` page
2. Click "Start" button
3. **Immediately try** to click "Start" button again (while it's processing)

**Expected Results**:
- ✅ Button shows **loading spinner** (rotating icon)
- ✅ Button is **visually disabled** (grayed out, no hover effect)
- ✅ Button **does not respond** to clicks
- ✅ Console shows: `[UI] Ignoring START request (already processing)`

**Failure Indicators**:
- ❌ Button remains clickable
- ❌ Multiple requests sent
- ❌ No loading spinner shown

---

### 🧪 Test 5: Error Filtering (Race Conditions Suppressed)
**Objective**: Verify benign race condition errors are hidden

**Steps**:
1. Navigate to `/import` page
2. **Disable** "Auto-Run" toggle
3. Click "Start" button
4. Wait for ARCHIVIST to complete
5. Click "Proceed" button **3 times rapidly**

**Expected Results**:
- ✅ Only ONE proceed request sent
- ✅ Console shows: `[UI] Ignoring duplicate PROCEED request`
- ✅ **NO error dialog** appears to user
- ✅ Simulation continues normally

**Failure Indicators**:
- ❌ Error dialog shows "Cannot proceed from current state"
- ❌ Multiple proceed requests in Network tab
- ❌ Simulation stops or errors out

---

### 🧪 Test 6: Real Error Still Shows
**Objective**: Verify genuine errors are still displayed

**Steps**:
1. Navigate to `/import` page
2. **Do NOT upload any file** (leave file selector empty or select invalid file)
3. Click "Start" button

**Expected Results**:
- ✅ Error dialog **DOES appear** (this is a real error, not a race condition)
- ✅ Error message is descriptive (e.g., "File not found" or "Invalid file format")
- ✅ Console shows: `[UI] Request failed: ...`

**Failure Indicators**:
- ❌ No error dialog appears (real errors should still show!)
- ❌ Silent failure with no feedback

---

## Console Log Cheat Sheet

### ✅ Good Logs (Expected)
```
[UI] Calling action: START at 2026-01-20T...
[UI] Request successful: Started simulation
[UI] Auto-proceed: ARCHIVIST_COMPLETE -> proceed
[UI] Ignoring duplicate PROCEED request (too soon - 123ms)
[UI] Ignoring START request (already processing)
[UI] Auto-proceed skipped - user action in progress
[UI] Race condition detected, ignoring error silently
```

### ❌ Bad Logs (Issues)
```
Error: Cannot proceed from current state
Network error: ...
[UI] Request failed: ...
(Multiple identical requests in quick succession)
```

---

## Performance Verification

### Network Tab Checks
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Run any test scenario
4. **Count POST requests** to `/api/simulation/control`

**Expected**: Only ONE request per user action (even with rapid clicks)

### Console Checks
1. Open DevTools → Console
2. Run any test scenario
3. Look for `[UI]` prefixed logs

**Expected**: Clear, informative logs showing protection layers activating

---

## Automated Testing (Future)

```typescript
// Example Playwright test
test('should prevent duplicate clicks', async ({ page }) => {
  await page.goto('/import');
  
  // Intercept network requests
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/simulation/control')) {
      requests.push(req);
    }
  });
  
  // Rapid click
  for (let i = 0; i < 10; i++) {
    await page.click('button:has-text("Start")');
  }
  
  // Wait for processing
  await page.waitForTimeout(2000);
  
  // Assert only one request
  expect(requests.length).toBe(1);
});
```

---

## Rollback Procedure

If any test fails critically:

```bash
# Revert the changes
git revert HEAD

# Or restore specific file
git checkout HEAD~1 -- app/import/page.tsx

# Rebuild
npm run build

# Redeploy
vercel --prod
```

---

## Success Criteria Summary

| Test | Criterion | Status |
|------|-----------|--------|
| Rapid Click | Only 1 request sent | ⬜ |
| Auto-Proceed | Smooth progression | ⬜ |
| Manual Override | No conflicts | ⬜ |
| Button State | Disabled during processing | ⬜ |
| Error Filtering | Race errors suppressed | ⬜ |
| Real Errors | Still displayed | ⬜ |

**All tests must pass** before deploying to production.

---

**Last Updated**: January 20, 2026  
**Version**: 1.0  
**Status**: Ready for Testing
