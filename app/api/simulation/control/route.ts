
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getStatusPath, getPidPath, getArtifactPath } from '@/lib/path-utils';

const PID_FILE = getPidPath();
const STATUS_FILE = getStatusPath();
const IS_VERCEL = process.env.VERCEL === '1';

export async function POST(req: Request) {
    console.log('=== SIMULATION CONTROL CALLED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Environment:', {
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        NODE_ENV: process.env.NODE_ENV,
        isVercel: IS_VERCEL,
        nodeVersion: process.version
    });

    let body;
    try {
        body = await req.json();
        console.log('Request body:', JSON.stringify(body, null, 2));
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { action, filename, containerLimit, enrichEnabled, forwarder } = body;
    console.log('Parsed params:', { action, filename, containerLimit, enrichEnabled, forwarder });

    // ========================================
    // VERCEL INLINE EXECUTION
    // ========================================
    if (IS_VERCEL) {
        console.log('[VERCEL MODE] Running steps inline (blocking)');

        if (action === 'start') {
            console.log('[VERCEL] Starting Step 1 (Archivist) inline...');

            // Reset status
            const timestamp = Date.now();
            const baseFilename = (filename || 'unknown').replace(/\.xlsx$/i, '').replace(/[^a-z0-9_-]/gi, '_');
            const invocationMethod = 'FRONTEND';
            const logFilename = `${baseFilename}_${invocationMethod}_${timestamp}.log`;

            try {
                const initialStatus = {
                    step: 'ARCHIVIST',
                    progress: 0,
                    message: 'Initializing Simulation...',
                    filename: filename || 'Unknown',
                    rowCount: 0,
                    agentData: {},
                    enrichEnabled: !!enrichEnabled,
                    forwarder: forwarder || null,
                    logFilename: logFilename
                };
                fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
            } catch (e) {
                console.error('[VERCEL] Failed to reset status:', e);
                return NextResponse.json({
                    success: false,
                    error: `Failed to initialize: ${e instanceof Error ? e.message : String(e)}`
                }, { status: 500 });
            }

            // Import and run Step 1 inline
            try {
                const { runArchivistStep } = await import('@/scripts/step1_archivist');
                const result = await runArchivistStep({
                    filename: filename || 'Horizon Tracking Report.xlsx',
                    rowLimit: containerLimit && containerLimit !== 'all' ? parseInt(containerLimit, 10) : undefined,
                    forwarder: forwarder || undefined
                });
                console.log('[VERCEL] Step 1 completed:', result);
                return NextResponse.json({ success: true, message: 'Step 1 Complete', result });
            } catch (error) {
                console.error('[VERCEL] Step 1 failed:', error);
                return NextResponse.json({
                    success: false,
                    error: `Step 1 failed: ${error instanceof Error ? error.message : String(error)}`
                }, { status: 500 });
            }
        }

        if (action === 'proceed') {
            let currentStep = 'IDLE';
            try {
                const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
                currentStep = status.step;
            } catch (e) {
                console.error('[VERCEL] Failed to read status:', e);
            }

            console.log('[VERCEL] Current step:', currentStep);

            try {
                if (currentStep === 'ARCHIVIST_COMPLETE') {
                    console.log('[VERCEL] Running Step 2 (Translator) inline...');
                    const { runTranslatorStep } = await import('@/scripts/step2_translator');
                    const result = await runTranslatorStep();
                    console.log('[VERCEL] Step 2 completed:', result);
                    return NextResponse.json({ success: true, message: 'Step 2 Complete', result });
                }

                if (currentStep === 'TRANSLATOR_REVIEW' || currentStep === 'TRANSLATOR_COMPLETE') {
                    console.log('[VERCEL] Running Step 3 (Auditor) inline...');
                    const { runAuditorStep } = await import('@/scripts/step3_auditor');
                    const result = await runAuditorStep();
                    console.log('[VERCEL] Step 3 completed:', result);
                    return NextResponse.json({ success: true, message: 'Step 3 Complete', result });
                }

                if (currentStep === 'AUDITOR_COMPLETE') {
                    console.log('[VERCEL] Running Step 4 (Importer) inline...');
                    const { runImporterStep } = await import('@/scripts/step4_importer');
                    const result = await runImporterStep();
                    console.log('[VERCEL] Step 4 completed:', result);
                    return NextResponse.json({ success: true, message: 'Step 4 Complete', result });
                }

                if (currentStep === 'IMPORT_COMPLETE') {
                    // Skip Step 5 (Learner) on Vercel - requires filesystem writes
                    console.log('[VERCEL] Skipping Step 5 (Learner) - filesystem writes not supported');

                    // Mark as complete and skip to finish
                    try {
                        const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
                        const next = {
                            ...current,
                            step: 'COMPLETE',
                            progress: 100,
                            message: 'Import Complete (Learner skipped on Vercel)'
                        };
                        fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
                    } catch (e) {
                        console.error('[VERCEL] Failed to update status:', e);
                    }

                    return NextResponse.json({
                        success: true,
                        message: 'Import Complete (Step 5 skipped - not supported on Vercel)',
                        note: 'Dictionary learning requires local filesystem access'
                    });
                }

                return NextResponse.json({ success: false, message: 'Cannot proceed from current state.' });
            } catch (error) {
                console.error('[VERCEL] Step failed:', error);
                return NextResponse.json({
                    success: false,
                    error: `Step failed: ${error instanceof Error ? error.message : String(error)}`
                }, { status: 500 });
            }
        }

        if (action === 'finish') {
            try {
                const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
                const next = { ...current, step: 'COMPLETE', progress: 100, message: 'Simulation Finished.' };
                fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
            } catch (e) {
                console.error('[VERCEL] Failed to finish:', e);
            }
            return NextResponse.json({ success: true, message: 'Simulation Finished.' });
        }

        if (action === 'stop') {
            try {
                const current = fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) : {};
                const next = { ...current, step: 'IDLE', message: 'Simulation Stopped', progress: 0 };
                fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
            } catch (e) {
                console.error('[VERCEL] Failed to stop:', e);
            }
            return NextResponse.json({ success: true, message: 'Simulation Stopped' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // ========================================
    // LOCAL SPAWN EXECUTION (Original Logic)
    // ========================================
    console.log('[LOCAL MODE] Using spawn for background execution');

    const spawnStep = (stepArgs: string[]) => {
        if (fs.existsSync(PID_FILE)) {
            try {
                const oldPid = fs.readFileSync(PID_FILE, 'utf-8').trim();
                if (oldPid) process.kill(Number(oldPid), 'SIGKILL');
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }

        console.log("Spawning step:", stepArgs);

        const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
        const child = spawn(process.execPath, [tsxPath, 'scripts/run_step.ts', ...stepArgs], {
            cwd: process.cwd(),
            detached: false,
            stdio: 'ignore',
            shell: false,
            windowsHide: true,
            env: {
                ...process.env,
                INVOKED_BY: 'FRONTEND'
            }
        });

        if (child.pid) fs.writeFileSync(PID_FILE, String(child.pid));
        child.unref();
    };

    if (action === 'start') {
        console.log('[START] Initiating simulation...');
        const args = ['1'];
        if (filename) args.push(filename);
        else args.push('Horizon Tracking Report.xlsx');

        if (containerLimit) args.push(`${containerLimit}`);
        else args.push('all');

        if (forwarder) args.push(forwarder);
        else args.push('null');

        console.log('[START] Args prepared:', args);

        const timestamp = Date.now();
        const baseFilename = (filename || 'unknown').replace(/\.xlsx$/i, '').replace(/[^a-z0-9_-]/gi, '_');
        const invocationMethod = 'FRONTEND';
        const logFilename = `${baseFilename}_${invocationMethod}_${timestamp}.log`;

        console.log('[START] Generated log filename:', logFilename);

        try {
            const initialStatus = {
                step: 'ARCHIVIST',
                progress: 0,
                message: 'Initializing Simulation...',
                filename: filename || 'Unknown',
                rowCount: 0,
                agentData: {},
                enrichEnabled: !!enrichEnabled,
                forwarder: forwarder || null,
                logFilename: logFilename
            };
            console.log('[START] Writing initial status:', JSON.stringify(initialStatus, null, 2));
            fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
            console.log('[START] Status file written successfully');
        } catch (e) {
            console.error('[START] Failed to reset status on start:', e);
            console.error('[START] Error stack:', e instanceof Error ? e.stack : 'No stack');
            return NextResponse.json({
                success: false,
                error: `Failed to initialize: ${e instanceof Error ? e.message : String(e)}`,
                stack: e instanceof Error ? e.stack : undefined
            }, { status: 500 });
        }

        console.log('[START] About to spawn step with args:', args);
        try {
            spawnStep(args);
            console.log('[START] Step spawned successfully');
        } catch (e) {
            console.error('[START] Failed to spawn step:', e);
            console.error('[START] Error stack:', e instanceof Error ? e.stack : 'No stack');
            return NextResponse.json({
                success: false,
                error: `Failed to spawn process: ${e instanceof Error ? e.message : String(e)}`,
                stack: e instanceof Error ? e.stack : undefined
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `Simulation Started (Step 1) with ${filename || 'default'}` });
    }

    if (action === 'proceed') {
        let currentStep = 'IDLE';
        try {
            const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            currentStep = status.step;
        } catch (e) { }

        if (currentStep === 'ARCHIVIST_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'TRANSLATOR', message: 'Starting Translator...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['2']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 2...' });
        }
        if (currentStep === 'TRANSLATOR_REVIEW' || currentStep === 'TRANSLATOR_COMPLETE') {

            // MANUAL MAPPING OVERRIDE
            if (body.mappings && Object.keys(body.mappings).length > 0) {
                console.log('[PROCEED] Applying manual mappings:', JSON.stringify(body.mappings));
                try {
                    const artifactPath = getArtifactPath('temp_translation.json');
                    if (fs.existsSync(artifactPath)) {
                        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

                        // Apply patches to fieldMappings
                        const fieldMappings = artifact.schemaMapping.fieldMappings || {};

                        for (const [sourceHeader, targetField] of Object.entries(body.mappings)) {
                            // If it exists, update it
                            if (fieldMappings[sourceHeader]) {
                                fieldMappings[sourceHeader].targetField = targetField;
                                fieldMappings[sourceHeader].confidence = 1.0;
                                fieldMappings[sourceHeader].notes = 'Manual Override';
                            } else {
                                // If it was unmapped, create new entry
                                fieldMappings[sourceHeader] = {
                                    sourceHeader: sourceHeader,
                                    targetField: targetField,
                                    confidence: 1.0,
                                    notes: 'Manual Override (New)'
                                };
                            }

                            // Remove from unmappedSourceFields if present
                            if (artifact.schemaMapping.unmappedSourceFields) {
                                artifact.schemaMapping.unmappedSourceFields = artifact.schemaMapping.unmappedSourceFields.filter(
                                    (u: any) => u.sourceHeader !== sourceHeader
                                );
                            }
                        }

                        artifact.schemaMapping.fieldMappings = fieldMappings;
                        fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
                        console.log('[PROCEED] Artifact updated with manual mappings.');
                    } else {
                        console.warn('[PROCEED] Artifact not found at', artifactPath);
                    }
                } catch (e) {
                    console.error('[PROCEED] Failed to apply manual mappings:', e);
                    // Non-fatal, proceed anyway but log error
                }
            }

            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'AUDITOR', message: 'Starting Auditor...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['3']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 3...' });
        }
        if (currentStep === 'AUDITOR_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'IMPORT', message: 'Starting Import...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['4']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 4...' });
        }
        if (currentStep === 'IMPORT_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'IMPROVEMENT', message: 'Starting Improvement...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['5']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 5...' });
        }
        return NextResponse.json({ success: false, message: 'Cannot proceed from current state.' });
    }

    if (action === 'finish') {
        try {
            const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            const next = { ...current, step: 'COMPLETE', progress: 100, message: 'Simulation Finished.' };
            fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
        } catch (e) { }
        return NextResponse.json({ success: true, message: 'Simulation Finished.' });
    }

    if (action === 'rerun') {
        let currentStep = 'IDLE';
        try {
            const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            currentStep = status.step;
        } catch (e) { }

        if (currentStep.includes('ARCHIVIST')) spawnStep(['1']);
        else if (currentStep.includes('TRANSLATOR')) spawnStep(['2']);
        else if (currentStep.includes('AUDITOR')) spawnStep(['3']);
        else if (currentStep.includes('IMPORT')) spawnStep(['4']);
        else if (currentStep.includes('IMPROVEMENT')) spawnStep(['5']);
        else return NextResponse.json({ success: false, message: 'Nothing to re-run.' });

        return NextResponse.json({ success: true, message: 'Re-running step...' });
    }

    if (action === 'stop') {
        if (fs.existsSync(PID_FILE)) {
            try {
                const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
                if (pid) process.kill(Number(pid), 'SIGKILL');
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }
        try {
            const current = fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) : {};
            const next = { ...current, step: 'IDLE', message: 'Simulation Stopped', progress: 0 };
            fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
        } catch (e) { }
        return NextResponse.json({ success: true, message: 'Process Killed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
