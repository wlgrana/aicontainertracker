import { prisma } from './prisma';
import { TranslatorOutput, AuditorOutput } from '@/types/agents';


function safeDate(val: any): Date | null {
    if (!val) return null;

    // Explicitly handle Numeric Strings (Excel Serial)
    // If we rely on new Date("45719"), it parses as Year 45719 which crashes DB
    if (String(val).match(/^\d+(\.\d+)?$/)) {
        const num = parseFloat(String(val));
        // Excel Range (1954 - 2064)
        if (num > 20000 && num < 60000) {
            const utc_days = Math.floor(num - 25569);
            const utc_value = utc_days * 86400;
            return new Date(utc_value * 1000);
        }
        // Timestamp (milliseconds) check
        if (num > 946684800000) return new Date(num); // > Year 2000
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;

    return null;
}

export async function persistMappedData(
    importLogId: string,
    translatorOutput: TranslatorOutput,
    onProgress?: (message: string) => void
) {
    const containers = [];
    const events = [];

    // Valid Status Codes from seed
    const VALID_STAGES = ["BOOK", "CEP", "CGI", "STUF", "LOA", "DEP", "TS1", "TSD", "TSL", "TS1D", "ARR", "DIS", "INSP", "CUS", "REL", "AVL", "CGO", "OFD", "DEL", "STRP", "RET", "O"];

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

    for (let i = 0; i < translatorOutput.containers.length; i++) {
        const mappedContainer = translatorOutput.containers[i];
        if (i > 0 && i % 25 === 0) {
            const msg = `[Persistence] Processed ${i} / ${translatorOutput.containers.length} containers...`;
            console.log(msg);
            if (onProgress) onProgress(msg);
        }
        const f = mappedContainer.fields;
        const cNum = f.containerNumber?.value;

        if (cNum) {
            const metadata: any = {
                _internal: {
                    mappingConfidence: mappedContainer.overallConfidence,
                    flags: mappedContainer.flagsForReview,
                    rawRowId: mappedContainer.rawRowId,
                    importLogId: importLogId
                }
            };

            if (f.finalDestination?.value) {
                metadata.finalDestination = f.finalDestination.value;
            }

            const rawStatus = f.currentStatus?.value;
            const validStatus = (rawStatus && VALID_STAGES.includes(rawStatus)) ? rawStatus : undefined;

            const derivedBU = f.businessUnit?.value || deriveBusinessUnit(f.consignee?.value);

            const container = await prisma.container.upsert({
                where: { containerNumber: cNum },
                create: {
                    containerNumber: cNum,
                    currentStatus: validStatus,
                    carrier: f.carrier?.value,
                    pol: f.pol?.value,
                    pod: f.pod?.value,
                    etd: safeDate(f.etd?.value),
                    atd: safeDate(f.atd?.value),
                    eta: safeDate(f.eta?.value),
                    ata: safeDate(f.ata?.value),

                    // Detailed Fields
                    businessUnit: derivedBU,
                    hbl: f.hbl?.value,
                    pieces: f.pieces?.value ? parseInt(String(f.pieces.value)) : null,
                    volumeCbm: f.volumeCbm?.value ? parseFloat(String(f.volumeCbm.value)) : (f.volume?.value ? parseFloat(String(f.volume.value)) : null),
                    sealNumber: f.sealNumber?.value,
                    grossWeight: f.grossWeight?.value ? parseFloat(String(f.grossWeight.value)) : null,
                    finalDestinationEta: safeDate(f.finalDestinationEta?.value),
                    loadType: f.loadType?.value,
                    serviceType: f.serviceType?.value,
                    containerType: f.containerType?.value,

                    // Date Fields
                    deliveryDate: safeDate(f.deliveryDate?.value),
                    gateOutDate: safeDate(f.gateOutDate?.value),
                    lastFreeDay: safeDate(f.lastFreeDay?.value),
                    emptyReturnDate: safeDate(f.emptyReturnDate?.value),

                    metadata: metadata,
                    meta: mappedContainer.meta,
                    importLogId: importLogId
                },
                update: {
                    atd: safeDate(f.atd?.value),
                    ata: safeDate(f.ata?.value),
                    etd: safeDate(f.etd?.value),
                    eta: safeDate(f.eta?.value),

                    importLogId: importLogId,
                    businessUnit: derivedBU || undefined,
                    hbl: f.hbl?.value || undefined,
                    pieces: f.pieces?.value ? parseInt(String(f.pieces.value)) : undefined,
                    volumeCbm: f.volumeCbm?.value ? parseFloat(String(f.volumeCbm.value)) : undefined,
                    sealNumber: f.sealNumber?.value || undefined,
                    grossWeight: f.grossWeight?.value ? parseFloat(String(f.grossWeight.value)) : undefined,
                    finalDestinationEta: safeDate(f.finalDestinationEta?.value),
                    loadType: f.loadType?.value || undefined,
                    serviceType: f.serviceType?.value || undefined,
                    containerType: f.containerType?.value || undefined,

                    deliveryDate: safeDate(f.deliveryDate?.value),
                    gateOutDate: safeDate(f.gateOutDate?.value),
                    lastFreeDay: safeDate(f.lastFreeDay?.value),
                    emptyReturnDate: safeDate(f.emptyReturnDate?.value),

                    currentStatus: validStatus,
                    meta: mappedContainer.meta || undefined,
                    aiLastUpdated: new Date()
                }
            });

            containers.push(container);

            if (mappedContainer.rawRowId) {
                await prisma.rawRow.update({
                    where: { id: mappedContainer.rawRowId },
                    data: { containerId: container.containerNumber }
                });
            }
        }

        const shipRef = f.shipmentReference?.value || f.mbl?.value;
        if (shipRef && cNum) {
            await prisma.shipment.upsert({
                where: { shipmentReference: shipRef },
                create: {
                    shipmentReference: shipRef,
                    mbl: f.mbl?.value,
                    hbl: f.hbl?.value,
                    importLogId: importLogId,
                    finalDestination: f.finalDestination?.value,
                    bookingReference: f.bookingReference?.value,
                    customerPo: f.customerPo?.value,
                    shipper: f.shipper?.value,
                    consignee: f.consignee?.value,
                    businessUnit: f.businessUnit?.value,
                },
                update: {
                    mbl: f.mbl?.value,
                    hbl: f.hbl?.value,
                    customerPo: f.customerPo?.value || undefined,
                    shipper: f.shipper?.value || undefined,
                    consignee: f.consignee?.value || undefined,
                    businessUnit: f.businessUnit?.value || undefined
                }
            });

            await prisma.shipmentContainer.create({
                data: {
                    shipmentId: shipRef,
                    containerId: cNum
                }
            }).catch(() => { });
        }
    }

    for (const ev of translatorOutput.events) {
        const matchedContainerDef = translatorOutput.containers.find(mc => mc.rawRowId === ev.rawRowId);
        const cNum = matchedContainerDef?.fields.containerNumber?.value;

        if (cNum) {
            const event = await prisma.containerEvent.create({
                data: {
                    containerId: cNum,
                    stageName: ev.stageName,
                    eventDateTime: new Date(ev.eventDateTime),
                    location: ev.location,
                    source: 'ExcelImport',
                    meta: {
                        confidence: ev.confidence,
                        derivedFrom: ev.derivedFrom
                    } as any
                }
            });
            events.push(event);
        }
    }

    // LOGGING: Agent Processing Timeline
    console.log('[Persistence] Logging Agent Processing Timeline...');

    for (const container of containers) {
        const cNum = container.containerNumber;
        const meta = container.metadata as any;
        const rawRowId = meta?._internal?.rawRowId;

        try {
            // 1. ARCHIVIST LOG (Retroactive)
            if (rawRowId) {
                await prisma.agentProcessingLog.create({
                    data: {
                        containerId: cNum,
                        stage: 'ARCHIVIST',
                        status: 'COMPLETED',
                        timestamp: new Date(meta.ingestedAt || new Date()),
                        output: {
                            rowId: rawRowId,
                            note: "Captured from raw import"
                        }
                    }
                });
            }

            // 2. TRANSLATOR LOG (Retroactive)
            const containerMapping = translatorOutput.containers.find(mc => mc.rawRowId === rawRowId);

            if (containerMapping) {
                const shouldLogFull = containerMapping.overallConfidence < 0.90 || (containerMapping.flagsForReview?.length || 0) > 0;

                await prisma.agentProcessingLog.create({
                    data: {
                        containerId: cNum,
                        stage: 'TRANSLATOR',
                        status: 'COMPLETED',
                        timestamp: new Date(),
                        confidence: containerMapping.overallConfidence,
                        mappings: containerMapping.fields as any,
                        dictionaryVersion: translatorOutput.dictionaryVersion,
                        output: shouldLogFull ? JSON.parse(JSON.stringify(containerMapping)) : { summary: "High confidence mapping" }
                    }
                });
            }

            // 3. PERSISTENCE LOG (Current)
            const createdEvents = events.filter(e => e.containerId === cNum);
            const shipmentId = await prisma.shipmentContainer.findFirst({ where: { containerId: cNum }, select: { shipmentId: true } });

            await prisma.agentProcessingLog.create({
                data: {
                    containerId: cNum,
                    stage: 'PERSISTENCE',
                    status: 'COMPLETED',
                    timestamp: new Date(),
                    output: {
                        eventsGenerated: createdEvents.length,
                        shipmentLinked: shipmentId?.shipmentId || null,
                        eventTypes: createdEvents.map(e => e.stageName)
                    }
                }
            });

        } catch (logErr) {
            console.error(`[Persistence] Failed to log timeline for ${cNum}:`, logErr);
        }
    }

    return { containers, events };
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
