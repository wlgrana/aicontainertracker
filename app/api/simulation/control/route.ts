
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PID_FILE = path.join(process.cwd(), 'simulation_pid.txt');
const STATUS_FILE = path.join(process.cwd(), 'simulation_status.json');

export async function POST(req: Request) {
    const { action, filename, containerLimit } = await req.json();


    const spawnStep = (stepArgs: string[]) => {
        if (fs.existsSync(PID_FILE)) {
            try {
                const oldPid = fs.readFileSync(PID_FILE, 'utf-8').trim();
                // Use a simpler kill mechanism or just try-catch
                if (oldPid) process.kill(Number(oldPid), 'SIGKILL');
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }

        console.log("Spawning step:", stepArgs);

        // Use node directly to avoid shell popups on Windows
        const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
        const child = spawn(process.execPath, [tsxPath, 'scripts/run_step.ts', ...stepArgs], {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore', // 'ignore' is crucial for detached on Windows to not pop up
            shell: false,     // Disable shell to prevent cmd.exe popup
            windowsHide: true // Explicitly hide window
        });

        if (child.pid) fs.writeFileSync(PID_FILE, String(child.pid));
        child.unref();
    };

    if (action === 'start') {
        const args = ['1'];
        if (filename) args.push(filename);
        else args.push('Horizon Tracking Report.xlsx'); // No quotes needed for shell: false

        // Pass limit as 3rd arg
        if (containerLimit) args.push(`${containerLimit}`);
        else args.push('all');

        // RESET STATUS IMMEDIATELY to prevent stale data flicker
        try {
            const initialStatus = {
                step: 'ARCHIVIST',
                progress: 0,
                message: 'Initializing Simulation...',
                filename: filename || 'Unknown',
                rowCount: 0,
                agentData: {} // Clear all agent data
            };
            fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
        } catch (e) {
            console.error("Failed to reset status on start:", e);
        }

        if (filename || containerLimit) {
            const logPath = path.join(process.cwd(), 'logs', 'simulation.log');
            if (fs.existsSync(logPath)) {
                const archivePath = path.join(process.cwd(), 'logs', `simulation_${Date.now()}.log`);
                try { fs.renameSync(logPath, archivePath); } catch (e) { }
            }
        }

        spawnStep(args);
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
        if (currentStep === 'TRANSLATOR_REVIEW') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'AUDITOR', message: 'Starting Auditor...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['3']);
            return NextResponse.json({ success: true, message: 'Proceeding to Ingestion (Step 3)...' });
        }
        if (currentStep === 'TRANSLATOR_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'AUDITOR', message: 'Starting Auditor...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['3']);
            return NextResponse.json({ success: true, message: 'Proceeding to Import (Step 3)...' });
        }
        if (currentStep === 'IMPORT_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'IMPROVEMENT', message: 'Starting Improvement...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['5']);
            return NextResponse.json({ success: true, message: 'Proceeding to Improvement (Step 5)...' });
        }
        if (currentStep === 'AUDITOR_COMPLETE') {
            const next = { ...JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8') || '{}'), step: 'IMPORT', message: 'Starting Import...' };
            try { fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2)); } catch (e) { }
            spawnStep(['4']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 4...' });
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
        else if (currentStep.includes('IMPORT')) spawnStep(['3']);
        else if (currentStep.includes('AUDITOR')) spawnStep(['4']);
        else return NextResponse.json({ success: false, message: 'Nothing to re-run.' });

        return NextResponse.json({ success: true, message: 'Re-running step...' });
    }

    if (action === 'clear') {
        if (fs.existsSync(PID_FILE)) {
            try {
                const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
                if (pid) process.kill(Number(pid), 'SIGKILL');
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }
        const tsxPath = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
        spawn(process.execPath, [tsxPath, 'scripts/clear_only.ts'], {
            detached: true,
            stdio: 'ignore',
            shell: false,
            windowsHide: true
        }).unref();
        try { fs.writeFileSync(STATUS_FILE, JSON.stringify({ step: 'IDLE', progress: 0, message: 'Database Cleared' }, null, 2)); } catch (e) { }
        return NextResponse.json({ success: true, message: 'Clearing Database...' });
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
