"use server";

import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

import { getDirectorState } from "@/lib/agents/director";

export async function exportContainerData(
    search: string = "",
    status: string = "",
    forwarder: string = "",
    businessUnit: string = "",
    healthFilter: string = "all"
) {
    try {
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
            // If forwarder filter already exists, merge BU into the same shipment filter
            if (where.shipmentContainers) {
                where.shipmentContainers.some.shipment = {
                    ...where.shipmentContainers.some.shipment,
                    businessUnit: { contains: businessUnit, mode: 'insensitive' }
                };
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

        // Fetch ALL matching containers (no pagination)
        let rawContainers = await prisma.container.findMany({
            where,
            orderBy: { containerNumber: 'asc' },
            select: {
                containerNumber: true,
                currentStatus: true,
                containerType: true,
                carrier: true,
                atd: true,
                eta: true,
                daysInTransit: true,
                lastFreeDay: true,
                statusLastUpdated: true,
                currentLocation: true,
                hasException: true,
                exceptionType: true,
                aiOperationalStatus: true,
                aiAttentionCategory: true,
                businessUnit: true,
                gateOutDate: true,
                emptyReturnDate: true,
                ata: true,
                // AI Fields
                healthScore: true,
                shipmentContainers: {
                    include: {
                        shipment: {
                            select: {
                                businessUnit: true,
                                forwarder: true,
                                shipmentReference: true,
                                hbl: true
                            }
                        }
                    }
                }
            }
        });

        // Apply Health Filter (In-Memory) if needed
        if (healthFilter && healthFilter !== "all") {
            rawContainers = rawContainers.filter(c => {
                // --- Replicate ContainerInventory `calculateRowData` Logic ---
                const director = getDirectorState(c);
                let healthKey = 'ON_TRACK';

                // 1. Prefer AI Health Score if available
                if (c.healthScore !== null && c.healthScore !== undefined) {
                    if (c.healthScore < 50) healthKey = 'CRITICAL';
                    else if (c.healthScore < 70) healthKey = 'AT_RISK';
                    else if (c.healthScore < 90) healthKey = 'WARNING';
                    else healthKey = 'ON_TRACK';
                }
                // 2. Fallback to Director Logic
                else {
                    if (director.mode === 'COMPLETE') healthKey = 'COMPLETE';
                    else if (director.mode === 'RISK_DETENTION') healthKey = 'CRITICAL';
                    else if (director.demurrage.status === 'overdue') {
                        healthKey = director.demurrage.daysOverdue > 30 ? 'CRITICAL' : 'AT_RISK';
                    } else if (director.mode === 'RISK_MONITOR' || !director.lfdValid) {
                        healthKey = 'WARNING'; // Close to LFD or missing LFD
                    }
                }

                return healthKey.toLowerCase() === healthFilter.toLowerCase();
            });
        }


        // Transform data for CSV
        const headers = [
            "Container Number",
            "Business Unit",
            "Carrier",
            "Forwarder",
            "Status",
            "Type",
            "Reference",
            "HBL",
            "ATD",
            "ETA",
            "LFD",
            "Days In Transit",
            "Location",
            "Has Exception",
            "Exception Type",
            "AI Status",
            "Status Last Updated"
        ];

        const rows = rawContainers.map(c => {
            const shipment = c.shipmentContainers?.[0]?.shipment;
            const bu = c.businessUnit || shipment?.businessUnit || "Unassigned";
            const fwd = shipment?.forwarder || "—";
            const ref = shipment?.shipmentReference || "—";
            const hbl = shipment?.hbl || "—";

            return [
                c.containerNumber,
                bu,
                c.carrier || "—",
                fwd,
                c.currentStatus || "UNKNOWN",
                c.containerType || "—",
                ref,
                hbl,
                c.atd ? format(new Date(c.atd), 'yyyy-MM-dd') : "—",
                c.eta ? format(new Date(c.eta), 'yyyy-MM-dd') : "—",
                c.lastFreeDay ? format(new Date(c.lastFreeDay), 'yyyy-MM-dd') : "—",
                c.daysInTransit?.toString() || "0",
                c.currentLocation || "—",
                c.hasException ? "YES" : "NO",
                c.exceptionType || "",
                c.aiOperationalStatus || "",
                c.statusLastUpdated ? format(new Date(c.statusLastUpdated), 'yyyy-MM-dd HH:mm') : "—"
            ];
        });

        // Generate CSV string
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        return { csv: csvContent };

    } catch (e: any) {
        console.error("Export failed:", e);
        return { error: "Failed to generate export" };
    }
}
