
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

        // Format for frontend compatibility
        const files = logs.map(log => ({
            name: `${log.fileName}.log`,
            importLogId: log.fileName,
            time: log.importedOn.getTime(),
            hasLog: !!log.simulationLog,
            size: log.simulationLog ? Buffer.byteLength(log.simulationLog, 'utf8') : 0
        }));

        return NextResponse.json({ files });
    } catch (e) {
        console.error('[API] Failed to list logs:', e);
        return NextResponse.json({ files: [], error: String(e) });
    }
}
