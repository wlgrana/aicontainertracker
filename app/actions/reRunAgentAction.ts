"use server";

import { prisma } from "@/lib/prisma";
import { runTranslator } from "@/agents/translator";
import { runAuditor } from "@/agents/auditor";
import { persistMappedData, applyAuditorCorrections, updateContainerAuditMeta } from "@/lib/persistence";
import { AuditorOutput, AuditorInput } from '@/types/agents';
import { runEnricher } from "@/agents/enricher";
import { AgentStage } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function runAgentAudit(containerNumber: string) {
    console.log(`[Action] Re-running Agent Audit for container ${containerNumber}...`);

    try {
        // 1. Fetch Container to find RawRowId
        const container = await prisma.container.findUnique({
            where: { containerNumber },
        });

        if (!container) throw new Error("Container not found");

        const metadata = container.metadata as any;
        let rawRowId = metadata?._internal?.rawRowId;

        if (!rawRowId) {
            console.warn(`[Action] metadata.rawRowId missing for ${containerNumber}. Attempting fallback search...`);

            // Fallback: Search RawRows by content. This is expensive but necessary for recovery.
            // We look for a RawRow whose 'data' string contains the container number.
            // Note: This matches simple string inclusion, which is decent for a Container Number.
            const candidates = await prisma.rawRow.findMany({
                where: {
                    data: { contains: containerNumber }
                },
                take: 1
            });

            if (candidates.length > 0) {
                rawRowId = candidates[0].id;
                console.log(`[Action] Fallback successful. Found rawRowId: ${rawRowId}`);
            } else {
                // Last ditch: check if previous 'meta' field had it (legacy)
                rawRowId = (container as any).meta?.rawRowId;
            }
        }

        if (!rawRowId) {
            throw new Error("No linked Raw Data found for this container. Cannot re-audit.");
        }

        const rawRow = await prisma.rawRow.findUnique({ where: { id: rawRowId } });
        if (!rawRow) throw new Error("Raw Row record missing.");

        // 2. Fetch Headers
        let headers: string[] = [];
        if (rawRow.originalHeaders) {
            try {
                headers = JSON.parse(rawRow.originalHeaders);
            } catch (e) {
                console.warn("Failed to parse originalHeaders", e);
            }
        }

        // Fallback: Derive headers from data keys if missing
        if (!headers || headers.length === 0) {
            try {
                const dataObj = JSON.parse(rawRow.data);
                headers = Object.keys(dataObj);
                console.log(`[Action] Derived ${headers.length} headers from raw data keys.`);
            } catch (e) {
                throw new Error("Failed to derive headers from raw data.");
            }
        }

        if (headers.length === 0) {
            throw new Error("Raw Row headers missing.");
        }

        // 3. Prepare Translator Input
        const transitStages = await prisma.transitStage.findMany();
        const containerFields = [
            "containerNumber", "currentStatus", "currentLocation", "carrier", "pol", "pod",
            "eta", "ata", "etd", "atd", "lastFreeDay", "pieces", "weight",
            "volume", "sealNumber"
        ];

        // 4. Run Translator (to get Intended Mapping)
        console.log(`[Action] Re-running Translator for mapping context...`);
        const translatorOutput = await runTranslator({
            importLogId: rawRow.importLogId,
            headers: headers,
            rawRows: [{
                id: rawRow.id,
                rowIndex: rawRow.rowNumber,
                rawData: JSON.parse(rawRow.data)
            }],
            existingSchemaFields: containerFields,
            transitStages: transitStages.map(s => s.stageName)
        });

        // 5. Persist (Update DB to match Translator's latest intent)
        console.log(`[Action] Persisting updated translation...`);
        const persistResult = await persistMappedData(rawRow.importLogId, translatorOutput);

        // Fetch the updated container
        const updatedContainer = await prisma.container.findUnique({
            where: { containerNumber }
        });

        if (!updatedContainer) throw new Error("Failed to retrieve updated container after persistence.");

        // 6. Run Auditor V2
        console.log(`[Action] Running Auditor V2...`);

        const simpleMapping: Record<string, string> = {};
        if (translatorOutput.schemaMapping && translatorOutput.schemaMapping.fieldMappings) {
            Object.values(translatorOutput.schemaMapping.fieldMappings).forEach(m => {
                simpleMapping[m.sourceHeader] = m.targetField;
            });
        }

        const auditorInput: AuditorInput = {
            containerNumber: updatedContainer.containerNumber,
            rawData: {
                raw: { originalRow: JSON.parse(rawRow.data) },
                mapping: simpleMapping
            },
            databaseRow: updatedContainer
        };

        const auditResult = await runAuditor(auditorInput);

        // 7. Apply Corrections if needed
        let decision = auditResult.auditResult;

        if (auditResult.auditResult === 'FAIL') {
            const recommendation = auditResult.summary.recommendation;

            if (recommendation === 'AUTO_CORRECT') {
                console.log(`[Action] Applying corrections...`);
                await applyAuditorCorrections(updatedContainer.containerNumber, auditResult);
                decision = 'CORRECTED' as any;
            } else {
                await updateContainerAuditMeta(updatedContainer.containerNumber, auditResult, 'FAIL');
            }
        } else {
            await updateContainerAuditMeta(updatedContainer.containerNumber, auditResult, 'PASS');
        }

        // 8. Revalidate
        revalidatePath(`/container/${containerNumber}`);
        revalidatePath(`/container/${containerNumber}/lineage`);

        return {
            success: true,
            decision: decision,
            report: {
                verified: auditResult.verified.length,
                lost: auditResult.lost.length,
                corrections: Object.keys(auditResult.corrections.fieldsToUpdate).length
            }
        };

    } catch (error: any) {
        console.error("Agent Audit Failed:", error);
        return { success: false, error: error.message };
    }
}

export async function runEnricherAgent(containerNumber: string) {
    console.log(`[Action] Re-running Enricher Agent for container ${containerNumber}...`);

    try {
        const container = await prisma.container.findUnique({
            where: { containerNumber },
        });

        if (!container) throw new Error("Container not found");

        const rawRowId = (container.metadata as any)?._internal?.rawRowId || (container.metadata as any)?.rawRowId;
        let rawMeta: any = {};

        if (rawRowId) {
            const rawRow = await prisma.rawRow.findUnique({ where: { id: rawRowId } });
            if (rawRow) {
                try { rawMeta = JSON.parse(rawRow.data); } catch (e) { }
            }
        } else {
            // Fallback: use rawMetadata field if populated (likely from previous import)
            rawMeta = container.rawMetadata || {};
        }

        const enricherInput = {
            container: container as any,
            rawMetadata: rawMeta,
            mode: 'ON_DEMAND' as const
        };

        const result = runEnricher(enricherInput);

        if (result.aiDerived && Object.keys(result.aiDerived.fields).length > 0) {
            await prisma.container.update({
                where: { containerNumber },
                data: {
                    aiDerived: result.aiDerived as any,
                    aiLastUpdated: new Date()
                }
            });

            // Log event
            await prisma.agentProcessingLog.create({
                data: {
                    containerId: containerNumber,
                    stage: AgentStage.ENRICHER,
                    status: 'COMPLETED',
                    timestamp: new Date(),
                    output: result.aiDerived as any
                }
            });
        }

        revalidatePath(`/container/${containerNumber}`);
        return { success: true, summary: result.summary };

    } catch (e: any) {
        console.error("Enricher Agent Failed:", e);
        return { success: false, error: e.message };
    }
}
