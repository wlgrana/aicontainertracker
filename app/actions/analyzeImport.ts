import { highThink } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { SchemaMapping } from '../../agents/schema-detector';
import { normalizeData } from '../../agents/data-normalizer';

export interface ImportAnalysis {
    criticalAlerts: Array<{
        message: string;
        severity: 'critical' | 'high' | 'medium';
        containerCount: number;
        estimatedImpact?: string;
    }>;
    financialSummary: {
        totalFreight: string;
        demurrageRisk: string;
        avgCostPerContainer: string;
        anomalies: Array<{ container: string; amount: string; reason: string }>;
    };
    dataQuality: {
        score: number; // 0-100
        completeness: Record<string, number>;
        issues: string[];
        normalizationResults: {
            businessUnits: { raw: number; normalized: number };
            ports: { raw: number; normalized: number };
            carriers: { raw: number; normalized: number };
        };
    };
    operationalInsights: Array<{
        category: 'fleet' | 'route' | 'performance' | 'trend';
        insight: string;
        metric?: string;
    }>;
    topExceptions: Array<{
        containerId: string;
        containerNumber: string;
        issue: string;
        severity: 'critical' | 'high' | 'medium';
        details: string;
        recommendedAction: string;
    }>;
    recommendedActions: Array<{
        action: string;
        priority: 'urgent' | 'high' | 'normal';
        affectedContainers: number;
    }>;
    summary: {
        totalContainers: number;
        totalShipments: number;
        totalEvents: number;
        dateRange: string;
        processingTime: string;
    };
}

