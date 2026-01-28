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
        // Select ALL fields by NOT using 'select' (default is all), but we need to Include shipment.
        // Actually, explicit select is safer for control, but 'include' is easier for "All Fields".
        // Let's use include to get relations, and default fetch for all scalar fields.
        let rawContainers = await prisma.container.findMany({
            where,
            orderBy: { containerNumber: 'asc' },
            include: {
                shipmentContainers: {
                    include: {
                        shipment: true // Include ALL shipment fields
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
        // Define ALL Headers matching Schema
        const headers = [
            // --- Core Container Identity ---
            "Container Number", "Type", "Status", "Business Unit", "Carrier",
            "MBL", "HBL", "Load Type", "Service Type", "Seal Number",
            "Gross Weight", "Pieces", "Volume CBM",

            // --- Dates & Locations ---
            "Current Location", "Vessel", "Voyage",
            "POL", "ETD", "ATD",
            "POD", "ETA", "ATA",
            "Last Free Day", "Detention Free Day",
            "Gate Out Date", "Empty Return Date",
            "Delivery Date", "Final Dest.", "Final Dest. ETA",
            "Status Updated At", "Days In Transit",

            // --- Exceptions & Risk ---
            "Has Exception", "Exception Type", "Exception Owner", "Exception Notes", "Exception Date",
            "Demurrage Exposure", "Health Score",
            "Manual Priority", "Priority Reason", "Priority Set By",

            // --- AI & Intelligence ---
            "AI Operational Status", "AI Attention Category",
            "AI Attention Headline", "AI Recommended Owner",
            "AI Status Reason", "AI Urgency Level", "AI Data Confidence",
            "AI Last Updated",

            // --- Customs (ACE/PGA) ---
            "ACE Entry Number", "ACE Disposition", "ACE Status", "ACE Last Updated",
            "PGA Hold", "PGA Agency", "PGA Hold Reason",

            // --- Shipment Context (First Linked Shipment) ---
            "Shipment Ref", "Forwarder", "Shipper", "Consignee", "Shipment Type",
            "Booking Ref", "Customer Ref", "PO Number", "IncoTerms",
            "Freight Cost", "Shipment Notes",

            // --- Metadata ---
            "Created At", "Updated At", "Import Log ID", "Notes"
        ];

        const rows = rawContainers.map(c => {
            const s = c.shipmentContainers?.[0]?.shipment; // Primary shipment context

            const formatDate = (d: Date | null) => d ? format(new Date(d), 'yyyy-MM-dd') : "";
            const formatDateTime = (d: Date | null) => d ? format(new Date(d), 'yyyy-MM-dd HH:mm') : "";
            const safeStr = (v: any) => (v === null || v === undefined) ? "" : String(v);

            return [
                // --- Core Identity ---
                safeStr(c.containerNumber),
                safeStr(c.containerType),
                safeStr(c.currentStatus),
                safeStr(c.businessUnit || s?.businessUnit), // Fallback to shipment BU
                safeStr(c.carrier),
                safeStr(c.mbl || s?.mbl),
                safeStr(c.hbl || s?.hbl),
                safeStr(c.loadType),
                safeStr(c.serviceType),
                safeStr(c.sealNumber),
                safeStr(c.grossWeight),
                safeStr(c.pieces),
                safeStr(c.volumeCbm),

                // --- Dates & Locations ---
                safeStr(c.currentLocation),
                safeStr(c.currentVessel),
                safeStr(c.currentVoyage),
                safeStr(c.pol || s?.pol),
                formatDate(c.etd),
                formatDate(c.atd),
                safeStr(c.pod || s?.pod),
                formatDate(c.eta),
                formatDate(c.ata),
                formatDate(c.lastFreeDay),
                formatDate(c.detentionFreeDay),
                formatDate(c.gateOutDate),
                formatDate(c.emptyReturnDate),
                formatDate(c.deliveryDate),
                safeStr(c.finalDestination || s?.finalDestination),
                formatDate(c.finalDestinationEta),
                formatDateTime(c.statusLastUpdated),
                safeStr(c.daysInTransit),

                // --- Exceptions & Risk ---
                c.hasException ? "YES" : "NO",
                safeStr(c.exceptionType),
                safeStr(c.exceptionOwner),
                safeStr(c.exceptionNotes),
                formatDate(c.exceptionDate),
                safeStr(c.demurrageExposure),
                safeStr(c.healthScore),
                safeStr(c.manualPriority),
                safeStr(c.priorityReason),
                safeStr(c.prioritySetBy),

                // --- AI & Intelligence ---
                safeStr(c.aiOperationalStatus),
                safeStr(c.aiAttentionCategory),
                safeStr(c.aiAttentionHeadline),
                safeStr(c.aiRecommendedOwner),
                safeStr(c.aiStatusReason),
                safeStr(c.aiUrgencyLevel),
                safeStr(c.aiDataConfidence),
                formatDateTime(c.aiLastUpdated),

                // --- Customs ---
                safeStr(c.aceEntryNumber || s?.aceEntryNumber),
                safeStr(c.aceDisposition),
                safeStr(c.aceStatus),
                formatDateTime(c.aceLastUpdated),
                c.pgaHold ? "YES" : "NO",
                safeStr(c.pgaAgency),
                safeStr(c.pgaHoldReason),

                // --- Shipment Context ---
                safeStr(s?.shipmentReference),
                safeStr(s?.forwarder),
                safeStr(s?.shipper),
                safeStr(s?.consignee),
                safeStr(s?.shipmentType),
                safeStr(s?.bookingReference),
                safeStr(s?.customerReference),
                safeStr(s?.poNumber),
                safeStr(s?.incoTerms),
                safeStr(s?.freightCost),
                safeStr(s?.notes),

                // --- Metadata ---
                formatDateTime(c.createdAt),
                formatDateTime(c.updatedAt),
                safeStr(c.importLogId),
                safeStr(c.notes)
            ];
        });

        // Generate CSV string
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        return { csv: "\uFEFF" + csvContent };

    } catch (e: any) {
        console.error("Export failed:", e);
        return { error: "Failed to generate export" };
    }
}
