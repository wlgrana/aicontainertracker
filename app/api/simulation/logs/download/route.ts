
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename') || 'simulation.log';

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return new NextResponse("Invalid filename", { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'logs', filename);

    if (!fs.existsSync(filePath)) {
        return new NextResponse("Log file not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
