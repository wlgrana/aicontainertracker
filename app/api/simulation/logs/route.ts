
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'simulation_logs.txt');
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ logs: 'Waiting for log stream generation...' });
    }

    try {
        // Read file
        const logs = fs.readFileSync(filePath, 'utf-8');
        return NextResponse.json({ logs });
    } catch (e) {
        return NextResponse.json({ logs: 'Error accessing log file.' });
    }
}
