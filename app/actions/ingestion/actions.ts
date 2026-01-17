"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getImportLogs() {
    return await prisma.importLog.findMany({
        orderBy: { importedOn: 'desc' },
        take: 10
    });
}

export async function getImportLogDetails(fileName: string) {
    const log = await prisma.importLog.findUnique({
        where: { fileName },
        include: {
            rawRows: {
                take: 100 // Limit for performance
            },
            // containers: true // We don't have direct relation, we have to find by importLogId
        }
    });

    if (!log) return null;

    // Fetch related containers manually or via relation if added
    const containers = await prisma.container.findMany({
        where: { importLogId: fileName },
        orderBy: { containerNumber: 'asc' }
    });

    return { ...log, containers };
}

export async function deleteImportLog(fileName: string) {
    await prisma.rawRow.deleteMany({ where: { importLogId: fileName } });
    await prisma.importLog.delete({ where: { fileName } });
    revalidatePath('/ingestion');

}

export async function getHistoryLogs() {
    const logs = await prisma.importLog.findMany({
        orderBy: { importedOn: 'desc' },
        include: {
            // We need containers to link to AgentProcessingLogs efficiently if we want to do it via container relation
            containers: {
                select: { containerNumber: true }
            }
        }
    });

    // Bulk fetch quality metrics
    // We want AgentProcessingLog where stage=AUDITOR and container.importLogId is in our logs
    // But getting all logs might be heavy. Let's do it for the retrieved logs.

    const enrichedLogs = await Promise.all(logs.map(async (log) => {
        // Lightweight metric calc
        const auditLogs = await prisma.agentProcessingLog.findMany({
            where: {
                stage: 'AUDITOR',
                container: { importLogId: log.fileName }
            },
            select: {
                output: true,
                confidence: true
            }
        });

        // Default metrics
        let avgCaptureRate = 0;
        let qualityGrade = 'NEEDS_IMPROVEMENT';
        let qualityTiers = { excellent: 0, good: 0, needsImprovement: 0, poor: 0 };
        const uniqueUnmappedFields: string[] = [];
        let totalContainers = 0;
        let avgMappingConfidence = 0;

        if (auditLogs.length > 0) {
            totalContainers = auditLogs.length;
            let totalCapture = 0;
            let totalConfidence = 0;

            for (const al of auditLogs) {
                const out = (al.output as any) || {};
                const total = Number(out.totalFields) || 20;
                const mapped = Number(out.mappedFields) || 0;
                const rate = (total > 0 ? mapped / total : 0);

                totalCapture += rate;
                totalConfidence += (Number(al.confidence) || 0);

                // Tiers
                if (rate >= 0.90) qualityTiers.excellent++;
                else if (rate >= 0.75) qualityTiers.good++;
                else if (rate >= 0.60) qualityTiers.needsImprovement++;
                else qualityTiers.poor++;
            }

            avgCaptureRate = totalCapture / auditLogs.length;
            avgMappingConfidence = totalConfidence / auditLogs.length;

            if (avgCaptureRate >= 0.90) qualityGrade = 'EXCELLENT';
            else if (avgCaptureRate >= 0.75) qualityGrade = 'GOOD';
            else if (avgCaptureRate >= 0.60) qualityGrade = 'NEEDS_IMPROVEMENT';
            else qualityGrade = 'POOR';
        }

        return {
            ...log,
            qualityMetrics: {
                totalContainers,
                processedContainers: totalContainers,
                avgCaptureRate,
                minCaptureRate: 0,
                maxCaptureRate: 1,
                totalFieldsMapped: 0,
                totalFieldsUnmapped: 0,
                uniqueUnmappedFields,
                avgMappingConfidence,
                lowConfidenceCount: 0,
                qualityTiers,
                qualityGrade,
                recommendImprovement: avgCaptureRate < 0.90
            }
        };
    }));

    return enrichedLogs;
}

