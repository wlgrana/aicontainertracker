
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    try {
        const job = await prisma.improvementJob.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                progress: true,
                startedAt: true,
                completedAt: true,
                error: true,
                improvementsApplied: true,
                finalCaptureRate: true
            }
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json(job);

    } catch (error) {
        console.error("Failed to fetch job:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
