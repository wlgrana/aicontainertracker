
import { archiveExcelFile } from '@/agents/archivist';
import { runTranslator } from '@/agents/translator';
import { runAuditor } from '@/agents/auditor';
import { PrismaClient } from '@prisma/client';
import { TranslatorInput, AuditorOutput, TranslatorOutput, AuditorInput } from '@/types/agents';

const prisma = new PrismaClient();

export async function orchestrateImport(filePath: string, fileName: string, uploadedBy: string = 'SYSTEM') {
    // Step 1: Archive raw data
    console.log('[Orchestrator] Step 1: Archiving raw data...');
    const archiveResult = await archiveExcelFile({ filePath, fileName, uploadedBy });

    // Step 2: Load raw rows
    const rawRows = await prisma.rawRow.findMany({
        where: { importLogId: archiveResult.importLogId },
        orderBy: { rowNumber: 'asc' }
    });

    const rawRowMap = new Map(rawRows.map(r => [r.id, JSON.parse(r.data)]));

    // Step 3: Get schema info (simplified)
    const containerFields = [
        "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod",
        "eta", "ata", "etd", "atd", "lastFreeDay", "pieces", "weight",
        "volume", "sealNumber"
    ];

    const transitStages = await prisma.transitStage.findMany();

    // Step 4: Run Translator
    console.log('[Orchestrator] Step 2: Running Translator...');
    let translatorOutput = await runTranslator({
        importLogId: archiveResult.importLogId,
        headers: archiveResult.headers,
        rawRows: rawRows.map(r => ({
            id: r.id,
            rowIndex: r.rowNumber,
            rawData: JSON.parse(r.data)
        })),
        existingSchemaFields: containerFields,
        transitStages: transitStages.map(s => s.stageName)
    });

    // Step 5: Persist Mapped Data (IMMEDIATELY)
    console.log('[Orchestrator] Step 3: Persisting initial translation to database...');
    const persistResult = await persistMappedData(
        archiveResult.importLogId,
        translatorOutput
    );

    // Step 6: Post-Persistence Audit (The V2 Flow)
    console.log('[Orchestrator] Step 4: Running Auditor V2 on persisted data...');

    const simpleMapping: Record<string, string> = {};
    if (translatorOutput.schemaMapping && translatorOutput.schemaMapping.fieldMappings) {
        Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
            simpleMapping[m.sourceHeader] = m.targetField;
        });
    }

    const auditResults: AuditorOutput[] = [];

    // Audit each container
    for (const container of persistResult.containers) {
        const metadata = container.metadata as any;
        const rawRowId = metadata?._internal?.rawRowId;
        const originalRow = rawRowId ? rawRowMap.get(rawRowId) : {};

        if (!originalRow) {
            console.warn(`[Orchestrator] Warning: No raw row found for container ${container.containerNumber}`);
            continue;
        }

        const auditorInput: AuditorInput = {
            containerNumber: container.containerNumber,
            rawData: {
                raw: { originalRow },
                mapping: simpleMapping
            },
            databaseRow: container
        };

        const auditResult = await runAuditor(auditorInput);
        auditResults.push(auditResult);

        // Auto-Correct Logic
        if (auditResult.auditResult === 'FAIL') {
            const recommendation = auditResult.summary.recommendation;
            const captureRate = parseInt(auditResult.summary.captureRate.replace('%', ''));

            // Safety check: Only auto-correct if recommended
            if (recommendation === 'AUTO_CORRECT') {
                console.log(`[Orchestrator] Applying corrections for ${container.containerNumber} (Capture Rate: ${captureRate}%)...`);
                await applyAuditorCorrections(container.containerNumber, auditResult);
            } else {
                console.log(`[Orchestrator] Skipping auto-correction for ${container.containerNumber}: Recommendation is ${recommendation}`);
                // Even if we skip, we should update metadata to show it FAILED audit
                await updateContainerAuditMeta(container.containerNumber, auditResult, 'FAIL');
            }
        } else {
            // Even if PASS, store the audit result in metadata so we know it was verified
            await updateContainerAuditMeta(container.containerNumber, auditResult, 'PASS');
        }
    }

    // Step 7: Update ImportLog
    const failedCount = auditResults.filter(r => r.auditResult === 'FAIL').length;

    await prisma.importLog.update({
        where: { fileName: archiveResult.importLogId },
        data: {
            status: 'COMPLETED',
            summary: JSON.stringify({
                totalContainers: persistResult.containers.length,
                auditErrorsFound: failedCount,
                auditResults: auditResults.map(r => ({
                    container: r.containerNumber,
                    result: r.auditResult,
                    summary: r.summary
                }))
            }),
            completedAt: new Date(),
            rowsSucceeded: persistResult.containers.length,
        }
    });

    return {
        importLogId: archiveResult.importLogId,
        decision: failedCount === 0 ? 'APPROVED' : 'APPROVED_WITH_CORRECTIONS',
        containersCreated: persistResult.containers.length,
        eventsCreated: persistResult.events.length,
        auditSummary: {
            total: auditResults.length,
            failed: failedCount
        }
    };
}

export async function persistMappedData(
    importLogId: string,
    translatorOutput: TranslatorOutput
) {
    const containers = [];
    const events = [];

    // Valid Status Codes from seed
    const VALID_STAGES = ["BOOK", "CEP", "CGI", "STUF", "LOA", "DEP", "TS1", "TSD", "TSL", "TS1D", "ARR", "DIS", "INSP", "CUS", "REL", "AVL", "CGO", "OFD", "DEL", "STRP", "RET", "O"];

    for (const mappedContainer of translatorOutput.containers) {
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

            const container = await prisma.container.upsert({
                where: { containerNumber: cNum },
                create: {
                    containerNumber: cNum,
                    currentStatus: validStatus,
                    carrier: f.carrier?.value,
                    pol: f.pol?.value,
                    pod: f.pod?.value,
                    etd: f.etd?.value ? new Date(f.etd.value) : null,
                    atd: f.atd?.value ? new Date(f.atd.value) : null,
                    eta: f.eta?.value ? new Date(f.eta.value) : null,
                    ata: f.ata?.value ? new Date(f.ata.value) : null,
                    metadata: metadata,
                    importLogId: importLogId
                },
                update: {
                    atd: f.atd?.value ? new Date(f.atd.value) : undefined,
                    ata: f.ata?.value ? new Date(f.ata.value) : undefined,
                    currentStatus: validStatus,
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
                    finalDestination: f.finalDestination?.value
                },
                update: {
                    mbl: f.mbl?.value,
                    hbl: f.hbl?.value
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
