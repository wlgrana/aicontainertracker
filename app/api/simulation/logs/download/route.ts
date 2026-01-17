
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'simulation_logs.txt');
    if (!fs.existsSync(filePath)) {
        return new NextResponse("Log file not found", { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': 'attachment; filename="simulation_logs.txt"',
        },
    });
}
