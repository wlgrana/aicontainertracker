"use client";

import React from 'react';
import { Database, FileText, Activity, Layers, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DataLineageContentProps {
    data: any;
}

// Helper to strip AI metadata from unmapped fields for cleaner display
// Helper to strip AI metadata from unmapped fields for cleaner display
function sanitizeMetadata(metadata: any, externalRawData: any = null) {
    if (!metadata && !externalRawData) return null;

    // Deep clone to avoid mutating state
    const clean = metadata ? JSON.parse(JSON.stringify(metadata)) : {};

    // Sanitize unmappedFields if they exist
    if (clean.mapping && clean.mapping.unmappedFields) {
        const sanitizedUnmapped: any = {};
        Object.entries(clean.mapping.unmappedFields).forEach(([key, value]: [string, any]) => {
            // If value is our AI object format with rawValue, extract just the raw value
            if (value && typeof value === 'object' && 'rawValue' in value) {
                sanitizedUnmapped[key] = value.rawValue;
            } else {
                // Otherwise keep as is (it might be a direct value already)
                sanitizedUnmapped[key] = value;
            }
        });
        clean.mapping.unmappedFields = sanitizedUnmapped;
    }

    // Explicitly keep only the requested top-level keys
    return {
        raw: externalRawData || clean.raw,
        mapping: clean.mapping,
        lastAudit: clean.lastAudit
    };
}

export default function DataLineageContent({ data }: DataLineageContentProps) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. System Metadata Cards */}
            {/* 1. System Metadata Cards */}
            {/* 1. Import Event Details */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="h-4 w-4" /> Import Event Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <span className="text-xs text-slate-500 block mb-1">Import ID</span>
                            <span className="font-mono text-xs font-bold text-slate-700 block truncate" title={data.importLogId}>
                                {data.importLogId || "Manual Entry"}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 block mb-1">Import Date</span>
                            <span className="font-mono text-xs font-bold text-slate-700 block">
                                {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "-"}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 block mb-1">Row Number</span>
                            <span className="font-mono text-xs font-bold text-slate-700 block">
                                {data.meta?.rawRowId || "-"}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 block mb-1">Last Updated</span>
                            <span className="font-mono text-xs font-bold text-slate-700 block">
                                {data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "-"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 1b. Unmapped Data Report */}
            {data.metadata?.lastAudit?.unmappedFields?.length > 0 && data.rawRowData && Array.isArray(data.metadata.lastAudit.unmappedFields) && (
                <Card className="bg-slate-50 border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Database className="h-4 w-4 text-indigo-500" /> Additional Metadata
                                </CardTitle>
                                <CardDescription className="text-slate-500 text-xs mt-1">
                                    Valid data found in the source file that was not mapped to a specific schema field.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">
                                {data.metadata.lastAudit.unmappedFields.length} Fields
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-bold text-slate-500 text-xs uppercase tracking-wider w-1/3">Field Name</th>
                                        <th className="px-4 py-2 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.metadata.lastAudit.unmappedFields.map((field: string) => {
                                        const val = data.rawRowData[field];
                                        return (
                                            <tr key={field} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                                <td className="px-4 py-2 font-mono text-xs text-slate-600 truncate font-bold">{field}</td>
                                                <td className="px-4 py-2 font-mono text-xs text-slate-800 break-all">{val !== undefined && val !== null ? String(val) : <span className="text-slate-300 italic">null</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 2. Raw JSON Viewers */
            }
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Container Record (Database) */}
                <Card className="bg-slate-950 border-slate-800 shadow-inner">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                            <Database className="h-4 w-4" /> Container Record
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            Current data stored in the `Container` table (excluding valid relations).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full rounded-md border border-slate-800 bg-slate-950/50 p-4">
                            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                                {(() => {
                                    if (!data) return "// No Data";
                                    // Strip relations and injected fields to show only Container table columns
                                    const {
                                        events,
                                        shipmentContainers,
                                        attentionFlags,
                                        activityLogs,
                                        statusOverrides,
                                        stage,
                                        rawRowData,
                                        riskAssessment, // Often stored in separate table or JSON, keeping it if it's a field, but schema says separate relation?
                                        // actions.ts includes `riskAssessment` in fetching? No, `include` didn't show `riskAssessment` in `getContainerDetails`...
                                        // Wait, getDashboardData included it. getContainerDetails did NOT include riskAssessment in `include` block in actions.ts step 64.
                                        // So it might not be there. Safe to destructure what we know.
                                        ...containerFields
                                    } = data;
                                    return JSON.stringify(containerFields, null, 2);
                                })()}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Raw Metadata (Import) */}
                <Card className="bg-slate-950 border-slate-800 shadow-inner">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-blue-400 flex items-center gap-2">
                            <Database className="h-4 w-4" /> Raw Import Data
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            Original raw data from Excel import row.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full rounded-md border border-slate-800 bg-slate-950/50 p-4">
                            <pre className="text-xs font-mono text-blue-400/90 whitespace-pre-wrap">
                                {data.metadata || data.rawRowData ? JSON.stringify(sanitizeMetadata(data.metadata, data.rawRowData), null, 2) : "// No Raw Metadata found"}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
