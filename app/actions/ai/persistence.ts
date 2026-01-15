'use server'

import { prisma } from "@/lib/prisma";

export async function getLatestAssessment(containerId: string) {
    try {
        const container = await prisma.container.findUnique({
            where: { containerNumber: containerId },
            // @ts-ignore
            select: { aiAnalysis: true, aiLastUpdated: true }
        });

        // @ts-ignore
        if (!container?.aiAnalysis) return null;

        return {
            // @ts-ignore
            ...container.aiAnalysis as object,
            // @ts-ignore
            timestamp: container.aiLastUpdated
        };
    } catch (error) {
        console.error("Failed to fetch assessment:", error);
        return null;
    }
}

export async function saveAssessment(containerId: string, analysis: any) {
    try {
        const meta = analysis.structured_metadata || {};
        console.log("[saveAssessment] Saving metadata:", meta);

        // 2. Fetch current metadata to check for locks
        const currentContainer = await prisma.container.findUnique({
            where: { containerNumber: containerId },
            select: { metadata: true }
        });

        const currentMeta = (currentContainer?.metadata as any) || {};
        const lockedFields = new Set<string>(currentMeta.lockedFields || []);

        console.log(`[saveAssessment] Locked fields for ${containerId}:`, Array.from(lockedFields));

        // Prepare update data
        const updateData: any = {
            aiAnalysis: analysis,
            aiLastUpdated: new Date(),
            healthScore: meta.health_score ?? null,
            daysInTransit: meta.days_in_transit ?? null,
            demurrageExposure: meta.demurrage_exposure ?? null,
            businessUnit: meta.business_unit ?? null,
            // Extended Metadata Mapping
            pol: meta.pol ?? undefined,
            pod: meta.pod ?? undefined,
            containerType: meta.container_type ?? undefined,
            grossWeight: meta.gross_weight ?? undefined,
            currentVessel: meta.vessel ?? undefined,
            currentVoyage: meta.voyage ?? undefined,

            // NEW MAPPINGS (Fixes missing data)
            carrier: meta.carrier_scac ?? undefined,
            deliveryDate: meta.delivery_date ? new Date(meta.delivery_date) : undefined,
            hbl: meta.hbl ?? undefined,
            loadType: meta.load_type ?? undefined,
            serviceType: meta.service_type ?? undefined,
            pieces: meta.pieces ? parseInt(meta.pieces) : undefined,
            volumeCbm: meta.volume ? parseFloat(meta.volume) : undefined,
            finalDestinationEta: meta.final_dest_eta ? new Date(meta.final_dest_eta) : undefined,

            // AI Status Classification (New)
            aiOperationalStatus: analysis.classification?.status?.operational ?? undefined,
            aiDataConfidence: analysis.classification?.status?.confidence ?? undefined,
            aiStatusReason: analysis.classification?.status?.reason ?? undefined,
            aiAttentionCategory: analysis.classification?.attention?.category ?? undefined,
            aiUrgencyLevel: analysis.classification?.attention?.urgency ?? undefined,
            aiAttentionHeadline: analysis.classification?.attention?.headline ?? undefined,
            aiRecommendedOwner: analysis.classification?.attention?.owner ?? undefined,
        };

        // Optional: Update critical operational dates if AI provides them and they are missing/different?
        if (meta.atd) updateData.atd = new Date(meta.atd);
        if (meta.eta) updateData.eta = new Date(meta.eta);
        if (meta.ata) updateData.ata = new Date(meta.ata); // Added
        if (meta.etd) updateData.etd = new Date(meta.etd); // Added
        if (meta.last_free_day) updateData.lastFreeDay = new Date(meta.last_free_day);

        // LOCK CHECK: Remove any key from updateData if it is in lockedFields
        // Exception: Always allow AI fields (aiAnalysis, healthScore, etc.) to update?
        // Reasoning: User locks "ETA", AI shouldn't overwrite "ETA". But AI should still update "Risk Score".
        // The list of "Safe to Overwrite" fields vs "Protectable" fields.
        // For now, we only filter the schema fields (dates, pol, pod, etc).

        const PROTECTED_FIELDS = ['pol', 'pod', 'containerType', 'grossWeight', 'currentVessel', 'currentVoyage', 'atd', 'eta', 'ata', 'etd', 'deliveryDate', 'lastFreeDay'];

        PROTECTED_FIELDS.forEach(field => {
            if (lockedFields.has(field)) {
                console.log(`[saveAssessment] Skipping update for locked field: ${field}`);
                delete updateData[field];
            }
        });

        await prisma.container.update({
            where: { containerNumber: containerId },
            data: updateData
        });

        // Update Linked Shipment Data (final_destination, booking_date)
        if (meta.final_destination || meta.booking_date || meta.business_unit) {
            const linkedShipments = await prisma.shipmentContainer.findMany({
                where: { containerId: containerId },
                select: { shipmentId: true }
            });

            if (linkedShipments.length > 0) {
                const shipmentIds = linkedShipments.map(ls => ls.shipmentId);
                const shipmentUpdateData: any = {};

                // Check locks before updating Shipment fields
                if (meta.final_destination && !lockedFields.has('finalDestination')) {
                    shipmentUpdateData.finalDestination = meta.final_destination;
                }
                if (meta.booking_date && !lockedFields.has('bookingDate')) {
                    shipmentUpdateData.bookingDate = new Date(meta.booking_date);
                }
                if (meta.business_unit && !lockedFields.has('businessUnit')) {
                    shipmentUpdateData.businessUnit = meta.business_unit;
                }
                if (meta.shipper) {
                    shipmentUpdateData.shipper = meta.shipper;
                }
                if (meta.consignee) {
                    shipmentUpdateData.consignee = meta.consignee;
                }
                if (meta.customer_po) {
                    shipmentUpdateData.customerPo = meta.customer_po;
                }

                if (Object.keys(shipmentUpdateData).length > 0) {
                    await prisma.shipment.updateMany({
                        where: { shipmentReference: { in: shipmentIds } },
                        data: shipmentUpdateData
                    });
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to save assessment:", error);
        return { success: false, error: "Failed to persist analysis" };
    }
}
