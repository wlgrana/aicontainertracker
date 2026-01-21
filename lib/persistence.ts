import { prisma } from './prisma';
import { TranslatorOutput, AuditorOutput } from '@/types/agents';
import { AgentStage, ProcessingStatus } from '@prisma/client';


import { safeDate } from './date-utils';

// Cache of valid TransitStage names
let VALID_STAGES_CACHE: Set<string> | null = null;

async function getValidStages(): Promise<Set<string>> {
    if (VALID_STAGES_CACHE) return VALID_STAGES_CACHE;

    const stages = await prisma.transitStage.findMany({
        select: { stageName: true }
    });

    VALID_STAGES_CACHE = new Set(stages.map(s => s.stageName));
    return VALID_STAGES_CACHE;
}

/**
 * Smart Status Handler - Implements "Zero Data Loss" for status codes
 * 
 * @param carrierStatusCode - Raw status from carrier (e.g., "BCN", "RTN")
 * @returns Object with rawStatus (always populated) and currentStatus (validated or null)
 */
async function handleStatus(carrierStatusCode: string | null): Promise<{
    rawStatus: string | null;
    currentStatus: string | null;
}> {
    if (!carrierStatusCode) {
        return { rawStatus: null, currentStatus: null };
    }

    // Get valid stages from database
    const validStages = await getValidStages();

    // Check if carrier code matches a known stage exactly
    if (validStages.has(carrierStatusCode)) {
        return {
            rawStatus: carrierStatusCode,
            currentStatus: carrierStatusCode
        };
    }

    // Try common mappings
    const COMMON_MAPPINGS: Record<string, string> = {
        'BCN': 'Booked',
        'BKD': 'Booked',
        'RTN': 'Empty Return',
        'OGE': 'Out Gate Empty',
        'OGF': 'Out Gate Full',
        'DIS': 'Discharged',
        'DSCH': 'Discharged',
        'AVL': 'Released',
        'REL': 'Released',
        'RLS': 'Released',
    };

    const mappedValue = COMMON_MAPPINGS[carrierStatusCode.toUpperCase()];

    if (mappedValue && validStages.has(mappedValue)) {
        console.log(`[Status] Mapped "${carrierStatusCode}" → "${mappedValue}"`);
        return {
            rawStatus: carrierStatusCode,
            currentStatus: mappedValue
        };
    }

    // Unknown status - store raw, leave currentStatus null for user to map
    console.warn(`[Status] Unknown status code "${carrierStatusCode}" - storing as raw, validation needed`);
    return {
        rawStatus: carrierStatusCode,
        currentStatus: null
    };
}


