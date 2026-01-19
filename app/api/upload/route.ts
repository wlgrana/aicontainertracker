
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { getUploadPath } from '@/lib/path-utils';

export async function POST(request: Request) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Use path utility to get the correct upload path
        const path = getUploadPath(file.name);

        console.log(`Attempting to upload file ${file.name} to ${path}`);
        await writeFile(path, buffer);
        console.log(`Successfully uploaded file ${file.name} to ${path}`);

        return NextResponse.json({ success: true, filename: file.name });
    } catch (err) {
        console.error('Upload Error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
            success: false,
            message: `Upload failed: ${errorMessage}`,
            error: errorMessage
        }, { status: 500 });
    }
}
