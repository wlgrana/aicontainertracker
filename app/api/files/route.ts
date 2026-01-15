import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const files = await prisma.importLog.findMany({
        orderBy: { importedOn: 'desc' }
    });
    return NextResponse.json(files);
}
