
import { NextRequest, NextResponse } from 'next/server';
import { getLogContent } from '@/lib/log-stream';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const importLogId = searchParams.get('importLogId');

    if (!importLogId) {
        return new NextResponse("Missing importLogId parameter", { status: 400 });
    }

    // Security: Basic validation
    if (importLogId.includes('..') || importLogId.includes('/') || importLogId.includes('\\')) {
        return new NextResponse("Invalid importLogId", { status: 400 });
    }

    // Get log content from database
    const logContent = await getLogContent(importLogId);

    if (logContent.startsWith('Error') || logContent.startsWith('Log not available')) {
        return new NextResponse(logContent, { status: 404 });
    }

    return new NextResponse(logContent, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${importLogId}.log"`,
        },
    });
}
