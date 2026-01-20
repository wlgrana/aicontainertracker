# Simulation Log Metadata Enhancement

## Overview
Added execution metadata to the top of all simulation log files to track:
- **Environment**: Whether the simulation ran locally or on production (Vercel)
- **Invocation Method**: Whether started from the frontend UI or via direct script execution

## Changes Made

### 1. `scripts/run_step.ts`
- Added metadata header generation for Step 1 (first step of simulation)
- Header includes:
  - Timestamp (ISO 8601 format)
  - Environment (LOCAL or PRODUCTION (Vercel))
  - Invocation Method (FRONTEND or SCRIPT)
  - Log filename
  - Node.js version
  - Platform (win32, darwin, linux, etc.)

**Detection Logic:**
- **Environment**: Checks `process.env.VERCEL === '1'` or `process.env.NODE_ENV === 'production'`
- **Invocation Method**: Reads `process.env.INVOKED_BY` (defaults to 'SCRIPT' if not set)

### 2. `app/api/simulation/control/route.ts`
- Updated `spawnStep()` function to set `INVOKED_BY=FRONTEND` environment variable
- This marks all simulations started from the UI with the correct invocation method

### 3. `scripts/test_log_metadata.ts` (NEW)
- Test script to verify metadata header generation
- Validates all expected fields are present
- Can be run with: `npx tsx scripts/test_log_metadata.ts`

## Example Log Header

```
═══════════════════════════════════════════════════════════════
  IMPORT RUN METADATA
═══════════════════════════════════════════════════════════════
  Timestamp:         2026-01-20T10:38:45.123Z
  Environment:       LOCAL
  Invocation Method: FRONTEND
  Log File:          Horizon_Tracking_Report_1768904821645.log
  Node Version:      v20.11.0
  Platform:          win32
═══════════════════════════════════════════════════════════════

>>> RUNNING STEP 1 [2026-01-20T10:38:45.456Z] <<<
...
```

## Log Filename Format

Log files are now named using the format: **`filename_timestamp.log`**

Examples:
- `Horizon Tracking Report.xlsx` → `Horizon_Tracking_Report_1768904821645.log`
- `test_enrich_service_misplaced.xlsx` → `test_enrich_service_misplaced_1768904821645.log`
- `My Container Data 2024.xlsx` → `My_Container_Data_2024_1768904821645.log`

**Naming Rules:**
- `.xlsx` extension is removed
- Special characters are replaced with underscores
- Timestamp is Unix epoch milliseconds
- If no filename provided, uses `unknown_timestamp.log`

## Usage Scenarios

### Frontend Invocation (UI)
When a user clicks "Start Simulation" in the web interface:
- Environment: `LOCAL` (dev) or `PRODUCTION (Vercel)` (deployed)
- Invocation Method: `FRONTEND`

### Script Invocation
When running simulation scripts directly:
```bash
npx tsx scripts/run_step.ts 1 "test_file.xlsx"
```
- Environment: `LOCAL` (unless deployed)
- Invocation Method: `SCRIPT`

### Multi-Simulation Test
When running `run_multi_simulation.ts`:
- Uses the API endpoint, so shows as `FRONTEND`
- This is correct since it's using the same code path as the UI

## Benefits

1. **Debugging**: Quickly identify where a simulation was run
2. **Production Tracking**: Distinguish local testing from production runs
3. **Audit Trail**: Complete record of execution context
4. **Troubleshooting**: Helps diagnose environment-specific issues

## Testing

Run the test script to verify:
```bash
npx tsx scripts/test_log_metadata.ts
```

This will:
1. Generate a test log with metadata header
2. Display the generated header
3. Validate all expected fields are present
