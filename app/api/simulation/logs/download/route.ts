
import { NextRequest, NextResponse } from 'next/server';
import { getLogContent } from '@/lib/log-stream';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const importLogId = searchParams.get('importLogId');

    console.log('[LOG DOWNLOAD] Request received');
    console.log('[LOG DOWNLOAD] importLogId parameter:', importLogId);
    console.log('[LOG DOWNLOAD] Full URL:', req.url);

    if (!importLogId) {
        console.error('[LOG DOWNLOAD] Missing importLogId parameter');
        return new NextResponse("Missing importLogId parameter", { status: 400 });
    }

    // Security: Basic validation
    if (importLogId.includes('..') || importLogId.includes('/') || importLogId.includes('\\')) {
        console.error('[LOG DOWNLOAD] Invalid importLogId (security check failed):', importLogId);
        return new NextResponse("Invalid importLogId", { status: 400 });
    }

    console.log('[LOG DOWNLOAD] Fetching log content for:', importLogId);

    // Get log content from database
    const logContent = await getLogContent(importLogId);

    console.log('[LOG DOWNLOAD] Log content length:', logContent.length);
    console.log('[LOG DOWNLOAD] Log content preview:', logContent.substring(0, 100));

    if (logContent.startsWith('Error') || logContent.startsWith('Log not available')) {
        console.error('[LOG DOWNLOAD] Log retrieval failed:', logContent);
        return new NextResponse(logContent, { status: 404 });
    }

    console.log('[LOG DOWNLOAD] Successfully returning log content');
    return new NextResponse(logContent, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${importLogId}.log"`,
        },
    });
}
