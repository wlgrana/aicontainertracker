"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Forcefully overrides the current status of a container.
 * This is used when automated data feeds (Excel/API) are incorrect or lagging.
 * 
 * @param containerNumber - The unique identifier for the container
 * @param newStatus - The target status name (from TransitStage)
 * @param reason - Text description of why the override is occurring
 */
export async function overrideStatus(containerNumber: string, newStatus: string, reason: string) {
    try {
        const container = await prisma.container.findUnique({
            where: { containerNumber }
        });

        if (!container) throw new Error("Container not found");

        const previousStatus = container.currentStatus;

        // 1. Insert status_override record for forensic history
        await prisma.statusOverride.create({
            data: {
                containerNumber,
                previousStatus,
                newStatus,
                reason,
                overriddenBy: "Current User" // In real app, get from session
            }
        });

        // 1b. Lock the status field so AI doesn't revert it
        const meta = (container.metadata as any) || {};
        const lockedFields = new Set<string>(meta.lockedFields || []);
        lockedFields.add('currentStatus');
        const updatedMeta = { ...meta, lockedFields: Array.from(lockedFields) };

        // 2. Update the main Container record
        await prisma.container.update({
            where: { containerNumber },
            data: {
                currentStatus: newStatus,
                statusLastUpdated: new Date(),
                metadata: updatedMeta
            }
        });

        // 3. Create a Timeline Event so the override shows in the journey view
        await prisma.containerEvent.create({
            data: {
                containerId: containerNumber,
                stageName: newStatus,
                eventDateTime: new Date(),
                source: "Manual",
                updatedBy: "Current User",
                previousStatus,
                notes: reason
            }
        });

        // 4. Log the action in the global activity ledger
        await prisma.activityLog.create({
            data: {
                containerId: containerNumber,
                action: "Status Updated",
                actor: "Current User",
                detail: `Manual override: ${previousStatus} → ${newStatus}`,
                source: "Manual",
                metadata: JSON.stringify({ reason })
            }
        });

        revalidatePath(`/container/${containerNumber}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Resolves an active exception on a container.
 * Sets hasException to false and marks all associated AttentionFlags as resolved.
 * 
 * @param containerNumber - The unique identifier for the container
 * @param resolutionNote - Detailed explanation of how the blocker was cleared
 */
export async function clearException(containerNumber: string, resolutionNote: string) {
    try {
        const container = await prisma.container.findUnique({
            where: { containerNumber }
        });

        if (!container) throw new Error("Container not found");

        // 1. Clear Exception status on Container
        await prisma.container.update({
            where: { containerNumber },
            data: {
                hasException: false,
                exceptionType: null,
                exceptionOwner: null,
                exceptionNotes: null
            }
        });

        // 2. Resolve all outstanding flags for this container
        await prisma.attentionFlag.updateMany({
            where: { containerId: containerNumber, resolved: false },
            data: {
                resolved: true,
                resolvedBy: "Current User",
                resolvedDate: new Date(),
                resolutionNote
            }
        });

        // 3. Log a timeline event for visibility in historical journey
        await prisma.containerEvent.create({
            data: {
                containerId: containerNumber,
                eventDateTime: new Date(),
                source: "Manual",
                updatedBy: "Current User",
                exceptionCleared: true,
                notes: resolutionNote
            }
        });

        // 4. Add record to the immutable activity log
        await prisma.activityLog.create({
            data: {
                containerId: containerNumber,
                action: "Exception Cleared",
                actor: "Current User",
                detail: resolutionNote,
                source: "Manual"
            }
        });

        revalidatePath(`/container/${containerNumber}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Raises a new Attention Flag for a container.
 * These flags appear in the "Flags & Notes" tab and the Work Queue.
 * 
 * @param containerId - Identifier of the target container
 * @param reason - High-level reason (e.g., "Missing Documentation")
 * @param priority - Severity level (Critical, High, Normal)
 * @param notes - Detailed context for the team
 */
export async function addFlag(containerId: string, reason: string, priority: string, notes: string) {
    try {
        // 1. Create the persistent flag
        await prisma.attentionFlag.create({
            data: {
                containerId,
                reason,
                priority,
                notes,
                flaggedBy: "Current User"
            }
        });

        // 2. Log in activity log for audit purposes
        await prisma.activityLog.create({
            data: {
                containerId,
                action: "Container Flagged",
                actor: "Current User",
                detail: `${reason} (${priority})`,
                source: "Manual",
                metadata: JSON.stringify({ notes })
            }
        });

        revalidatePath(`/container/${containerId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Adds an operational note to the container's activity log.
 * 
 * @param containerId - Identifier of the target container
 * @param content - The note text
 */
export async function addNote(containerId: string, content: string) {
    try {
        await prisma.activityLog.create({
            data: {
                containerId,
                action: "Note Added",
                actor: "Current User",
                detail: content,
                source: "Manual"
            }
        });

        revalidatePath(`/container/${containerId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates a container's fields and locks them to prevent AI overwrite.
 * Handles cross-table updates for fields like 'finalDestination' which live on Shipment.
 * 
 * @param containerNumber - The container identifier
 * @param data - The partial data to update
 */
export async function updateContainer(containerNumber: string, data: any) {
    try {
        console.log(`[Manual Update] updating ${containerNumber}`, data);

        // 1. Get current metadata to update lockedFields and find linked shipments
        const currentContainer = await prisma.container.findUnique({
            where: { containerNumber },
            include: {
                shipmentContainers: {
                    select: { shipmentId: true }
                }
            }
        });

        if (!currentContainer) throw new Error("Container not found");

        const meta = (currentContainer.metadata as any) || {};
        const lockedFields = new Set<string>(meta.lockedFields || []);

        // 2. Identify fields being updated and lock them
        // We lock ALL fields passed in. If they are shipment fields, we strip the prefix for the lock registry.
        Object.keys(data).forEach(field => {
            if (data[field] !== undefined) {
                const lockKey = field.startsWith('shipment.') ? field.split('.')[1] : field;
                lockedFields.add(lockKey);
            }
        });

        const updatedMeta = {
            ...meta,
            lockedFields: Array.from(lockedFields)
        };

        // 3. Separate Data: Container vs Shipment
        // 'finalDestination' is on Shipment. 'businessUnit' is on BOTH (sync them).
        const containerFields: any = {};
        const shipmentFields: any = {};

        // Define fields that ALWAYS belong to Shipment (even if not prefixed)
        const shipmentOnlyFields = ['poNumber', 'customerPo', 'shipper', 'consignee', 'bookingDate', 'finalDestination', 'shipmentReference'];

        Object.keys(data).forEach(key => {
            const value = data[key];
            if (value === undefined) return;

            if (key.startsWith('shipment.')) {
                const rawKey = key.split('.')[1];
                shipmentFields[rawKey] = value;
            } else if (shipmentOnlyFields.includes(key)) {
                shipmentFields[key] = value;
            } else {
                containerFields[key] = value;
            }
        });

        // businessUnit is on both, so keep in containerFields AND add to shipmentFields
        if (containerFields.businessUnit) {
            shipmentFields.businessUnit = containerFields.businessUnit;
        }

        // 4. Update Container
        if (Object.keys(containerFields).length > 0) {
            await prisma.container.update({
                where: { containerNumber },
                data: {
                    ...containerFields,
                    metadata: updatedMeta,
                    statusLastUpdated: new Date() // Mark as touched
                }
            });
        } else {
            // Even if only updating shipment, we should update metadata (locks) on container
            await prisma.container.update({
                where: { containerNumber },
                data: {
                    metadata: updatedMeta,
                    statusLastUpdated: new Date()
                }
            });
        }

        // 5. Update Linked Shipments (if applicable)
        if (Object.keys(shipmentFields).length > 0 && currentContainer.shipmentContainers.length > 0) {
            const shipmentIds = currentContainer.shipmentContainers.map(sc => sc.shipmentId);
            await prisma.shipment.updateMany({
                where: { shipmentReference: { in: shipmentIds } },
                data: shipmentFields
            });
        }

        // 6. Log Activity
        await prisma.activityLog.create({
            data: {
                containerId: containerNumber,
                action: "Manual Update",
                actor: "Current User",
                detail: `Updated fields: ${Object.keys(data).join(", ")}`,
                source: "Manual",
                metadata: JSON.stringify({ lockedFields: Array.from(lockedFields) })
            }
        });

        revalidatePath(`/container/${containerNumber}`);
        return { success: true };
    } catch (e: any) {
        console.error("Manual Update Failed:", e);
        return { success: false, error: e.message };
    }
}


/**
 * Accepts a specific AI-enriched field value.
 * 1. Updates the official Container/Shipment record with the value (locking it).
 * 2. Removes the field from the aiDerived JSON so it no longer appears as a suggestion.
 * 
 * @param containerNumber - The container identifier
 * @param fieldName - The key of the field being accepted (e.g., 'serviceType')
 * @param value - The value to accept
 */
export async function acceptEnrichment(containerNumber: string, fieldName: string, value: any) {
    try {
        console.log(`[Accept Enrichment] ${containerNumber}: Accepting ${fieldName} = ${value}`);

        // 1. Update the official record (this handles locking and Shipment vs Container split)
        const updateResult = await updateContainer(containerNumber, { [fieldName]: value });
        if (!updateResult.success) throw new Error(updateResult.error);

        // 2. Remove the suggestion from aiDerived
        const container = await prisma.container.findUnique({
            where: { containerNumber },
            select: { aiDerived: true }
        });

        if (container?.aiDerived) {
            const aiDerived = container.aiDerived as any;

            // Check if field exists in aiDerived
            if (aiDerived.fields && aiDerived.fields[fieldName]) {
                delete aiDerived.fields[fieldName];

                // Construct log message
                const logMessage = `Accepted AI enrichment for ${fieldName}`;

                // Update container with cleaned aiDerived
                await prisma.container.update({
                    where: { containerNumber },
                    data: { aiDerived }
                });

                // Log activity
                await prisma.activityLog.create({
                    data: {
                        containerId: containerNumber,
                        action: "Enrichment Accepted",
                        actor: "Current User",
                        detail: logMessage,
                        source: "Manual"
                    }
                });
            }
        }

        revalidatePath(`/container/${containerNumber}`);
        return { success: true };
    } catch (e: any) {
        console.error("Accept Enrichment Failed:", e);
        return { success: false, error: e.message };
    }
}
