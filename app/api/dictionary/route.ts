import { NextResponse } from 'next/server';
import { getAllHeaderMappings, deleteHeaderMapping } from '@/lib/dictionary-helper';

export async function GET() {
    try {
        const mappings = await getAllHeaderMappings();
        return NextResponse.json({ mappings });
    } catch (error) {
        console.error('[API] Error fetching header mappings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch header mappings' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'Mapping ID is required' },
                { status: 400 }
            );
        }

        await deleteHeaderMapping(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting header mapping:', error);
        return NextResponse.json(
            { error: 'Failed to delete header mapping' },
            { status: 500 }
        );
    }
}
