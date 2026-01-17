import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const containerId = params.id;

    try {
        const logs = await prisma.agentProcessingLog.findMany({
            where: { containerId: containerId },
            orderBy: { timestamp: 'desc' },
            include: {
                container: {
                    select: {
                        containerNumber: true,
                        currentStatus: true
                    }
                }
            }
        });

        return Response.json(logs);
    } catch (error) {
        console.error('Failed to fetch processing logs:', error);
        return Response.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
