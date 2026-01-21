"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createContainer(formData: FormData) {
    const containerNumber = formData.get("containerNumber") as string;
    const containerType = formData.get("containerType") as string;
    const size = formData.get("size") as string; // We don't have a specific `size` field in 15-table schema? 
    // Wait, Schema has `containerType`. Often "40HC" is type.
    // The table has: containerNumber, containerType.
    // "size" isn't in the 15-table spec for Container table explicitly? 
    // Table 2: ContainerNumber, ContainerType... no separate Size field. Type usually covers it (e.g. 40HC).

    const carrier = formData.get("carrier") as string;

    if (!containerNumber) return { error: "Container number required" };

    try {
        await prisma.container.create({
            data: {
                containerNumber,
                containerType,
                carrier, // Text field as per bootstrap plan
                currentStatus: 'BOOK', // currentStatus is just a String FK in the new schema, so this is valid.
                statusLastUpdated: new Date(),
            }
        });

        // Create initial event
        await prisma.containerEvent.create({
            data: {
                containerId: containerNumber,
                stageName: 'BOOK',
                eventDateTime: new Date(),
                source: 'ManualEntry',
                notes: 'Created via Manual Entry'
            }
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: "Failed to create: " + e.message };
    }
}

export async function createShipment(formData: FormData) {
    const shipmentReference = formData.get("shipmentReference") as string;
    const hbl = formData.get("hbl") as string;
    const carrier = formData.get("carrier") as string;
    const forwarder = formData.get("forwarder") as string;

    if (!shipmentReference) return { error: "Ref required" };

    try {
        await prisma.shipment.create({
            data: {
                shipmentReference,
                hbl,
                carrier,
                forwarder
            }
        });
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: "Failed to create: " + e.message };
    }
}

