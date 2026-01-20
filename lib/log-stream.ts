import { prisma } from './prisma';
import fs from 'fs';
import { getLogPath } from './path-utils';

/**
 * Unified log streaming utility.
 * ALWAYS writes to database, optionally writes to filesystem in development.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export class LogStream {
    private logFilename: string;
    private importLogId: string;
    private buffer: string[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private fileStream: fs.WriteStream | null = null;

    constructor(logFilename: string, importLogId: string) {
        this.logFilename = logFilename;
        this.importLogId = importLogId;

        // Optional: Create file stream for local debugging
        if (isDevelopment) {
            try {
                const logPath = getLogPath(logFilename);
                this.fileStream = fs.createWriteStream(logPath, { flags: 'a' });
            } catch (e) {
                console.warn('[LogStream] Could not create file stream:', e);
            }
        }

        // Flush to database periodically (all environments)
        this.flushInterval = setInterval(() => this.flushToDatabase(), 3000);
    }

    write(content: string) {
        // Optional: Write to file for local debugging
        if (this.fileStream) {
            try {
                this.fileStream.write(content);
            } catch (e) {
                console.warn('[LogStream] File write failed:', e);
            }
        }

        // Buffer for database write (always)
        this.buffer.push(content);
    }

    private async flushToDatabase() {
        if (this.buffer.length === 0) return;

        const content = this.buffer.join('');
        this.buffer = [];

        try {
            // Append to existing log in database
            const currentLog = await this.getCurrentLog();
            await prisma.importLog.update({
                where: { fileName: this.importLogId },
                data: {
                    simulationLog: currentLog + content
                }
            });
        } catch (e) {
            console.error('[LogStream] Failed to flush to database:', e);
            // Put content back in buffer to retry
            this.buffer.unshift(content);
        }
    }

    private async getCurrentLog(): Promise<string> {
        try {
            const log = await prisma.importLog.findUnique({
                where: { fileName: this.importLogId },
                select: { simulationLog: true }
            });
            return log?.simulationLog || '';
        } catch (e) {
            return '';
        }
    }

    async close() {
        // Final flush to database
        await this.flushToDatabase();

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }

        // Close file stream if exists
        if (this.fileStream) {
            this.fileStream.end();
        }
    }
}

/**
 * Get log content - ALWAYS from database
 */
export async function getLogContent(importLogId: string): Promise<string> {
    console.log('[getLogContent] Attempting to retrieve log for importLogId:', importLogId);

    try {
        const log = await prisma.importLog.findUnique({
            where: { fileName: importLogId },
            select: { simulationLog: true }
        });

        console.log('[getLogContent] Query result:', {
            found: !!log,
            hasSimulationLog: !!log?.simulationLog,
            simulationLogLength: log?.simulationLog?.length || 0
        });

        if (!log) {
            console.warn('[getLogContent] No ImportLog record found with fileName:', importLogId);
            return 'Log not available yet. The simulation may still be initializing.';
        }

        if (!log.simulationLog) {
            console.warn('[getLogContent] ImportLog found but simulationLog is null/empty');
            return 'Log not available yet. The simulation may still be initializing.';
        }

        console.log('[getLogContent] Successfully retrieved log, length:', log.simulationLog.length);
        return log.simulationLog;
    } catch (e) {
        console.error('[getLogContent] Database error:', e);
        return `Error reading log from database: ${e}`;
    }
}

/**
 * List all available logs from database
 */
export async function listLogs(): Promise<Array<{ fileName: string; importedOn: Date; hasLog: boolean }>> {
    try {
        const logs = await prisma.importLog.findMany({
            select: {
                fileName: true,
                importedOn: true,
                simulationLog: true
            },
            orderBy: { importedOn: 'desc' },
            take: 50
        });

        return logs.map(log => ({
            fileName: log.fileName,
            importedOn: log.importedOn,
            hasLog: !!log.simulationLog
        }));
    } catch (e) {
        console.error('[LogStream] Failed to list logs:', e);
        return [];
    }
}
