
import { NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
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
                if (oldPid) spawn('taskkill', ['/PID', oldPid, '/F', '/T'], { stdio: 'ignore' }).unref();
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }

        console.log("Spawning step:", stepArgs);
        const child = spawn('npx', ['tsx', 'scripts/run_step.ts', ...stepArgs], {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore',
            shell: true
        });

        if (child.pid) fs.writeFileSync(PID_FILE, String(child.pid));
        child.unref();
    };

    if (action === 'start') {
        const args = ['1'];
        if (filename) args.push(`"${filename}"`);
        else args.push(`"Horizon Tracking Report.xlsx"`); // Default filename required if we want to pass a 3rd arg

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
            spawnStep(['2']);
            return NextResponse.json({ success: true, message: 'Proceeding to Step 2...' });
        }
        if (currentStep === 'TRANSLATOR_REVIEW') {
            spawnStep(['3']);
            return NextResponse.json({ success: true, message: 'Proceeding to Ingestion (Step 3)...' });
        }
        if (currentStep === 'TRANSLATOR_COMPLETE') {
            spawnStep(['3']);
            return NextResponse.json({ success: true, message: 'Proceeding to Import (Step 3)...' });
        }
        if (currentStep === 'IMPORT_COMPLETE') {
            spawnStep(['5']);
            return NextResponse.json({ success: true, message: 'Proceeding to Improvement (Step 5)...' });
        }
        if (currentStep === 'AUDITOR_COMPLETE') {
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
                if (pid) spawn('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'ignore' }).unref();
            } catch (e) { }
            try { fs.unlinkSync(PID_FILE); } catch (e) { }
        }
        spawn('npx', ['tsx', 'scripts/clear_only.ts'], { shell: true, detached: true, stdio: 'ignore' }).unref();
        try { fs.writeFileSync(STATUS_FILE, JSON.stringify({ step: 'IDLE', progress: 0, message: 'Database Cleared' }, null, 2)); } catch (e) { }
        return NextResponse.json({ success: true, message: 'Clearing Database...' });
    }

    if (action === 'stop') {
        if (fs.existsSync(PID_FILE)) {
            try {
                const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
                if (pid) spawn('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'ignore' }).unref();
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
