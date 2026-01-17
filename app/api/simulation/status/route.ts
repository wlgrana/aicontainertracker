
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'simulation_status.json');
    if (!fs.existsSync(filePath)) {
        // Return default idle
        return NextResponse.json({ step: 'IDLE', progress: 0, message: 'Waiting for simulation start...' });
    }

    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(data);
        return NextResponse.json(json, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (e) {
        return NextResponse.json({ step: 'ERROR', progress: 0, message: 'Could not read status' });
    }
}
