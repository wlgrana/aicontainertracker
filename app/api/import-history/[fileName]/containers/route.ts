import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileName: string }> }
) {
    try {
        const resolvedParams = await params;
        const fileName = decodeURIComponent(resolvedParams.fileName);

        // Get pagination params from URL
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;

        // Fetch containers for this import
        const [containers, totalCount] = await Promise.all([
            prisma.container.findMany({
                where: { importLogId: fileName },
                orderBy: { containerNumber: 'asc' },
                skip,
                take: limit,
                select: {
                    containerNumber: true,
                    currentStatus: true,
                    statusLastUpdated: true,
                    exceptionType: true,
                    hasException: true,
                    manualPriority: true,
                    lastFreeDay: true,
                    carrier: true,
                    containerType: true,
                    atd: true,
                    eta: true,
                    currentLocation: true,
                    createdAt: true,
                    updatedAt: true,
                    healthScore: true,
                    daysInTransit: true,
                    demurrageExposure: true,
                    aiOperationalStatus: true,
                    aiAttentionCategory: true,
                    businessUnit: true,
                    shipmentContainers: {
                        include: {
                            shipment: {
                                select: {
                                    businessUnit: true,
                                    freightCost: true,
                                    forwarder: true
                                }
                            }
                        }
                    },
                    riskAssessment: {
                        select: {
                            riskScore: true,
                            lastUpdated: true
                        }
                    }
                }
            }),
            prisma.container.count({ where: { importLogId: fileName } })
        ]);

        // Enhance container data (similar to dashboard)
        const enhancedContainers = containers.map(c => {
            const now = new Date();
            const daysAtStage = c.statusLastUpdated
                ? Math.floor((now.getTime() - new Date(c.statusLastUpdated).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            let daysOverFree = 0;
            let estimatedDemurrage = 0;

            if (c.lastFreeDay) {
                const lfd = new Date(c.lastFreeDay);
                if (now > lfd) {
                    daysOverFree = Math.floor((now.getTime() - lfd.getTime()) / (1000 * 60 * 60 * 24));
                    estimatedDemurrage = daysOverFree * 150; // Simple rate
                }
            }

            const businessUnit = c.businessUnit || c.shipmentContainers?.[0]?.shipment?.businessUnit || "Unassigned";
            const freightCost = c.shipmentContainers?.[0]?.shipment?.freightCost || 0;
            const forwarder = c.shipmentContainers?.[0]?.shipment?.forwarder || null;

            return {
                ...c,
                daysAtStage,
                daysOverFree,
                estimatedDemurrage,
                businessUnit,
                freightCost,
                forwarder,
                riskAssessment: c.riskAssessment || null
            };
        });

        return NextResponse.json({
            containers: enhancedContainers,
            totalCount,
            page,
            limit
        });

    } catch (error) {
        console.error('[API] Error fetching import containers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch containers' },
            { status: 500 }
        );
    }
}
