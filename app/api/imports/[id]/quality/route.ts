import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const importLogId = params.id;

    // Get all AgentProcessingLog entries for this import's containers where stage is AUDITOR
    // We join through container -> importLogId to ensure we get logs for this specific import
    const auditLogs = await prisma.agentProcessingLog.findMany({
        where: {
            stage: 'AUDITOR',
            container: {
                importLogId: importLogId
            }
        },
        include: {
            container: true
        }
    });

    if (auditLogs.length === 0) {
        // If no audit logs, return default/empty metrics
        return Response.json({
            totalContainers: 0,
            processedContainers: 0,
            avgCaptureRate: 0,
            uniqueUnmappedFields: [],
            qualityGrade: 'NEEDS_IMPROVEMENT', // Default to low quality if no data
            recommendImprovement: false,
            avgMappingConfidence: 0,
            qualityTiers: {
                excellent: 0,
                good: 0,
                needsImprovement: 0,
                poor: 0
            }
        });
    }

    // Calculate metrics
    let totalCaptureRate = 0;
    let totalConfidence = 0;
    const unmappedFieldsSet = new Set<string>();

    // New Counters
    let totalRawFieldsSum = 0;
    let totalUnmappedCountSum = 0;
    let countWithFindings = 0;

    // Quality tiers count
    let excellentCount = 0;
    let goodCount = 0;
    let needsImprovementCount = 0;
    let poorCount = 0;

    for (const log of auditLogs) {
        const output = (log.output as any) || {};
        const findings = (log.findings as any) || {};

        // Prefer findings (summary from Auditor) over output
        const totalFields = Number(findings.totalRawFields) || Number(output.totalFields) || 20;
        // unmapped count
        let unmappedCount = 0;
        if (typeof findings.unmapped === 'number') {
            unmappedCount = findings.unmapped;
        } else if (Array.isArray(output.unmappedFields)) {
            unmappedCount = output.unmappedFields.length;
        } else if (output.unmapped) {
            // Auditor sometimes puts unmapped array in output.unmapped
            unmappedCount = Array.isArray(output.unmapped) ? output.unmapped.length : 0;
        }

        totalRawFieldsSum += totalFields;
        totalUnmappedCountSum += unmappedCount;
        countWithFindings++;

        // Capture Rate
        let captureRate = 0;
        if (findings.captureRate) {
            // "33%" -> 0.33
            const s = String(findings.captureRate).replace('%', '');
            captureRate = parseFloat(s) / 100;
        } else {
            const mapped = totalFields - unmappedCount; // Backup logic
            captureRate = totalFields > 0 ? mapped / totalFields : 0;
        }
        totalCaptureRate += captureRate;

        // Confidence
        const confidence = Number(log.confidence) || 0;
        totalConfidence += confidence;

        // Collect unmapped fields names for list
        const discrepancies = (log.discrepancies as any) || {};
        const unmappedList = discrepancies.unmapped || output.unmapped || output.unmappedFields;
        if (Array.isArray(unmappedList)) {
            unmappedList.forEach((u: any) => {
                const name = u.rawField || u;
                if (typeof name === 'string') unmappedFieldsSet.add(name);
            });
        }

        // Categorize
        if (captureRate >= 0.90) excellentCount++;
        else if (captureRate >= 0.75) goodCount++;
        else if (captureRate >= 0.60) needsImprovementCount++;
        else poorCount++;
    }

    const validCount = countWithFindings > 0 ? countWithFindings : auditLogs.length; // Avoid div0
    const avgCaptureRate = totalCaptureRate / auditLogs.length; // Use total length for rate as default 0 is valid for missing logs
    const avgMappingConfidence = totalConfidence / auditLogs.length;

    // Averages for Card
    const avgTotalRawFields = Math.round(totalRawFieldsSum / validCount);
    const avgUnmappedFieldsCount = Math.round(totalUnmappedCountSum / validCount);
    const avgMappedFields = avgTotalRawFields - avgUnmappedFieldsCount;

    // Determine overall grade
    const qualityGrade =
        avgCaptureRate >= 0.90 ? 'EXCELLENT' :
            avgCaptureRate >= 0.75 ? 'GOOD' :
                avgCaptureRate >= 0.60 ? 'NEEDS_IMPROVEMENT' :
                    'POOR';

    return Response.json({
        totalContainers: auditLogs.length,
        processedContainers: auditLogs.length,

        avgCaptureRate,
        minCaptureRate: 0,
        maxCaptureRate: 1,

        totalFieldsMapped: avgMappedFields,
        totalFieldsUnmapped: avgUnmappedFieldsCount,
        totalRawFields: avgTotalRawFields, // Added field
        uniqueUnmappedFields: Array.from(unmappedFieldsSet),

        avgMappingConfidence,
        lowConfidenceCount: 0, // Placeholder

        qualityTiers: {
            excellent: excellentCount,
            good: goodCount,
            needsImprovement: needsImprovementCount,
            poor: poorCount
        },

        qualityGrade,
        recommendImprovement: avgCaptureRate < 0.90,
    });
}
