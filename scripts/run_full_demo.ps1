
$ErrorActionPreference = "Stop"
$LogFile = "simulation_logs.txt"

Start-Transcript -Path $LogFile -Force

Write-Host ">>> STARTING DEMO CYCLE <<<" -ForegroundColor Cyan

Write-Host "`n>>> STEP 1: RESET & BASELINE IMPORT" -ForegroundColor Yellow
npx tsx scripts/demo_step_by_step.ts

Write-Host "`n>>> STEP 2: IMPROVEMENT LOOP" -ForegroundColor Yellow
npx tsx scripts/demo_improve.ts

Write-Host "`n>>> STEP 3: FINAL VERIFICATION" -ForegroundColor Yellow
npx tsx scripts/demo_final_verify.ts

Write-Host "`n>>> DEMO COMPLETE <<<" -ForegroundColor Green

Stop-Transcript
