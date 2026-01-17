
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'simulation_logs.txt');

function log(msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    process.stdout.write(line);
    fs.appendFileSync(LOG_FILE, line);
}

function runScript(scriptName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        log(`>>> STARTING SCRIPT: ${scriptName}`);

        const child = spawn('npx.cmd', ['tsx', `scripts/${scriptName}`], {
            cwd: process.cwd(),
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        child.stdout.on('data', (data) => {
            const str = data.toString();
            process.stdout.write(str);
            fs.appendFileSync(LOG_FILE, str);
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            process.stderr.write(str);
            fs.appendFileSync(LOG_FILE, str);
        });

        child.on('close', (code) => {
            if (code === 0) {
                log(`>>> SCRIPT COMPLETE: ${scriptName}`);
                resolve();
            } else {
                log(`!!! SCRIPT FAILED: ${scriptName} (Exit Code: ${code})`);
                reject(new Error(`Script ${scriptName} failed with code ${code}`));
            }
        });
    });
}

async function main() {
    // Clear logs
    fs.writeFileSync(LOG_FILE, '');
    log("=== SIMULATION COORDINATOR STARTED ===");

    try {
        await runScript('demo_step_by_step.ts');
        log("--- BASELINE COMPLETE ---\n");

        await runScript('demo_improve.ts');
        log("--- IMPROVEMENT LOOP COMPLETE ---\n");

        log("=== SIMULATION FINISHED SUCCESSFULLY ===");
    } catch (err) {
        log(`FATAL ERROR: ${err}`);
        process.exit(1);
    }
}

main();
