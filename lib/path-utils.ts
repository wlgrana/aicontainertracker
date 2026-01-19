import path from 'path';
import fs from 'fs';

/**
 * Centered utility to manage storage paths across the application.
 * Adapts to Vercel's read-only filesystem by using /tmp when necessary.
 */

const isVercel = process.env.VERCEL === '1';

export function getBaseStoragePath(): string {
    if (isVercel) {
        return '/tmp';
    }
    return process.cwd();
}

export function getUploadPath(filename?: string): string {
    const dir = path.join(getBaseStoragePath(), 'uploads');
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error(`Failed to create upload directory: ${dir}`, e);
        }
    }
    return filename ? path.join(dir, filename) : dir;
}

export function getLogPath(filename?: string): string {
    const dir = path.join(getBaseStoragePath(), 'logs');
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error(`Failed to create log directory: ${dir}`, e);
        }
    }
    return filename ? path.join(dir, filename) : dir;
}

export function getStatusPath(): string {
    return path.join(getBaseStoragePath(), 'simulation_status.json');
}

export function getPidPath(): string {
    return path.join(getBaseStoragePath(), 'simulation_pid.txt');
}
