import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const fileName = decodeURIComponent(id);

        const importLog = await prisma.importLog.findUnique({
            where: { fileName },
        });

        if (!importLog) {
            return NextResponse.json(
                { error: 'Import log not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(importLog);
    } catch (error) {
        console.error('[API] Error fetching import log:', error);
        return NextResponse.json(
            { error: 'Failed to fetch import log' },
            { status: 500 }
        );
    }
}
