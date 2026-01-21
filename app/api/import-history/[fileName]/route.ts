import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileName: string }> }
) {
    try {
        const resolvedParams = await params;
        const fileName = decodeURIComponent(resolvedParams.fileName);

        // Query ImportLog with all metrics and relationship counts
        const importLog = await prisma.importLog.findUnique({
            where: { fileName },
            include: {
                _count: {
                    select: {
                        rawRows: true,
                        containers: true,
                        shipments: true,
                        containerEvents: true
                    }
                }
            }
        });

        if (!importLog) {
            return NextResponse.json(
                { error: 'Import not found' },
                { status: 404 }
            );
        }

        // Format response with all metrics
        const response = {
            // Basic info
            fileName: importLog.fileName,
            importedOn: importLog.importedOn,
            importedBy: importLog.importedBy,
            status: importLog.status,
            completedAt: importLog.completedAt,
            forwarder: importLog.forwarder,

            // File metadata
            fileStoragePath: importLog.fileStoragePath,
            fileSizeBytes: importLog.fileSizeBytes,
            importSource: importLog.importSource,

            // Processing metrics
            rowsProcessed: importLog.rowsProcessed,
            rowsSucceeded: importLog.rowsSucceeded,
            rowsFailed: importLog.rowsFailed,
            processingDurationMs: importLog.processingDurationMs,

            // Container statistics
            containersCreated: importLog.containersCreated,
            containersUpdated: importLog.containersUpdated,
            containersEnriched: importLog.containersEnriched,

            // Data quality metrics
            overallConfidence: importLog.overallConfidence ? parseFloat(importLog.overallConfidence.toString()) : null,
            unmappedFieldsCount: importLog.unmappedFieldsCount,

            // Auditor metrics
            discrepanciesFound: importLog.discrepanciesFound,
            discrepanciesPatched: importLog.discrepanciesPatched,

            // Parsed JSON fields
            aiAnalysis: importLog.aiAnalysis,
            summary: importLog.summary,
            simulationLog: importLog.simulationLog,

            // Relationship counts
            counts: {
                rawRows: importLog._count.rawRows,
                containers: importLog._count.containers,
                shipments: importLog._count.shipments,
                events: importLog._count.containerEvents
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[API] Error fetching import details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch import details' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ fileName: string }> }
) {
    try {
        const resolvedParams = await params;
        const fileName = decodeURIComponent(resolvedParams.fileName);
        const body = await request.json();
        const { action } = body;

        const importLog = await prisma.importLog.findUnique({
            where: { fileName },
            select: { fileStoragePath: true, simulationLog: true, fileName: true }
        });

        if (!importLog) {
            return NextResponse.json(
                { error: 'Import not found' },
                { status: 404 }
            );
        }

        if (action === 'download') {
            // Download original Excel file
            if (!importLog.fileStoragePath) {
                return NextResponse.json(
                    { error: 'File not available for download' },
                    { status: 404 }
                );
            }

            const fs = require('fs');
            const path = require('path');

            if (!fs.existsSync(importLog.fileStoragePath)) {
                return NextResponse.json(
                    { error: 'File not found on server' },
                    { status: 404 }
                );
            }

            const fileBuffer = fs.readFileSync(importLog.fileStoragePath);
            const originalFileName = path.basename(importLog.fileStoragePath);

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${originalFileName}"`
                }
            });

        } else if (action === 'download-log') {
            // Download simulation log
            if (!importLog.simulationLog) {
                return NextResponse.json(
                    { error: 'Simulation log not available' },
                    { status: 404 }
                );
            }

            const logFileName = `${importLog.fileName.replace(/\.[^/.]+$/, '')}_simulation.log`;

            return new NextResponse(importLog.simulationLog, {
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Disposition': `attachment; filename="${logFileName}"`
                }
            });

        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('[API] Error processing action:', error);
        return NextResponse.json(
            { error: 'Failed to process action' },
            { status: 500 }
        );
    }
}
