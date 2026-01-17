
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to uploads/ directory
        const uploadDir = join(process.cwd(), 'uploads');
        const path = join(uploadDir, file.name);

        // Ensure dir exists (it does based on ls, but safe to check? write doesn't create dirs usually)
        // I'll assume it exists or I'd use mkdir. To be safe, I'm writing directly.

        await writeFile(path, buffer);
        console.log(`Uploaded file ${file.name} to ${path}`);

        return NextResponse.json({ success: true, filename: file.name });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
    }
}