export async function persistMappedData(
    importLogId: string,
    translatorOutput: TranslatorOutput,
    enrichmentMap?: Map<string, any>, // NEW: Accept pre-calculated enrichment
    onProgress?: (message: string) => void,
    forwarder?: string // NEW: Accept forwarder from import config
) {
    // 1. O(1) Lookup Map for matching Events & Logs to Containers
    const rowIdToContainerMap = new Map<string, string>();
    const rowIdToMappingMap = new Map<string, any>();

    translatorOutput.containers.forEach(c => {
        if (c.rawRowId && c.fields.containerNumber?.value) {
            rowIdToContainerMap.set(c.rawRowId, c.fields.containerNumber.value);
            rowIdToMappingMap.set(c.rawRowId, c);
        }
    });

    // Helper to derive BU from Consignee
    const deriveBusinessUnit = (consignee: any): string | null => {
        if (!consignee || typeof consignee !== 'string') return null;
        const c = consignee.toUpperCase();
        if (c.includes("HORIZON GLOBAL")) return "Horizon Global";
        if (c.includes("HORIZON")) return "Horizon Global";
        if (c.includes("FRAM")) return "FRAM";
        if (c.includes("TRICO")) return "TRICO";
        if (c.includes("AUTOLITE")) return "AUTOLITE";
        if (c.includes("CHAMPION")) return "CHAMPION";
        if (c.includes("FIRST BRANDS")) return "FIRST_BRANDS_GROUP";
        return null;
    };

    // --- BATCH PROCESSING CONSTANTS ---
    const BATCH_SIZE = 50;
    const containers = translatorOutput.containers;
    const total = containers.length;

    // Arrays to hold created objects for return
    const createdContainers = []; // We won't strictly populate this with full DB objects to save memory, just IDs if needed
    const createdEvents = [];

    // --- STEP 1: Process Containers & Shipments (Batched) ---
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = containers.slice(i, i + BATCH_SIZE);

        if (onProgress) {
            onProgress(`[Persistence] Batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(total / BATCH_SIZE)}: Upserting ${chunk.length} containers...`);
        }

        // DEBUG: Log first container's key dates in this batch
        if (chunk.length > 0) {
            const first = chunk[0];
            const cNum = first.fields.containerNumber?.value;
            const etdVal = first.fields.etd?.value;
            console.log(`[Persistence-DEBUG] Sample Container ${cNum}: Raw ETD from fields="${etdVal}", safeDate Output="${safeDate(etdVal)?.toISOString() || 'null'}"`);
        }

        const containerUpserts = [];
        const shipmentUpserts = [];
        const shipmentLinkPromises = [];
        const rawRowUpdates = [];

        // Logs Accumulator for this chunk
        const agentLogsToCreate = [];

        // Pre-fetch all containers in this chunk to handle locking efficiently
        const chunkContainerNumbers = chunk.map(c => c.fields.containerNumber?.value).filter(Boolean) as string[];
        const existingContainers = await prisma.container.findMany({
            where: { containerNumber: { in: chunkContainerNumbers } },
            select: { containerNumber: true, metadata: true, currentStatus: true }
        });
        const existingMap = new Map(existingContainers.map(c => [c.containerNumber, c]));

        for (const mappedContainer of chunk) {
            const f = mappedContainer.fields;
            const cNum = f.containerNumber?.value;

            if (!cNum) continue;

            createdContainers.push({ containerNumber: cNum });

            // 1a. Prepare Container Upsert
            const metadata: any = {
                _internal: {
                    mappingConfidence: mappedContainer.overallConfidence,
                    flags: mappedContainer.flagsForReview,
                    rawRowId: mappedContainer.rawRowId,
                    importLogId: importLogId
                }
            };
            if (f.finalDestination?.value) metadata.finalDestination = f.finalDestination.value;

            // --- ENRICHMENT MERGE ---
            let enrichedServiceType = undefined;
            let enrichedFinalDest = undefined;
            let enrichedStatus = undefined;

            if (enrichmentMap && enrichmentMap.has(cNum)) {
                const eData = enrichmentMap.get(cNum);
                if (eData && eData.fields) {
                    enrichedServiceType = eData.fields.serviceType?.value;
                    enrichedFinalDest = eData.fields.finalDestination?.value;

                    const rawInf = eData.fields.statusInference?.value || eData.statusInference;
                    if (rawInf === 'IN_TRANSIT') enrichedStatus = 'DEP';
                    else if (rawInf === 'ARRIVED') enrichedStatus = 'ARR';
                    // Respect Explicit Code Returns (DEL, CGO, RET) from new logic
                    else if (['DEL', 'CGO', 'RET', 'DEP', 'ARR', 'BOOK'].includes(rawInf)) enrichedStatus = rawInf;
                }
            }

            const rawStatus = f.currentStatus?.value;

            // Handle status with smart mapping (Zero Data Loss)
            const statusResult = await handleStatus(rawStatus);

            // PRIORITY: 2. Enriched (Date-based) > 3. Carrier (Raw)
            // Note: Manual (1) is handled by locking check below.
            // If we have enriched status, use it for currentStatus but keep rawStatus from carrier
            const finalCurrentStatus = enrichedStatus || statusResult.currentStatus;

            const derivedBU = f.businessUnit?.value || deriveBusinessUnit(f.consignee?.value);

            const mblValue = f.mbl?.value || f.mbl_or_booking?.value;

            // Full Payload for Creation
            const containerData: any = {
                containerNumber: cNum,
                rawStatus: statusResult.rawStatus,        // NEW: Always store carrier's value
                currentStatus: finalCurrentStatus,        // NEW: Validated value or NULL
                carrier: f.carrier?.value,
                pol: f.pol?.value,
                pod: f.pod?.value,
                etd: safeDate(f.etd?.value),
                atd: safeDate(f.atd?.value),
                eta: safeDate(f.eta?.value),
                ata: safeDate(f.ata?.value),
                businessUnit: derivedBU,
                mbl: mblValue,
                hbl: f.hbl?.value,
                pieces: f.pieces?.value ? parseInt(String(f.pieces.value)) : null,
                volumeCbm: f.volumeCbm?.value ? parseFloat(String(f.volumeCbm.value)) : (f.volume?.value ? parseFloat(String(f.volume.value)) : null),
                sealNumber: f.sealNumber?.value,
                grossWeight: f.grossWeight?.value ? parseFloat(String(f.grossWeight.value)) : null,
                finalDestinationEta: safeDate(f.finalDestinationEta?.value),
                loadType: f.loadType?.value,
                serviceType: f.serviceType?.value || enrichedServiceType,
                containerType: f.containerType?.value,
                deliveryDate: safeDate(f.deliveryDate?.value),
                gateOutDate: safeDate(f.gateOutDate?.value),
                lastFreeDay: safeDate(f.lastFreeDay?.value),
                emptyReturnDate: safeDate(f.emptyReturnDate?.value),
                finalDestination: f.finalDestination?.value || enrichedFinalDest,
                meta: mappedContainer.meta,
                metadata: metadata, // Fixed: Added missing metadata on create
                importLogId: importLogId,
                aiDerived: enrichmentMap?.get(cNum) || undefined
            };



            // Calculate Update Payload (Pre-Locking)
            const updatePayload: any = {
                rawStatus: statusResult.rawStatus,        // NEW: Update raw value
                currentStatus: finalCurrentStatus,        // NEW: Update validated value
                atd: safeDate(f.atd?.value),
                ata: safeDate(f.ata?.value),
                etd: safeDate(f.etd?.value),
                eta: safeDate(f.eta?.value),
                importLogId: importLogId,
                businessUnit: derivedBU || undefined,
                mbl: mblValue || undefined,
                hbl: f.hbl?.value || undefined,
                pieces: f.pieces?.value ? parseInt(String(f.pieces.value)) : undefined,
                volumeCbm: f.volumeCbm?.value ? parseFloat(String(f.volumeCbm.value)) : undefined,
                sealNumber: f.sealNumber?.value || undefined,
                grossWeight: f.grossWeight?.value ? parseFloat(String(f.grossWeight.value)) : undefined,
                finalDestinationEta: safeDate(f.finalDestinationEta?.value),
                finalDestination: f.finalDestination?.value || enrichedFinalDest || undefined,
                loadType: f.loadType?.value || undefined,
                serviceType: f.serviceType?.value || enrichedServiceType || undefined,
                containerType: f.containerType?.value || undefined,
                deliveryDate: safeDate(f.deliveryDate?.value),
                gateOutDate: safeDate(f.gateOutDate?.value),
                lastFreeDay: safeDate(f.lastFreeDay?.value),
                emptyReturnDate: safeDate(f.emptyReturnDate?.value),
                meta: mappedContainer.meta || undefined,
                aiLastUpdated: new Date()
            };

            // --- CHECK LOCKING ---
            const ex = existingMap.get(cNum);
            if (ex) {
                const lockedFields = (ex.metadata as any)?.lockedFields || [];
                if (Array.isArray(lockedFields) && lockedFields.length > 0) {
                    lockedFields.forEach(field => {
                        if (updatePayload[field] !== undefined) {
                            delete updatePayload[field]; // PROTECT LOCKED FIELD
                        }
                    });
                }

                // Merge Metadata (preserve locks)
                updatePayload.metadata = {
                    ...(ex.metadata as any || {}),
                    ...metadata
                };
            }

            // Use upsert to handle both creation and updates safely (Fixes race conditions)
            containerUpserts.push(prisma.container.upsert({
                where: { containerNumber: cNum },
                update: updatePayload,
                create: containerData // Now includes metadata
            }));

            if (mappedContainer.rawRowId) {
                rawRowUpdates.push(prisma.rawRow.update({
                    where: { id: mappedContainer.rawRowId },
                    data: { containerId: cNum }
                }));
            }

            // 1b. Prepare Shipment Upsert
            const shipRef = f.shipmentReference?.value || mblValue;
            if (shipRef) {
                // Deduplicate shipment upserts in this chunk could be an optimization, but Prisma handles concurrent upserts reasonably well if keys are unique. 
                // However, to avoid "Unique constraint failed" race conditions on create within the same transaction, we should ideally dedup. 
                // For now, we rely on the fact that container->shipment is many-to-one, so we might hit the same shipment multiple times.
                // WE WILL RUN SHIPMENT UPSERTS SEQUENTIALLY OR DEDUPED TO BE SAFE.
                // Let's DEDUP shipment payload by shipRef.
            }

            // 1c. Accumulate Logs (Archivist & Translator)
            if (mappedContainer.rawRowId) {
                agentLogsToCreate.push({
                    containerId: cNum,
                    stage: AgentStage.ARCHIVIST,
                    status: ProcessingStatus.COMPLETED,
                    timestamp: new Date(metadata._internal?.ingestedAt || new Date()),
                    output: { rowId: mappedContainer.rawRowId, note: "Captured from raw import" }
                });

                const shouldLogFull = mappedContainer.overallConfidence < 0.90 || (mappedContainer.flagsForReview?.length || 0) > 0;
                agentLogsToCreate.push({
                    containerId: cNum,
                    stage: AgentStage.TRANSLATOR,
                    status: ProcessingStatus.COMPLETED,
                    timestamp: new Date(),
                    confidence: mappedContainer.overallConfidence,
                    mappings: mappedContainer.fields as any,
                    dictionaryVersion: translatorOutput.dictionaryVersion,
                    output: shouldLogFull ? JSON.parse(JSON.stringify(mappedContainer)) : { summary: "High confidence mapping" }
                });
            }
        } // End chunk loop

        // Execute Container Upserts
        await Promise.all(containerUpserts);

        // Execute RawRow Updates (can be fire-and-forget or parallel)
        await Promise.all(rawRowUpdates);

        // Handle Shipments & Links (Deduplicated)
        const uniqueShipments = new Map();
        const linksToCreate = [];

        for (const mappedContainer of chunk) {
            const f = mappedContainer.fields;
            const cNum = f.containerNumber?.value;
            const mblValue = f.mbl?.value || f.mbl_or_booking?.value;
            const shipRef = f.shipmentReference?.value || mblValue;

            if (cNum && shipRef) {
                if (!uniqueShipments.has(shipRef)) {
                    uniqueShipments.set(shipRef, {
                        where: { shipmentReference: shipRef },
                        create: {
                            shipmentReference: shipRef,
                            mbl: mblValue,
                            hbl: f.hbl?.value,
                            importLogId: importLogId,
                            finalDestination: f.finalDestination?.value,
                            bookingReference: f.bookingReference?.value,
                            customerPo: f.customerPo?.value,
                            shipper: f.shipper?.value,
                            consignee: f.consignee?.value,
                            businessUnit: f.businessUnit?.value,
                            forwarder: forwarder || null
                        },
                        update: {
                            mbl: mblValue,
                            hbl: f.hbl?.value,
                            customerPo: f.customerPo?.value || undefined,
                            shipper: f.shipper?.value || undefined,
                            consignee: f.consignee?.value || undefined,
                            businessUnit: f.businessUnit?.value || undefined,
                            forwarder: forwarder || undefined
                        }
                    });
                }
                linksToCreate.push({ shipmentId: shipRef, containerId: cNum });
            }
        }

        // Run Shipment Upserts
        await Promise.all(Array.from(uniqueShipments.values()).map(payload => prisma.shipment.upsert(payload)));

        // Run Link Creation (Swallowing errors for duplicates)
        await Promise.all(linksToCreate.map(link => prisma.shipmentContainer.create({ data: link }).catch(() => { })));

        // Bulk Create Logs (Archivist/Translator)
        if (agentLogsToCreate.length > 0) {
            await prisma.agentProcessingLog.createMany({ data: agentLogsToCreate });
        }
    }

    // --- STEP 2: Process Events & Persistence Logs (Batched) ---
    const allEvents = translatorOutput.events || [];
    const eventBatchSize = 100;
    const persistenceLogs = [];

    for (let i = 0; i < allEvents.length; i += eventBatchSize) {
        const chunk = allEvents.slice(i, i + eventBatchSize);
        const eventsToCreate = [];

        for (const ev of chunk) {
            // FAST LOOKUP
            const cNum = rowIdToContainerMap.get(ev.rawRowId);
            if (cNum) {
                eventsToCreate.push({
                    containerId: cNum,
                    stageName: ev.stageName,
                    eventDateTime: new Date(ev.eventDateTime),
                    location: ev.location,
                    source: 'ExcelImport',
                    meta: {
                        confidence: ev.confidence,
                        derivedFrom: ev.derivedFrom
                    }
                });
                createdEvents.push(eventsToCreate[eventsToCreate.length - 1]);
            }
        }

        if (eventsToCreate.length > 0) {
            await prisma.containerEvent.createMany({ data: eventsToCreate });
        }
    }

    // --- STEP 3: Create Persistence Logs ---
    // We do this per container, but we can generate them in memory and bulk insert
    if (onProgress) onProgress(`[Persistence] Finalizing Audit Logs...`);

    const persistenceLogsToCreate = [];
    const eventsByContainer = new Map<string, string[]>();

    // Index generated events by container for logging
    createdEvents.forEach(e => {
        if (!eventsByContainer.has(e.containerId)) eventsByContainer.set(e.containerId, []);
        eventsByContainer.get(e.containerId)?.push(e.stageName || 'UNKNOWN');
    });

    for (const c of createdContainers) {
        const cNum = c.containerNumber;
        const evTypes = eventsByContainer.get(cNum) || [];

        persistenceLogsToCreate.push({
            containerId: cNum,
            stage: AgentStage.PERSISTENCE,
            status: ProcessingStatus.COMPLETED,
            timestamp: new Date(),
            output: {
                eventsGenerated: evTypes.length,
                eventTypes: evTypes
            }
        });
    }

    if (persistenceLogsToCreate.length > 0) {
        // Chunk logs to avoid query size limits
        const logChunks = [];
        for (let i = 0; i < persistenceLogsToCreate.length; i += 100) {
            await prisma.agentProcessingLog.createMany({
                data: persistenceLogsToCreate.slice(i, i + 100)
            });
        }
    }

    return { containers: createdContainers, events: createdEvents };
}

