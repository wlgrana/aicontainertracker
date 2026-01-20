
import { NextResponse } from 'next/server';
import { listLogs } from '@/lib/log-stream';

export async function GET() {
    try {
        const logs = await listLogs();

        // Format for frontend compatibility
        const files = logs.map(log => ({
            name: `${log.fileName}.log`,
            importLogId: log.fileName,
            time: log.importedOn.getTime(),
            hasLog: log.hasLog
        }));

        return NextResponse.json({ files });
    } catch (e) {
        console.error('[API] Failed to list logs:', e);
        return NextResponse.json({ files: [], error: String(e) });
    }
}
