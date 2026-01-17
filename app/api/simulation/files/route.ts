
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const testDataDir = path.join(process.cwd(), 'testdata');
        if (!fs.existsSync(testDataDir)) {
            return NextResponse.json({ files: [] });
        }

        const files = fs.readdirSync(testDataDir).filter(file =>
            !file.startsWith('.') && (file.endsWith('.xlsx') || file.endsWith('.xls') || file.endsWith('.csv'))
        );

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error listing test files:', error);
        return NextResponse.json({ files: [], error: 'Failed to list files' }, { status: 500 });
    }
}
