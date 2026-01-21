
import { prisma } from '../lib/prisma';
import { runAuditor } from '../agents/auditor'; // We reuse the agent logic
import { updateStatus, getActiveFilename } from './simulation-utils';
import { getArtifactPath } from '../lib/path-utils';
import { transformRow } from '../lib/transformation-engine';
import * as fs from 'fs';
import * as path from 'path';


/**
 * Main Auditor function - exported for Vercel direct execution
 */
export async function runAuditorStep(config?: {
    filename?: string;
}) {
    console.log('[AUDITOR] Starting...');
    console.log('[AUDITOR] CWD:', process.cwd());
    console.log('[AUDITOR] Environment:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        isVercel: process.env.VERCEL === '1'
    });

    const FILENAME = config?.filename || await getActiveFilename();
    const ARTIFACT_PATH = getArtifactPath('temp_translation.json');

    try {
        console.log(`>>> STEP 3: AUDITOR PREVIEW (Quality Gate) <<<`);
        console.log('[AUDITOR] Step 1: Updating status...');
        await updateStatus({ step: 'AUDITOR', progress: 40, message: 'Simulating Import & Auditing (1 Sample)...' });

        console.log('[AUDITOR] Step 2: Checking for artifact...');
        console.log('[AUDITOR] Artifact path:', ARTIFACT_PATH);
        if (!fs.existsSync(ARTIFACT_PATH)) {
            console.error('[AUDITOR] Artifact not found at:', ARTIFACT_PATH);
            throw new Error("No approved detection found. Run Step 2 (Analysis) first.");
        }

        console.log('[AUDITOR] Step 3: Reading artifact...');
        const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf-8'));
        const mapping = artifact.schemaMapping;
        console.log('[AUDITOR] Artifact loaded, mapping keys:', Object.keys(mapping.fieldMappings).length);

        // Fetch Sample Rows (we don't need all 1000 for a preview)
        const rawRows = await prisma.rawRow.findMany({
            where: { importLogId: FILENAME },
            take: 1 // Check first 1 row for speed
        });

        console.log(`Loaded ${rawRows.length} sample rows for Pre-Import Audit.`);

        let verifiedCount = 0;
        let discrepancyCount = 0;
        let sampleAnalysis: any = null;

        let patches = new Map<string, any>(); // header -> FieldMapping

        // Loop through sample and simulate transformation
        for (const row of rawRows) {
            const rawData = JSON.parse(row.data);
            const headers = row.originalHeaders ? JSON.parse(row.originalHeaders) : [];

            // 1. SIMULATE TRANSFORMATION (In-Memory)
            const result = transformRow(rawData, headers, mapping);
            // ... (rest of logic) ...
            const containerNumber = result.fields.containerNumber?.value || `UNKNOWN_${row.rowNumber}`;

            // 2. RUN AUDITOR (Against Simulated Object)
            let auditResult;
            try {
                auditResult = await runAuditor({
                    containerNumber: containerNumber,
                    rawData: { raw: rawData, mapping: mapping }, // Raw array
                    databaseRow: result.flat,
                    skipLogging: true // SKIP LOGGING to avoid FK errors (data not in DB yet)
                });

                if (auditResult.auditResult === 'PASS') verifiedCount++;
                else discrepancyCount++;

            } catch (err) {
                console.warn(`[Auditor] Skipping ${containerNumber} due to error: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }

            // 3. IDENTIFY PATCHES (Self-Healing)
            if (auditResult.unmapped && auditResult.unmapped.length > 0) {
                for (const u of auditResult.unmapped) {
                    if (u.suggestedStorage && u.suggestedStorage !== 'N/A' && !['null', 'ignore'].includes(u.suggestedStorage.toLowerCase())) {
                        if (!mapping.fieldMappings[u.rawField]) {
                            patches.set(u.rawField, {
                                sourceHeader: u.rawField,
                                targetField: u.suggestedStorage,
                                confidence: 0.95, // High confidence from Auditor
                                transformationType: 'semantic',
                                notes: 'Auto-patched by Auditor (Quality Gate)'
                            });
                        }
                    }
                }
            }

            // 4. CAPTURE SAMPLE FOR UI
            // Prefer one with unmapped fields to show opportunity
            const unmappedCount = (auditResult.unmapped || []).length;
            if (!sampleAnalysis || (unmappedCount > 0 && sampleAnalysis.unmapped.length === 0)) {
                // ... (existing sample capture logic) ...
                // Reconstruct Raw Object for Display (Header -> Value)
                const rawObj: any = {};
                if (Array.isArray(rawData)) {
                    headers.forEach((h: string, i: number) => rawObj[h] = rawData[i]);
                } else {
                    Object.assign(rawObj, rawData);
                }

                // Filter out nulls from Simulated DB Row for cleaner display
                const cleanDb: any = {};
                for (const [k, v] of Object.entries(result.flat)) {
                    if (v !== null && v !== undefined) cleanDb[k] = v;
                }

                // Add Proposed Patches for Display
                const proposedPatches: Record<string, string> = {};
                patches.forEach((v, k) => {
                    proposedPatches[k] = v.targetField;
                });

                // Safe Parse Capture Rate
                let safeRate = 0;
                if (typeof auditResult.summary.captureRate === 'number') safeRate = auditResult.summary.captureRate;
                else if (typeof auditResult.summary.captureRate === 'string') {
                    const parsed = parseFloat((auditResult.summary.captureRate as string).replace('%', ''));
                    if (!isNaN(parsed)) safeRate = parsed > 1 ? parsed / 100 : parsed;
                }

                sampleAnalysis = {
                    container: containerNumber,
                    raw: rawObj,
                    db: cleanDb, // Simulated
                    unmapped: auditResult.unmapped.map(u => u.rawField),
                    captureRate: safeRate,
                    proposedPatches // Inject patches for UI
                };
            }
        }

        // APPLY PATCHES (If any found)
        let patchMsg = "";
        if (patches.size > 0) {
            console.log(`[Auto-Patching] Applying ${patches.size} new mappings derived from audit...`);
            patches.forEach((v, k) => {
                artifact.schemaMapping.fieldMappings[k] = v;
                console.log(`  + Mapped '${k}' -> '${v.targetField}'`);
            });
            fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
            patchMsg = ` (Auto-Patched ${patches.size} missing fields)`;
        }


        console.log(`Audit Preview Complete: ${verifiedCount} Verified / ${discrepancyCount} Issues in Sample.`);

        // If sampleAnalysis is still null (e.g. all audits failed), create a dummy one so UI doesn't spin
        if (!sampleAnalysis && rawRows.length > 0) {
            const row = rawRows[0];
            const rawData = JSON.parse(row.data);
            const headers = row.originalHeaders ? JSON.parse(row.originalHeaders) : [];
            const rawObj: any = {};
            if (Array.isArray(rawData)) headers.forEach((h: string, i: number) => rawObj[h] = rawData[i]);
            else Object.assign(rawObj, rawData);

            sampleAnalysis = {
                container: "Audit Failed (Timeout/Error)",
                raw: rawObj,
                db: {},
                unmapped: [],
                captureRate: 0,
                proposedPatches: {}
            };
        }

        // UPDATE IMPORTLOG WITH AUDITOR METRICS
        console.log('[AUDITOR] Updating ImportLog with discrepancy metrics...');
        await prisma.importLog.update({
            where: { fileName: FILENAME },
            data: {
                discrepanciesFound: discrepancyCount,
                discrepanciesPatched: patches.size
            }
        });

        updateStatus({
            step: 'AUDITOR_COMPLETE',
            progress: 50,
            message: `Audit Complete.${patchMsg} ${discrepancyCount} potential issues found in sample.`,
            agentData: {
                auditor: {
                    verifiedCount,
                    discrepancyCount,
                    sampleAnalysis, // The simplified preview
                    patchedCount: patches.size
                }
            }
        });
        console.log("STEP 3 (Auditor) Complete.");

        return {
            success: true,
            verifiedCount,
            discrepancyCount,
            patchedCount: patches.size
        };

    } catch (error) {
        console.error("Step 3 Failed:", error);
        updateStatus({ step: 'IDLE', progress: 0, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// ✅ Only run as script if called directly (for local spawn)
async function main() {
    await runAuditorStep();
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[Auditor] Error:', err);
        process.exit(1);
    });
}

