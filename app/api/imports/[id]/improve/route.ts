
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runImprovementJob } from '@/lib/jobs/batch-improvement-worker';

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Updated for Next.js 15+ async params
) {
    const { id } = await context.params;
    const fileName = decodeURIComponent(id);

    try {
        // Create Job Record
        const job = await prisma.improvementJob.create({
            data: {
                importLogId: fileName,
                status: 'QUEUED',
                progress: 0
            }
        });

        // Trigger worker asynchronously (FIRE AND FORGET)
        // Note: In Vercel serverless, this might be killed if function returns?
        // Ideally use Inngest or simple fetch to another endpoint, or await if feasible (but long running).
        // For MVP local/basic, we just call the function without await.
        // To prevent immediate kill in some envs, `waitUntil` is useful if available.
        // But here we'll just fire it.
        runImprovementJob(job.id).catch(err => {
            console.error("Background job error:", err);
        });

        return NextResponse.json({ jobId: job.id, status: 'STARTED' });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to start improvement job:", errorMessage);
        return NextResponse.json({ error: "Failed to start job", details: errorMessage }, { status: 500 });
    }
}
