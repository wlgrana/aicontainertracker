# Log Download Functionality - Diagnostic Summary

## Problem Identified

The log download link at the bottom of the `/import` page was not working because:

1. **Logs were not being written to the database** - The `LogStream` utility class was created but never integrated into the actual simulation scripts
2. **All existing ImportLog records have `simulationLog = null`** - No log data was being persisted
3. **The download API was correctly trying to fetch from the database** - But there was no data to retrieve

## Root Cause

The simulation was writing logs to the **filesystem only** (`logs/` directory) using `fs.appendFileSync()` in `run_step.ts`. The database-backed logging system (`LogStream` class in `lib/log-stream.ts`) existed but was never instantiated or used.

## Changes Made

### 1. Updated `scripts/run_step.ts`
**Purpose**: Integrate `LogStream` to write logs to both filesystem (local debugging) and database (production/Vercel)

**Key Changes**:
- Import and instantiate `LogStream` class
- Replace all `fs.appendFileSync()` calls with `logStream.write()`
- Added `importLogId` tracking (uses the original filename without timestamp)
- Call `logStream.close()` on process exit to flush final data to database
- Added debug logging to show initialization parameters

**Impact**: All simulation output (stdout, stderr, step banners, metadata headers) now flows through `LogStream` and gets persisted to the database.

### 2. Updated `agents/archivist.ts`
**Purpose**: Initialize the `simulationLog` field when creating ImportLog records

**Key Changes**:
- Added `simulationLog: ''` to both `create` and `update` blocks in the `upsert` call
- This ensures the field exists before `LogStream` tries to append to it

**Impact**: New imports will have an empty string in `simulationLog` from the start, allowing `LogStream` to append log content.

### 3. Added Debug Logging to Log APIs
**Purpose**: Trace log retrieval and identify issues

**Files Modified**:
- `app/api/simulation/logs/download/route.ts` - Added logging for request parameters and log content retrieval
- `app/api/simulation/logs/list/route.ts` - Added logging for database queries and formatted results
- `lib/log-stream.ts` - Added logging to `getLogContent()` function

**Impact**: Console logs will now show exactly what's happening when logs are requested and retrieved.

## How LogStream Works

1. **Initialization**: `new LogStream(logFilename, importLogId)`
   - `logFilename`: The timestamped log filename (e.g., `Horizon_Tracking_Report_FRONTEND_1768931582913.log`)
   - `importLogId`: The original filename used as the database key (e.g., `Horizon Tracking Report.xlsx`)

2. **Writing**: `logStream.write(content)`
   - Buffers content in memory
   - Optionally writes to filesystem in development mode
   - Flushes to database every 3 seconds

3. **Database Updates**: 
   - Queries current `simulationLog` content from database
   - Appends new buffered content
   - Updates the `ImportLog` record using `fileName` as the key

4. **Closing**: `await logStream.close()`
   - Performs final flush to database
   - Closes file stream (if in development)
   - Clears flush interval

## Testing Instructions

### Test 1: Verify Existing Logs Still Show (But Can't Download)
1. Navigate to `http://localhost:3000/import`
2. Scroll to "Simulation Logs" section
3. Click "Refresh"
4. **Expected**: You should see 3 log files listed with `0.0 KB` size
5. Click "Download" on any log
6. **Expected**: Download will fail with "Log not available yet" message (this is correct - old logs don't have database content)

### Test 2: Run a New Import and Verify Logs Are Saved
1. On `/import` page, upload a test Excel file (e.g., `Horizon Tracking Report.xlsx`)
2. Start the simulation
3. Wait for simulation to complete
4. Check the terminal/console for `[RUN_STEP]` debug logs showing:
   - `[RUN_STEP] Initializing with: { step: '1', logFilename: '...', importFilename: '...', importLogId: '...' }`
   - `[RUN_STEP] Closing log stream and flushing to database...`
   - `[RUN_STEP] Log stream closed successfully`
5. Scroll to "Simulation Logs" section and click "Refresh"
6. **Expected**: The new log should show a non-zero file size (e.g., `15.2 KB`)
7. Click "Download" on the new log
8. **Expected**: A `.log` file should download with the full simulation output

### Test 3: Verify Database Content
Run the debug script to check database content:
```bash
npx tsx scripts/debug_logs.ts
```

**Expected Output**:
- Old logs (before changes): `simulationLog exists: false`, `simulationLog length: 0`
- New logs (after changes): `simulationLog exists: true`, `simulationLog length: [large number]`

## Debug Logging Output

When testing, watch for these log prefixes in the console:

### From `run_step.ts`:
- `[RUN_STEP] Initializing with:` - Shows step, logFilename, importFilename, importLogId
- `[RUN_STEP] Closing log stream and flushing to database...` - Indicates final flush starting
- `[RUN_STEP] Log stream closed successfully` - Confirms flush completed

### From `log-stream.ts`:
- `[LogStream] Could not create file stream:` - Warning if filesystem write fails (expected on Vercel)
- `[LogStream] File write failed:` - Warning if filesystem write fails
- `[LogStream] Failed to flush to database:` - Error if database write fails
- `[getLogContent] Attempting to retrieve log for importLogId:` - Shows what's being requested
- `[getLogContent] Query result:` - Shows if log was found and its size
- `[getLogContent] Successfully retrieved log, length:` - Confirms successful retrieval

### From Log APIs:
- `[LOG LIST] Fetching logs from database...` - List API starting
- `[LOG LIST] Found X logs in database` - Number of logs found
- `[LOG LIST] Log 1:` - Details about each log
- `[LOG DOWNLOAD] Request received` - Download request starting
- `[LOG DOWNLOAD] importLogId parameter:` - What ID is being requested
- `[LOG DOWNLOAD] Log content length:` - Size of retrieved content
- `[LOG DOWNLOAD] Successfully returning log content` - Download succeeded

## Known Issues

### Issue 1: Old Logs Can't Be Downloaded
**Status**: Expected behavior
**Reason**: Logs created before this fix don't have `simulationLog` data in the database
**Workaround**: Re-run those imports to generate new logs with database content

### Issue 2: Log Sizes Show 0.0 KB for Old Logs
**Status**: Expected behavior
**Reason**: The UI calculates size from `simulationLog` field, which is null for old logs
**Fix**: New imports will show correct sizes

## Vercel Compatibility

The `LogStream` implementation is designed for Vercel:

1. **Database-First**: Always writes to database, regardless of environment
2. **Optional Filesystem**: Only writes to filesystem in development mode
3. **Graceful Degradation**: If filesystem write fails, continues with database-only
4. **Periodic Flushing**: Flushes to database every 3 seconds to avoid data loss
5. **Final Flush**: Ensures all data is written on process exit

## Next Steps

1. **Test with a new import** to verify logs are correctly saved to database
2. **Verify download functionality** works for new logs
3. **Deploy to Vercel** and test that logging works in production
4. **Consider cleanup**: Optionally delete old ImportLog records that have no simulationLog data

## Files Modified

1. `scripts/run_step.ts` - Integrated LogStream for database-backed logging
2. `agents/archivist.ts` - Initialize simulationLog field
3. `app/api/simulation/logs/download/route.ts` - Added debug logging
4. `app/api/simulation/logs/list/route.ts` - Added debug logging
5. `lib/log-stream.ts` - Added debug logging to getLogContent()
6. `scripts/debug_logs.ts` - Created debug utility (new file)
