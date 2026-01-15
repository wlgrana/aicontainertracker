"use client";

import React from 'react';
import { Database, FileText, Activity, Layers, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DataLineageContentProps {
    data: any;
}

export default function DataLineageContent({ data }: DataLineageContentProps) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. System Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Timestamps
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Created At</span>
                            <span className="font-mono text-slate-700">{data.createdAt ? new Date(data.createdAt).toLocaleString() : "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Last Updated</span>
                            <span className="font-mono text-slate-700">{data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">AI Last Analysis</span>
                            <span className="font-mono text-slate-700">{data.aiLastUpdated ? new Date(data.aiLastUpdated).toLocaleString() : "-"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Layers className="h-4 w-4" /> Data Sources
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Import Log ID</span>
                            <span className="font-mono text-xs truncate max-w-[150px] text-slate-700" title={data.importLogId}>{data.importLogId || "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Raw Row ID</span>
                            <span className="font-mono text-xs truncate max-w-[150px] text-slate-700" title={data.meta?.rawRowId}>{data.meta?.rawRowId || "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Confidence</span>
                            <Badge variant={data.meta?.mappingConfidence > 0.8 ? "default" : "secondary"}>
                                {data.meta?.mappingConfidence ? `${Math.round(data.meta.mappingConfidence * 100)}%` : "N/A"}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" /> Integrity Flags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.meta?.flags && Array.isArray(data.meta.flags) && data.meta.flags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {data.meta.flags.map((flag: string, i: number) => (
                                    <Badge key={i} variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">
                                        {flag}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic">No flags raised during import.</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 2. Raw JSON Viewers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* AI Analysis */}
                <Card className="bg-slate-950 border-slate-800 shadow-inner">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                            <Activity className="h-4 w-4" /> AI Analysis Blob
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            Latest output from Mission Oracle agent.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full rounded-md border border-slate-800 bg-slate-950/50 p-4">
                            <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">
                                {data.aiAnalysis ? JSON.stringify(data.aiAnalysis, null, 2) : "// No AI Analysis found"}
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
                                {data.metadata ? JSON.stringify(data.metadata, null, 2) : "// No Raw Metadata found"}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