export async function getDashboardData(
    page: number = 1,
    limit: number = 50,
    search: string = "",
    status: string = "",
    forwarder: string = "",
    businessUnit: string = ""
) {
    try {
        const skip = (page - 1) * limit;

        // Build Where Input for Search/Filter
        const where: any = {};

        if (search) {
            where.OR = [
                { containerNumber: { contains: search, mode: 'insensitive' } },
                { carrier: { contains: search, mode: 'insensitive' } },
                { currentStatus: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Status Filter
        if (status && status !== 'all') {
            if (status === 'exceptions') {
                where.hasException = true;
            } else if (status === 'in_transit') {
                // filter for active shipments (not delivered/completed)
                // Explicitly include NULL (unknown) status as active, as 'notIn' excludes nulls
                if (!where.AND) where.AND = [];
                where.AND.push({
                    OR: [
                        { currentStatus: { notIn: ['DEL', 'DELIVERED', 'COMPLETED', 'MTY', 'RET', 'EMPTY_RETURN'] } },
                        { currentStatus: null }
                    ]
                });
            } else {
                where.currentStatus = status;
            }
        }

        // Forwarder Filter
        if (forwarder && forwarder !== 'all') {
            where.shipmentContainers = {
                some: {
                    shipment: {
                        forwarder: { contains: forwarder, mode: 'insensitive' }
                    }
                }
            };
        }

        // Business Unit Filter
        if (businessUnit && businessUnit !== 'all') {
            // Merge with existing shipmentContainers filter if simpler, or just add logic
            // If forwarder is also present, we need to be careful not to overwrite `shipmentContainers`
            if (where.shipmentContainers) {
                // Merge into existing `some.shipment`
                where.shipmentContainers.some.shipment.businessUnit = { contains: businessUnit, mode: 'insensitive' };
            } else {
                where.shipmentContainers = {
                    some: {
                        shipment: {
                            businessUnit: { contains: businessUnit, mode: 'insensitive' }
                        }
                    }
                };
            }
        }

        // 1. Get Attention Items (Always fetch top criticals regardless of page, or keep separate?)
        // For dashboard "Action Items" view, it likely needs its own query.
        // Assuming 'attention' tab is separate query in future, but for now we keep it.
        const attention = await prisma.container.findMany({
            where: { hasException: true },
            select: {
                containerNumber: true,
                currentStatus: true,
                statusLastUpdated: true,
                exceptionType: true,
                exceptionOwner: true,
                lastFreeDay: true,
                carrier: true,
                containerType: true,
                currentLocation: true,
                createdAt: true,
                updatedAt: true,
                hasException: true,
                manualPriority: true
            },
            orderBy: { manualPriority: 'desc' },
            take: 20 // Limit attention items to top 20
        });

        // 2. Get Paginated Containers
        const totalCount = await prisma.container.count({ where });

        // Calculate Global Stats
        const totalExceptions = await prisma.container.count({ where: { hasException: true } });
        const inTransitCount = await prisma.container.count({
            where: {
                currentStatus: { in: ['DEP', 'HSEA'] }
            }
        });

        // 3. Calculate Global Demurrage (Optimized for active risks)
        const potentialDemurrage = await prisma.container.findMany({
            where: {
                lastFreeDay: { lt: new Date() },
            },
            select: {
                lastFreeDay: true,
                carrier: true,
                containerType: true
            }
        });

        let totalDemurrage = 0;
        if (potentialDemurrage.length > 0) {
            const rates = await prisma.demurrageRate.findMany();
            const now = new Date();

            for (const c of potentialDemurrage) {
                if (!c.lastFreeDay) continue;
                const lfd = new Date(c.lastFreeDay);
                const daysOver = Math.floor((now.getTime() - lfd.getTime()) / (1000 * 60 * 60 * 24));

                if (daysOver > 0) {
                    const rate = rates.find(r => r.carrierId === c.carrier && r.containerType === c.containerType);
                    if (rate && rate.dailyRate) {
                        totalDemurrage += daysOver * rate.dailyRate;
                    }
                }
            }
        }

        const rawContainers = await prisma.container.findMany({
            where,
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
                // AI Fields
                healthScore: true,
                daysInTransit: true,
                demurrageExposure: true,
                aiOperationalStatus: true, // NEW
                aiAttentionCategory: true, // NEW
                businessUnit: true, // NEW: Ensure we fetch this!
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
        });

        // Logic to enhance container data with calculations
        const enhanceContainer = async (c: any) => {
            const now = new Date();
            const daysAtStage = c.statusLastUpdated
                ? Math.floor((now.getTime() - new Date(c.statusLastUpdated).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            let daysOverFree = 0;
            let estimatedDemurrage = 0;
            let dailyRate = 0;

            if (c.lastFreeDay) {
                const lfd = new Date(c.lastFreeDay);
                if (now > lfd) {
                    daysOverFree = Math.floor((now.getTime() - lfd.getTime()) / (1000 * 60 * 60 * 24));

                    // Simple demo rate logic if DB rates missing
                    dailyRate = 150;
                    estimatedDemurrage = daysOverFree * dailyRate;

                    // Try to get actual rate
                    // const rate = await prisma.demurrageRate.findFirst({...});
                }
            }

            // Extract extended fields
            const businessUnit = c.businessUnit || c.shipmentContainers?.[0]?.shipment?.businessUnit || "Unassigned";
            const freightCost = c.shipmentContainers?.[0]?.shipment?.freightCost || 0;
            const forwarder = c.shipmentContainers?.[0]?.shipment?.forwarder || null;
            const riskAssessment = c.riskAssessment || null;

            return {
                ...c,
                daysAtStage,
                daysOverFree,
                estimatedDemurrage,
                dailyRate,
                businessUnit,
                freightCost,
                forwarder,
                riskAssessment
            };
        };

        // Enhance with calculations
        const enhancedAttention = await Promise.all(attention.map(enhanceContainer));
        const enhancedContainers = await Promise.all(rawContainers.map(enhanceContainer));

        console.log(`Fetched ${enhancedContainers.length} containers (Page ${page}, Total ${totalCount})`);

        return {
            attention: enhancedAttention,
            containers: enhancedContainers,
            totalCount,
            stats: {
                totalExceptions,
                inTransitCount,
                totalDemurrage
            },
            error: null
        };
    } catch (e: any) {
        console.error("Failed to fetch dashboard data:", e);
        return {
            attention: [],
            containers: [],
            totalCount: 0,
            stats: { totalExceptions: 0, inTransitCount: 0, totalDemurrage: 0 },
            error: "Failed to load dashboard data: " + e.message
        };
    }
}

export async function getContainerDetails(id: string) {
    if (!id) return null;

    try {
        const container = await prisma.container.findUnique({
            where: { containerNumber: id },
            include: {
                events: {
                    orderBy: { eventDateTime: 'desc' },
                    include: {
                        stage: true
                    }
                },
                shipmentContainers: {
                    include: {
                        shipment: {
                            include: {
                                shipmentEvents: { orderBy: { eventDateTime: 'desc' } }
                            }
                        }
                    }
                },
                attentionFlags: {
                    where: { resolved: false },
                    orderBy: { flaggedOn: 'desc' }
                },
                activityLogs: {
                    orderBy: { createdAt: 'desc' }
                },
                statusOverrides: {
                    orderBy: { overriddenAt: 'desc' }
                }
            }
        });

        if (!container) return null;

        // Fetch Raw Row Data if linked
        let rawRowData = null;
        const meta = container.metadata as any;
        if (meta && meta._internal && meta._internal.rawRowId) {
            try {
                const rawRow = await prisma.rawRow.findUnique({
                    where: { id: meta._internal.rawRowId }
                });
                if (rawRow && rawRow.data) {
                    rawRowData = JSON.parse(rawRow.data);
                }
            } catch (e) {
                console.error('Error fetching raw row data:', e);
            }
        }

        // Serialize all dates and complex objects to ensure they're safe for Server Components
        const serializedContainer = JSON.parse(JSON.stringify({
            ...container,
            rawRowData,
            // Ensure all dates are properly serialized
            createdAt: container.createdAt?.toISOString(),
            updatedAt: container.updatedAt?.toISOString(),
            statusLastUpdated: container.statusLastUpdated?.toISOString(),
            atd: container.atd?.toISOString(),
            eta: container.eta?.toISOString(),
            ata: container.ata?.toISOString(),
            etd: container.etd?.toISOString(),
            lastFreeDay: container.lastFreeDay?.toISOString(),
            gateOutDate: container.gateOutDate?.toISOString(),
            deliveryDate: container.deliveryDate?.toISOString(),
            emptyReturnDate: container.emptyReturnDate?.toISOString(),
            finalDestinationEta: container.finalDestinationEta?.toISOString(),
            // Serialize events
            events: container.events?.map(event => ({
                ...event,
                eventDateTime: event.eventDateTime?.toISOString()
            })) || [],
            // Serialize shipment containers
            shipmentContainers: container.shipmentContainers?.map(sc => ({
                ...sc,
                shipment: sc.shipment ? {
                    ...sc.shipment,
                    bookingDate: sc.shipment.bookingDate?.toISOString(),
                    shipmentEvents: sc.shipment.shipmentEvents?.map(se => ({
                        ...se,
                        eventDateTime: se.eventDateTime?.toISOString()
                    })) || []
                } : null
            })) || [],
            // Serialize attention flags
            attentionFlags: container.attentionFlags?.map(flag => ({
                ...flag,
                flaggedOn: flag.flaggedOn?.toISOString(),
                resolvedDate: flag.resolvedDate?.toISOString()
            })) || [],
            // Serialize activity logs
            activityLogs: container.activityLogs?.map(log => ({
                ...log,
                createdAt: log.createdAt?.toISOString()
            })) || [],
            // Serialize status overrides
            statusOverrides: container.statusOverrides?.map(override => ({
                ...override,
                overriddenAt: override.overriddenAt?.toISOString()
            })) || []
        }));

        return serializedContainer;
    } catch (error) {
        console.error('Error fetching container details:', error);
        // Return null instead of throwing to prevent Server Components error
        return null;
    }
}

export async function getTransitStages() {
    return await prisma.transitStage.findMany({
        where: { isActive: true },
        orderBy: { sequence: 'asc' }
    });
}
