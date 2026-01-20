
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        console.log('[LOG LIST] Fetching logs from database...');

        const logs = await prisma.importLog.findMany({
            select: {
                fileName: true,
                importedOn: true,
                simulationLog: true
            },
            orderBy: { importedOn: 'desc' },
            take: 50
        });

        console.log('[LOG LIST] Found', logs.length, 'logs in database');

        // Log details about each log entry
        logs.forEach((log, index) => {
            console.log(`[LOG LIST] Log ${index + 1}:`, {
                fileName: log.fileName,
                importedOn: log.importedOn,
                hasSimulationLog: !!log.simulationLog,
                simulationLogLength: log.simulationLog?.length || 0
            });
        });

        // Format for frontend compatibility
        const files = logs.map(log => ({
            name: `${log.fileName}.log`,
            importLogId: log.fileName,
            time: log.importedOn.getTime(),
            hasLog: !!log.simulationLog,
            size: log.simulationLog ? Buffer.byteLength(log.simulationLog, 'utf8') : 0
        }));

        console.log('[LOG LIST] Formatted files for frontend:', files.map(f => ({
            name: f.name,
            importLogId: f.importLogId,
            hasLog: f.hasLog,
            size: f.size
        })));

        return NextResponse.json({ files });
    } catch (e) {
        console.error('[API] Failed to list logs:', e);
        return NextResponse.json({ files: [], error: String(e) });
    }
}