export async function analyzeImport(importLogId: string, mapping?: SchemaMapping): Promise<ImportAnalysis> {
    // 1. GATHER DATA FROM DATABASE
    const importLog = await prisma.importLog.findUnique({
        where: { fileName: importLogId },
        include: { rawRows: true }
    });

    if (!importLog) {
        throw new Error(`Import log not found: ${importLogId}`);
    }

    // 1b. PROCESS ROWS (MISSION ORACLE INGESTION)
    if (mapping && importLog.rawRows.length > 0) {
        console.log(`Mission Oracle: Processing ${importLog.rawRows.length} raw rows...`);
        let successCount = 0;

        // Re-hydrate status map if needed (passed as object usually via server actions)
        if (mapping.statusCache && !(mapping.statusCache instanceof Map)) {
            mapping.statusCache = new Map(Object.entries(mapping.statusCache));
        } else if (!mapping.statusCache) {
            mapping.statusCache = new Map();
        }

        for (const rawRow of importLog.rawRows) {
            try {
                const rowData = JSON.parse(rawRow.data);
                const normalized = await normalizeData(rowData, mapping);

                if (normalized) {
                    // 1. Shipment
                    if (normalized.shipment.reference) {
                        await prisma.shipment.upsert({
                            where: { shipmentReference: normalized.shipment.reference },
                            update: {
                                businessUnit: normalized.shipment.businessUnit,
                                transportMode: normalized.shipment.transportMode,
                                freightCost: normalized.shipment.freightCost,
                                shipmentVolume: normalized.shipment.volume,
                                bookingDate: normalized.shipment.bookingDate,
                                carrier: normalized.container.carrier,
                                forwarder: importLog.forwarder,
                                destinationCity: normalized.shipment.destinationCity,
                                shipper: normalized.shipment.shipper,
                                consignee: normalized.shipment.consignee,
                                mbl: normalized.shipment.mbl,
                                totalPieces: normalized.shipment.pieces,
                                totalWeight: normalized.shipment.weight,
                                notes: normalized.shipment.notes,
                                pol: normalized.shipment.pol,
                                pod: normalized.shipment.pod,
                                metadata: normalized.metadata as any, // JSON
                                importLogId: importLogId
                            },
                            create: {
                                shipmentReference: normalized.shipment.reference,
                                businessUnit: normalized.shipment.businessUnit,
                                transportMode: normalized.shipment.transportMode,
                                freightCost: normalized.shipment.freightCost,
                                shipmentVolume: normalized.shipment.volume,
                                bookingDate: normalized.shipment.bookingDate,
                                carrier: normalized.container.carrier,
                                forwarder: importLog.forwarder,
                                destinationCity: normalized.shipment.destinationCity,
                                shipper: normalized.shipment.shipper,
                                consignee: normalized.shipment.consignee,
                                mbl: normalized.shipment.mbl,
                                totalPieces: normalized.shipment.pieces,
                                totalWeight: normalized.shipment.weight,
                                notes: normalized.shipment.notes,
                                pol: normalized.shipment.pol,
                                pod: normalized.shipment.pod,
                                metadata: normalized.metadata as any,
                                importLogId: importLogId
                            }
                        });
                    }

                    // 2. Container
                    const hasException = !normalized.container.lastFreeDay;
                    const exceptionType = hasException ? 'Missing Last Free Day' : null;

                    // LOCK CHECK STRATEGY
                    // We must check if the container exists and has locked fields before updating.
                    const existingContainer = await prisma.container.findUnique({
                        where: { containerNumber: normalized.container.containerNumber },
                        select: { metadata: true }
                    });

                    const lockedFields = new Set<string>((existingContainer?.metadata as any)?.lockedFields || []);

                    // Build the Payload
                    const containerPayload = {
                        containerType: normalized.container.containerType,
                        statusLastUpdated: new Date(normalized.event.eventDateTime),
                        currentStatus: normalized.event.stageName,
                        currentLocation: normalized.event.location,
                        carrier: normalized.container.carrier,
                        gateOutDate: normalized.container.gateOutDate,
                        emptyReturnDate: normalized.container.emptyReturnDate,
                        mbl: normalized.container.mbl,
                        pol: normalized.container.pol,
                        pod: normalized.container.pod,
                        atd: normalized.container.atd,
                        ata: normalized.container.ata,
                        eta: normalized.container.eta,
                        etd: normalized.container.etd,
                        lastFreeDay: normalized.container.lastFreeDay,
                        grossWeight: normalized.container.grossWeight,
                        metadata: normalized.metadata as any,
                        importLogId: importLogId,
                        hasException: hasException,
                        exceptionType: exceptionType,
                        healthScore: normalized.container.healthScore,
                        daysInTransit: normalized.container.daysInTransit,
                        aiOperationalStatus: normalized.container.aiOperationalStatus,
                        aiAttentionCategory: normalized.container.aiAttentionCategory
                    };

                    // Filter Locked Fields for UPDATE only
                    const updatePayload = { ...containerPayload };
                    if (existingContainer) {
                        const PROTECTED_FIELDS = ['pol', 'pod', 'containerType', 'grossWeight', 'currentVessel', 'currentVoyage', 'atd', 'eta', 'lastFreeDay', 'carrier'];
                        PROTECTED_FIELDS.forEach(field => {
                            if (lockedFields.has(field)) {
                                // @ts-ignore
                                delete updatePayload[field];
                            }
                        });
                    }

                    await prisma.container.upsert({
                        where: { containerNumber: normalized.container.containerNumber },
                        update: updatePayload,
                        create: {
                            containerNumber: normalized.container.containerNumber,
                            ...containerPayload
                        }
                    });

                    // 3. Link
                    if (normalized.shipment.reference) {
                        const exists = await prisma.shipmentContainer.findFirst({
                            where: { shipmentId: normalized.shipment.reference, containerId: normalized.container.containerNumber }
                        });
                        if (!exists) {
                            await prisma.shipmentContainer.create({
                                data: { shipmentId: normalized.shipment.reference, containerId: normalized.container.containerNumber }
                            });
                        }
                    }

                    // 4. Event
                    await prisma.containerEvent.create({
                        data: {
                            containerId: normalized.container.containerNumber,
                            stageName: normalized.event.stageName,
                            eventDateTime: new Date(normalized.event.eventDateTime),
                            location: normalized.event.location,
                            source: 'MissionOracle',
                            sourceFileId: importLogId
                        }
                    });

                    successCount++;
                }
            } catch (e) {
                console.error(`Row Processing Error: ${e}`);
            }
        }
        console.log(`Mission Oracle: Persisted ${successCount} rows.`);
    }

    // Get containers from this import (linked via ImportLog relation not direct field on Container usually, strictly checking schema)
    // Schema check: Container doesn't have importLogId. It has relationships via events or we infer from createdAt/events.
    // Actually, importLog has `containerEvents`. We can get unique containers from there.

    const containerEvents = await prisma.containerEvent.findMany({
        where: { sourceFileId: importLogId },
        include: { container: true },
        distinct: ['containerId']
    });

    const containerIds = containerEvents.map(e => e.containerId);

    const containers = await prisma.container.findMany({
        where: {
            containerNumber: { in: containerIds }
        },
        include: {
            events: { orderBy: { eventDateTime: 'desc' } },
            shipmentContainers: {
                include: { shipment: true }
            },
            // carrier: true, // Relation might not exist directly on container if carrier is string, checking schema... carrier is String? 
            // Schema says carrier String? 
        },
        take: 100 // Limit for token efficiency
    });

    // 2. CALCULATE KEY METRICS
    const now = new Date();
    const lastFreeDay = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    const atRiskContainers = containers.filter(c => {
        const arrivalEvent = c.events.find(e => e.stageName === 'ARR');
        const gateOutEvent = c.events.find(e => e.stageName === 'OUT');
        return arrivalEvent && !gateOutEvent && arrivalEvent.eventDateTime < lastFreeDay;
    });

    const customsHolds = containers.filter(c => c.currentStatus === 'CUS');

    const missingDates = {
        gateOut: containers.filter(c => !c.events.some(e => e.stageName === 'OUT')).length,
        emptyReturn: containers.filter(c => !c.emptyIndicator).length // Using emptyIndicator as proxy for return or check 'MTY' status
    };

    // Mock freight cost for now as it's not in schema explicitly as 'freightCost'
    // const freightCosts = containers.map(c => 0).filter(cost => cost > 0);
    const avgFreight = 4000; // Placeholder
    const outlierCosts: any[] = [];

    // 3. BUILD GEMINI PROMPT
    const prompt = `You are Mission Oracle, an AI logistics intelligence analyst.

IMPORT SUMMARY:
- File: ${importLog.fileName}
- Containers: ${containers.length}
- Date range: ${getDateRange(containers)}
- Import completed: ${importLog.importedOn?.toISOString()}

OPERATIONAL DATA:
- At-risk (demurrage): ${atRiskContainers.length} containers
- Customs holds: ${customsHolds.length} containers  
- Missing gate-out: ${missingDates.gateOut} containers (${Math.round(missingDates.gateOut / containers.length * 100)}%)
- Missing empty return: ${missingDates.emptyReturn} containers (${Math.round(missingDates.emptyReturn / containers.length * 100)}%)

FINANCIAL DATA:
- Average freight cost: $${Math.round(avgFreight).toLocaleString()} (Estimated)
- Cost outliers detected: ${outlierCosts.length}

TOP PROBLEM CONTAINERS (need immediate attention):
${atRiskContainers.slice(0, 10).map(c => {
        const arrivalEvent = c.events.find(e => e.stageName === 'ARR');
        const daysOverdue = arrivalEvent ? Math.floor((now.getTime() - arrivalEvent.eventDateTime.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return `- ${c.containerNumber}: ${daysOverdue} days since arrival, no gate-out`;
    }).join('\n')}

CUSTOMS HOLD DETAILS:
${customsHolds.slice(0, 5).map(c => `- ${c.containerNumber}: Status CUS`).join('\n')}

YOUR TASK:
Analyze this data and provide actionable intelligence. Focus on:
1. What needs URGENT attention (demurrage risk, customs delays)
2. Financial anomalies that need verification
3. Data quality issues affecting operations
4. Operational patterns and insights
5. Specific recommended actions

Respond ONLY with valid JSON matching this structure:
{
  "criticalAlerts": [{ "message": "string", "severity": "critical", "containerCount": 0, "estimatedImpact": "string" }],
  "financialSummary": { "totalFreight": "string", "demurrageRisk": "string", "avgCostPerContainer": "string", "anomalies": [] },
  "dataQuality": { "score": 0, "completeness": {}, "issues": [], "normalizationResults": { "businessUnits": {"raw":0,"normalized":0}, "ports": {"raw":0,"normalized":0}, "carriers": {"raw":0,"normalized":0} } },
  "operationalInsights": [{ "category": "route", "insight": "string", "metric": "string" }],
  "topExceptions": [{ "containerId": "string", "containerNumber": "string", "issue": "string", "severity": "critical", "details": "string", "recommendedAction": "string" }],
  "recommendedActions": [{ "action": "string", "priority": "urgent", "affectedContainers": 0 }],
  "summary": { "totalContainers": 0, "totalShipments": 0, "totalEvents": 0, "dateRange": "string", "processingTime": "string" }
}
`;

    // 4. CALL GEMINI
    try {
        const responseText = await highThink(prompt);

        // Extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
            responseText.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

        const analysis: ImportAnalysis = JSON.parse(jsonStr);

        // 5. SAVE ANALYSIS TO DATABASE
        await prisma.importLog.update({
            where: { fileName: importLogId },
            data: {
                aiAnalysis: analysis as any, // Store as JSONB
                aiAnalyzedAt: new Date()
            }
        });

        return analysis;
    } catch (error) {
        console.error("Gemini analysis failed:", error);
        throw error;
    }
}

function getDateRange(containers: any[]): string {
    const dates = containers
        .flatMap(c => c.events.map((e: any) => e.eventDateTime))
        .sort((a: any, b: any) => a.getTime() - b.getTime());

    if (dates.length === 0) return 'N/A';

    const earliest = dates[0].toISOString().split('T')[0];
    const latest = dates[dates.length - 1].toISOString().split('T')[0];

    return `${earliest} to ${latest}`;
}