export async function updateContainerAuditMeta(containerNumber: string, result: AuditorOutput, status: 'PASS' | 'FAIL' | 'CORRECTED') {
    const current = await prisma.container.findUnique({ where: { containerNumber }, select: { metadata: true } });
    const currentMeta = (current?.metadata as any) || {};

    const lastAudit = {
        date: new Date(),
        result: status,
        captureRate: result.summary.captureRate,
        correctedFields: status === 'CORRECTED' ? Object.keys(result.corrections.fieldsToUpdate) : [],
        lostFields: status === 'CORRECTED' ? [] : result.lost.map(l => l.field),
        unmappedFields: result.unmapped.map(u => u.rawField)
    };

    const newMeta = {
        ...currentMeta,
        lastAudit: lastAudit
    };

    await prisma.container.update({
        where: { containerNumber },
        data: { metadata: newMeta }
    });
}

export async function applyAuditorCorrections(containerNumber: string, result: AuditorOutput) {
    const updates = result.corrections.fieldsToUpdate;
    const metaAdd = result.corrections.metadataToAdd;

    const dateFields = ['etd', 'atd', 'eta', 'ata', 'gateOutDate', 'lastFreeDay', 'deliveryDate', 'emptyReturnDate', 'finalDestinationEta'];

    const validContainerFields = [
        "containerType", "currentStatus", "currentLocation", "currentVessel", "currentVoyage",
        "mbl", "carrier", "pol", "pod", "etd", "atd", "eta", "ata",
        "lastFreeDay", "detentionFreeDay", "sealNumber", "grossWeight",
        "emptyReturnDate", "gateOutDate", "daysInTransit",
        "deliveryDate", "finalDestinationEta", "hbl", "loadType", "pieces", "serviceType", "volumeCbm",
        "businessUnit"
    ];

    const safeUpdates: any = {};
    for (const key of Object.keys(updates)) {
        if (validContainerFields.includes(key)) {
            let val = updates[key];
            if (dateFields.includes(key) && typeof val === 'string') {
                val = new Date(val);
            }
            safeUpdates[key] = val;
        } else {
            if (!metaAdd[key]) {
                metaAdd[key] = updates[key];
            }
        }
    }

    const current = await prisma.container.findUnique({ where: { containerNumber }, select: { metadata: true } });
    const currentMeta = (current?.metadata as any) || {};

    const lastAudit = {
        date: new Date(),
        result: 'CORRECTED',
        captureRate: result.summary.captureRate,
        correctedFields: [...Object.keys(safeUpdates), ...Object.keys(metaAdd)],
        lostFields: [],
        unmappedFields: result.unmapped.map(u => u.rawField)
    };

    const newMeta = {
        ...currentMeta,
        ...metaAdd,
        auditorV2Corrections: true,
        lastAudit: lastAudit
    };

    await prisma.container.update({
        where: { containerNumber },
        data: {
            ...safeUpdates,
            metadata: newMeta,
            aiLastUpdated: new Date()
        }
    });

    // Add Activity Log
    await prisma.activityLog.create({
        data: {
            containerId: containerNumber,
            action: 'AUTO_CORRECT',
            actor: 'AuditorV2',
            detail: `Applied ${Object.keys(safeUpdates).length + Object.keys(metaAdd).length} field corrections.`,
            metadata: JSON.stringify({
                correctedFields: [...Object.keys(safeUpdates), ...Object.keys(metaAdd)],
                captureRateBefore: result.summary.captureRate,
                recommendation: result.summary.recommendation
            })
        }
    });
}
