
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const logsDir = path.join(process.cwd(), 'logs');

    if (!fs.existsSync(logsDir)) {
        return NextResponse.json({ files: [] });
    }

    try {
        const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log') || f.endsWith('.txt'));
        // Sort by modification time desc
        const sortedFiles = files.map(file => {
            const stats = fs.statSync(path.join(logsDir, file));
            return { name: file, time: stats.mtime.getTime(), size: stats.size };
        }).sort((a, b) => b.time - a.time);

        return NextResponse.json({ files: sortedFiles });
    } catch (e) {
        return NextResponse.json({ files: [], error: String(e) });
    }
}
