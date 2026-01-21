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
            _count: {
                select: {
                    containers: true,
                    rawRows: true
                }
            }
        }
    });

    console.log('[getHistoryLogs] Fetched from DB:', logs.length, 'logs');
    console.log('[getHistoryLogs] Log filenames:', logs.map(l => l.fileName));

    // Enrich logs with quality metrics (now using denormalized data from ImportLog)
    const enrichedLogs = logs.map((log) => {
        // Type assertion for new fields (Prisma types will sync after IDE refresh)
        const logData = log as any;

        // Calculate quality grade from overall confidence
        const confidence = logData.overallConfidence ? parseFloat(logData.overallConfidence.toString()) : 0;
        let qualityGrade = 'NEEDS_IMPROVEMENT';

        if (confidence >= 0.90) qualityGrade = 'EXCELLENT';
        else if (confidence >= 0.75) qualityGrade = 'GOOD';
        else if (confidence >= 0.60) qualityGrade = 'NEEDS_IMPROVEMENT';
        else qualityGrade = 'POOR';

        return {
            ...log,
            // New metadata fields (now available directly from ImportLog)
            fileSizeBytes: logData.fileSizeBytes,
            processingDurationMs: logData.processingDurationMs,
            containersCreated: logData.containersCreated || 0,
            containersUpdated: logData.containersUpdated || 0,
            containersEnriched: logData.containersEnriched || 0,
            overallConfidence: confidence,
            unmappedFieldsCount: logData.unmappedFieldsCount || 0,
            discrepanciesFound: logData.discrepanciesFound || 0,
            discrepanciesPatched: logData.discrepanciesPatched || 0,
            importSource: logData.importSource,

            // Quality metrics (simplified using denormalized data)
            qualityMetrics: {
                totalContainers: log._count.containers,
                processedContainers: log.rowsSucceeded,
                avgCaptureRate: confidence,
                minCaptureRate: 0,
                maxCaptureRate: 1,
                totalFieldsMapped: ((log.aiAnalysis as any)?.detectedHeaders?.length || 0) - (logData.unmappedFieldsCount || 0),
                totalFieldsUnmapped: logData.unmappedFieldsCount || 0,
                uniqueUnmappedFields: [],
                avgMappingConfidence: confidence,
                lowConfidenceCount: confidence < 0.75 ? 1 : 0,
                qualityTiers: {
                    excellent: confidence >= 0.90 ? 1 : 0,
                    good: confidence >= 0.75 && confidence < 0.90 ? 1 : 0,
                    needsImprovement: confidence >= 0.60 && confidence < 0.75 ? 1 : 0,
                    poor: confidence < 0.60 ? 1 : 0
                },
                qualityGrade,
                recommendImprovement: confidence < 0.90
            }
        };
    });

    return enrichedLogs;
}


