"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PipelineStep } from '@/components/simulation/PipelineStep';
import { CheckCircle2, Loader2, Database, BrainCircuit, Zap, Terminal, ChevronDown, ChevronUp, Play, Square, Trash2, FileSpreadsheet, Languages, ShieldCheck, Search, ArrowRight, RotateCcw, Download, Upload, FileText, Calendar, Package, TruckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

export default function ImportDetailsPage() {
    const params = useParams();
    const [status, setStatus] = useState<any>(null);
    const [logFiles, setLogFiles] = useState<any[]>([]);
    const [stepTimes, setStepTimes] = useState<Record<string, { end: number, duration: number }>>({});
    const [importLog, setImportLog] = useState<any>(null);

    // In a real implementation, we would use params.id to fetch a specific historical import.
    // For now, we read the current global simulation status to replicate the view.

    useEffect(() => {
        // Fetch import log metadata
        const importId = params.id as string;
        if (importId) {
            fetch(`/api/import-logs/${encodeURIComponent(importId)}`)
                .then(r => r.json())
                .then(data => {
                    console.log('[Import Details] Loaded import log:', data);
                    setImportLog(data);
                })
                .catch(console.error);
        }
    }, [params.id]);

    useEffect(() => {
        // Fetch status immediately
        fetch('/api/simulation/status?t=' + Date.now()).then(r => r.json()).then(data => {
            setStatus(data);

            // Reconstruct pseudo-times if available or just default
            if (data.step && !data.step.includes('IDLE')) {
                setStepTimes(prev => {
                    const newTimes = { ...prev };
                    const stepKey = data.step.replace('_COMPLETE', '').replace('_REVIEW', '');
                    if (!newTimes[stepKey] && data.step.includes('COMPLETE')) {
                        newTimes[stepKey] = { end: Date.now(), duration: 2000 };
                    }
                    return newTimes;
                });
            }
        }).catch(console.error);
    }, []);

    const fetchLogs = () => {
        fetch('/api/simulation/logs/list').then(r => r.json()).then(d => {
            const allFiles = d.files || [];
            // Filter to show ONLY the log file associated with this import
            // Use params.id to identify the import, which should match the importLogId
            const importId = params.id as string;
            if (importId) {
                // Match by importLogId (which is the fileName without .log extension)
                setLogFiles(allFiles.filter((f: any) => f.importLogId === importId));
            } else {
                setLogFiles([]);
            }
        }).catch(console.error);
    };

    useEffect(() => {
        fetchLogs();
    }, [params.id]);

    if (!status) return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    );

    const getStepState = (stepName: string) => {
        if (status.step.includes(stepName) && status.step.includes('COMPLETE')) return 'complete';
        if (status.step === stepName) return 'active';
        if (stepName === 'TRANSLATOR' && status.step === 'TRANSLATOR_REVIEW') return 'active';
        if (stepName === 'IMPROVEMENT' && status.step === 'IMPROVEMENT_REVIEW') return 'active';

        const baseSteps = ['ARCHIVIST', 'TRANSLATOR', 'AUDITOR', 'IMPORT', 'IMPROVEMENT'];
        const myBase = stepName;
        // Map Status to Base Step
        let currentBase = 'IDLE';
        if (status.step.includes('ARCHIVIST')) currentBase = 'ARCHIVIST';
        else if (status.step.includes('TRANSLATOR')) currentBase = 'TRANSLATOR';
        else if (status.step.includes('AUDITOR')) currentBase = 'AUDITOR';
        else if (status.step.includes('IMPORT')) currentBase = 'IMPORT';
        else if (status.step.includes('IMPROVEMENT') || status.step === 'VERIFYING') currentBase = 'IMPROVEMENT';

        const myIdx = baseSteps.indexOf(myBase);
        const currentIdx = baseSteps.indexOf(currentBase);

        if (currentIdx > myIdx) return 'complete';
        if (status.step === 'COMPLETE') return 'complete';

        return 'pending';
    };

    // Helper for control calls - though we removed the buttons, some sub-components might trigger them?
    // We will disable them or make them no-op for this read-only view.
    const handleControl = (action: string) => {
        console.log("Read-only view: Action blocked", action);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-slate-400 hover:text-slate-600 -ml-2">
                                <ArrowRight className="w-4 h-4 rotate-180 mr-1" /> Back
                            </Button>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Import Details</h1>
                        <p className="text-slate-500 font-medium">Post-upload analysis and execution log.</p>
                    </div>
                    {/* Upload Bar Removed as requested */}
                </div>

                {/* Import Metadata Card */}
                {importLog && (
                    <Card className="border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* File Name */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">File Name</div>
                                        <div className="font-mono text-sm text-slate-900 truncate" title={importLog.fileName}>
                                            {importLog.fileName}
                                        </div>
                                    </div>
                                </div>

                                {/* Import Date */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                        <Calendar className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Import Date</div>
                                        <div className="text-sm font-semibold text-slate-900">
                                            {new Date(importLog.importedOn).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(importLog.importedOn).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Forwarder */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                        <TruckIcon className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Forwarder</div>
                                        <div className="text-sm font-semibold text-slate-900">
                                            {importLog.forwarder || <span className="text-slate-400 italic">Not specified</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Import Statistics Row */}
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Rows Processed</div>
                                        <div className="text-2xl font-black text-slate-900">{importLog.rowsProcessed || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-green-600 uppercase mb-1">Created</div>
                                        <div className="text-2xl font-black text-green-600">{importLog.containersCreated || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-blue-600 uppercase mb-1">Updated</div>
                                        <div className="text-2xl font-black text-blue-600">{importLog.containersUpdated || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-indigo-600 uppercase mb-1">Total Items</div>
                                        <div className="text-2xl font-black text-indigo-600">
                                            {(importLog.containersCreated || 0) + (importLog.containersUpdated || 0)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-1000 ease-in-out"
                        style={{ width: `${status.progress}%` }}
                    />
                </div>

                <div className="space-y-6">
                    <PipelineStep
                        title="Archivist Agent"
                        description="Ingests raw files and extracts schema information."
                        state={getStepState('ARCHIVIST')}
                        icon={<FileSpreadsheet className="w-6 h-6" />}
                        data={status.agentData?.archivist}
                        timestamp={stepTimes['ARCHIVIST']?.end}
                        duration={stepTimes['ARCHIVIST']?.duration}
                        renderDetails={(data: any) => (
                            <div className="grid grid-cols-2 gap-4 text-sm mt-3 bg-slate-50 p-3 rounded-md border border-slate-100">
                                <div>
                                    <div className="text-xs font-bold text-slate-400">Filename</div>
                                    <div className="font-mono flex items-center gap-2">
                                        {data.filename}
                                        <a href={`/${data.filename}`} download className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors" onClick={(e) => e.stopPropagation()}>
                                            <FileSpreadsheet className="w-3 h-3 mr-1" /> Download
                                        </a>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400">Rows Detected</div>
                                    <div className="font-mono">{data.rowCount}</div>
                                </div>
                                <div className="col-span-2 mt-2 pt-2 border-t border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs font-bold text-slate-400">Detected Headers ({data.headers?.length || 0} Columns)</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-1 bg-slate-100 rounded border border-slate-200">
                                        {(data.headers || []).map((h: string | null, i: number) => (
                                            <Badge key={i} variant="secondary" className="text-[10px] whitespace-nowrap bg-white border border-slate-200 text-slate-700">
                                                {h || `Col ${i + 1}`}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    />

                    <PipelineStep
                        title="Translator Agent"
                        description="Maps raw headers to canonical schema using AI and Dictionary."
                        state={getStepState('TRANSLATOR')}
                        icon={<Languages className="w-6 h-6" />}
                        data={status.agentData?.translator}
                        timestamp={stepTimes['TRANSLATOR']?.end}
                        duration={stepTimes['TRANSLATOR']?.duration}
                        renderDetails={(data: any) => (
                            <div className="space-y-4 mt-3 bg-slate-50 p-4 rounded-md border border-slate-100">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-200">
                                    {data.schemaStats ? (
                                        <>
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 uppercase">Input Cols</div>
                                                <div className="text-2xl font-black text-slate-700">{data.schemaStats.sourceColumns}</div>
                                                <div className="text-[10px] text-slate-400">Total Headers</div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 uppercase">Mapped</div>
                                                <div className="text-2xl font-black text-green-600">{data.schemaStats.mapped}</div>
                                                <div className="text-[10px] text-slate-400">Columns Matched</div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 uppercase">Left Over</div>
                                                <div className="text-2xl font-black text-amber-500">{data.schemaStats.unmapped}</div>
                                                <div className="text-[10px] text-slate-400">Saved to Meta</div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 uppercase">Empty</div>
                                                <div className="text-2xl font-black text-slate-400">{data.schemaStats.missing}</div>
                                                <div className="text-[10px] text-slate-400">Missing in DB</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-4 text-center text-slate-400 text-xs py-2">Waiting for Schema Analysis...</div>
                                    )}
                                </div>

                                {data.schemaMapping && (
                                    <div className="space-y-6">
                                        {/* CRITICAL: Low Confidence / Issues Table */}
                                        {Object.values(data.schemaMapping.fieldMappings || {}).filter((m: any) => m.confidence < 0.8).length > 0 && (
                                            <div className="border border-amber-200 rounded-md overflow-hidden bg-amber-50">
                                                <div className="bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 flex items-center gap-2">
                                                    <Zap className="w-4 h-4 fill-amber-500 text-amber-600" />
                                                    {Object.values(data.schemaMapping.fieldMappings || {}).filter((m: any) => m.confidence < 0.8).length} Low Confidence Mappings
                                                </div>
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-amber-50/50 text-amber-700/60 border-b border-amber-100">
                                                        <tr>
                                                            <th className="p-2">Source Header</th>
                                                            <th className="p-2">Target Field</th>
                                                            <th className="p-2">Confidence</th>
                                                            <th className="p-2">Issue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-amber-100">
                                                        {Object.values(data.schemaMapping.fieldMappings || {}).filter((m: any) => m.confidence < 0.8).map((m: any, i) => (
                                                            <tr key={i} className="bg-white">
                                                                <td className="p-2 font-mono text-slate-700">{m.sourceHeader}</td>
                                                                <td className="p-2 font-mono text-slate-500">{m.targetField || "(unmapped)"}</td>
                                                                <td className="p-2 font-bold text-amber-600">{m.confidence?.toFixed(2)}</td>
                                                                <td className="p-2 text-slate-500 italic">
                                                                    {m.confidence === 0 ? "No dictionary match" : "Below threshold (0.80)"}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-green-500" /> ACTIVE MAPPINGS
                                                </div>
                                                <div className="bg-white rounded border border-slate-200 overflow-hidden text-xs max-h-60 overflow-y-auto">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-slate-50 text-slate-400 sticky top-0">
                                                            <tr><th className="p-2 font-medium">Map Rule</th><th className="p-2 font-medium text-right">Conf.</th></tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {Object.values(data.schemaMapping.fieldMappings || {}).map((m: any, i) => (
                                                                <tr key={i} className="group hover:bg-slate-50">
                                                                    <td className="p-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono text-slate-700" title={m.sourceHeader}>{m.sourceHeader}</span>
                                                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                                                            <span className="font-bold text-blue-600" title={m.targetField}>{m.targetField}</span>
                                                                            {m.targetField === 'etd' && <span className="text-[10px] text-slate-400 ml-1">(Est. Departure)</span>}
                                                                            {m.targetField === 'eta' && <span className="text-[10px] text-slate-400 ml-1">(Est. Arrival)</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2 text-right">
                                                                        {m.confidence > 0.9 ? (
                                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1 py-0 h-4">High</Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1 py-0 h-4">{m.confidence?.toFixed(2)}</Badge>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                                        <Database className="w-3 h-3 text-amber-500" /> LEFT OVER (Meta)
                                                    </div>
                                                    <div className="bg-amber-50 rounded border border-amber-100 p-2 text-xs max-h-40 overflow-y-auto space-y-1">
                                                        {(data.schemaMapping.unmappedSourceFields || []).length > 0 ? (
                                                            data.schemaMapping.unmappedSourceFields.map((u: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center bg-white p-1.5 rounded border border-amber-100 shadow-sm">
                                                                    <span className="font-mono text-slate-600 truncate max-w-[120px]" title={u.sourceHeader}>{u.sourceHeader}</span>
                                                                    <span className="text-[8px] text-amber-600 bg-amber-100 px-1 rounded">Meta</span>
                                                                </div>
                                                            ))
                                                        ) : <div className="text-slate-400 italic p-2">None</div>}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                                        <Square className="w-3 h-3 text-slate-400" /> EMPTY (DB)
                                                    </div>
                                                    <div className="bg-slate-50 rounded border border-slate-200 p-2 text-xs max-h-40 overflow-y-auto space-y-1">
                                                        {(data.schemaMapping.missingSchemaFields || []).length > 0 ? (
                                                            data.schemaMapping.missingSchemaFields.map((f: string, i: number) => (
                                                                <div key={i} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-200 shadow-sm opacity-60">
                                                                    <span className="font-mono text-slate-500 truncate max-w-[120px]" title={f}>{f}</span>
                                                                    <span className="text-[8px] text-slate-400 bg-slate-100 px-1 rounded">Null</span>
                                                                </div>
                                                            ))
                                                        ) : <div className="text-slate-400 italic p-2">None</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    />

                    {/* STEP 3: AUDITOR (Before Import) */}
                    <PipelineStep
                        stepNumber={3}
                        title="Auditor Agent (Quality Gate)"
                        state={getStepState('AUDITOR')}
                        icon={<ShieldCheck className="w-6 h-6" />}
                        data={status.agentData?.auditor}
                        timestamp={stepTimes['AUDITOR']?.end}
                        duration={stepTimes['AUDITOR']?.duration}
                        renderDetails={(data: any) => (
                            <div className="space-y-4 mt-3 bg-slate-50 p-4 rounded-md border border-slate-100">
                                {data.sampleAnalysis ? (
                                    <div className="space-y-4">
                                        {/* AUDITOR SUMMARY STATS */}
                                        <div className="grid grid-cols-4 gap-4 mb-4">
                                            <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                                <div className="text-xs text-slate-400 uppercase font-bold">Total Fields</div>
                                                <div className="text-xl font-black text-slate-700">{data.verifiedCount + data.discrepancyCount}</div>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                                <div className="text-xs text-green-600 uppercase font-bold">Exact Matches</div>
                                                <div className="text-xl font-black text-green-600">{data.verifiedCount}</div>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                                <div className="text-xs text-amber-500 uppercase font-bold">Discrepancies</div>
                                                <div className="text-xl font-black text-amber-500">{data.discrepancyCount}</div>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                                <div className="text-xs text-blue-500 uppercase font-bold">Quality Score</div>
                                                <div className="text-xl font-black text-blue-500">{(data.sampleAnalysis?.captureRate * 100).toFixed(0)}%</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-white">
                                                    Sample Container: {data.sampleAnalysis.container}
                                                </Badge>
                                            </div>
                                            <Badge className={cn(
                                                "font-mono",
                                                !isNaN(Number(data.sampleAnalysis.captureRate)) && Number(data.sampleAnalysis.captureRate) >= 0.9 ? "bg-green-600" :
                                                    !isNaN(Number(data.sampleAnalysis.captureRate)) && Number(data.sampleAnalysis.captureRate) >= 0.7 ? "bg-amber-500" : "bg-red-500"
                                            )}>
                                                Capture Rate: {isNaN(Number(data.sampleAnalysis.captureRate)) ? "0" : (Number(data.sampleAnalysis.captureRate) * 100).toFixed(0)}%
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div className="border rounded bg-white p-2">
                                                <div className="font-semibold text-slate-500 mb-2 border-b pb-1">Raw Source Data</div>
                                                <div className="space-y-1 font-mono">
                                                    {Object.entries(data.sampleAnalysis.raw || {}).map(([k, v]: any) => {
                                                        const isMissed = data.sampleAnalysis.unmapped?.includes(k);
                                                        if (!v && v !== 0) return null; // Skip empty raw fields
                                                        return (
                                                            <div key={k} className={cn(
                                                                "flex justify-between",
                                                                isMissed ? "bg-amber-50 text-amber-700 font-bold px-1 -mx-1 rounded" : "opacity-70"
                                                            )}>
                                                                <span>{k}:</span>
                                                                <span className="truncate max-w-[120px]" title={String(v)}>{String(v)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="border rounded bg-white p-2">
                                                <div className="font-semibold text-slate-500 mb-2 border-b pb-1">Proposed Record</div>
                                                <div className="space-y-1 font-mono">
                                                    {Object.entries(data.sampleAnalysis.db || {})
                                                        .filter(([k]) => !['id', 'metadata', 'meta', 'rawRowId', 'importLogId', 'aiLastUpdated'].includes(k))
                                                        .map(([k, v]: any) => {
                                                            if (!v && v !== 0) return null;
                                                            return (
                                                                <div key={k} className="flex justify-between">
                                                                    <span className="text-slate-600">{k}:</span>
                                                                    <span className="font-semibold text-slate-900 truncate max-w-[120px]" title={String(v)}>{String(v)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    {/* Render Ghost Patches */}
                                                    {Object.entries(data.sampleAnalysis.proposedPatches || {}).map(([raw, target]: any) => (
                                                        <div key={raw} className="flex justify-between bg-green-50 px-1 -mx-1 rounded border border-green-100 animate-pulse">
                                                            <span className="text-green-700 font-bold flex items-center gap-1">
                                                                <Zap className="w-3 h-3" /> {target}:
                                                            </span>
                                                            <span className="text-green-800 italic truncate max-w-[100px] text-[10px] mt-0.5">
                                                                (Auto-Mapped)
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {data.patchedCount > 0 && (
                                            <div className="bg-green-50 p-2 text-[10px] text-green-700 border-t border-green-100 flex items-center gap-2 mt-2 rounded">
                                                <Zap className="w-3 h-3 text-green-500 fill-current" />
                                                <strong>Self-Healing Active:</strong> Automatically patched {data.patchedCount} missing fields in the import map.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-slate-500 text-sm justify-center py-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                        Running Pre-Import Audit...
                                    </div>
                                )}
                            </div>
                        )}
                    />

                    {/* STEP 4: IMPORTER (Persistence) */}
                    <PipelineStep
                        stepNumber={4}
                        title="Importer Agent (Persistence)"
                        state={getStepState('IMPORT')}
                        icon={<Database className="w-6 h-6" />}
                        data={status.agentData?.translator}
                        timestamp={stepTimes['IMPORT']?.end}
                        duration={stepTimes['IMPORT']?.duration}
                        renderDetails={(data: any) => (
                            <div className="space-y-3 mt-3 bg-slate-50 p-3 rounded-md border border-slate-100">
                                {data.stats ? (
                                    <div className="flex gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-green-600 font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> {data.mappedCount} Containers Imported
                                        </div>
                                        <div className="flex items-center gap-1 text-blue-600 font-bold">
                                            <Database className="w-4 h-4" /> {Math.min(100, Math.round((data.stats.avgFieldsPerContainer / data.schemaStats.schemaFields) * 100))}% Data Completeness
                                        </div>
                                        <span className="text-slate-400 text-xs mt-0.5">
                                            (Avg {data.stats.avgFieldsPerContainer} fields/container)
                                        </span>
                                    </div>
                                ) : <div className="text-slate-400 text-xs text-center py-2">Waiting for Import...</div>}

                                {data.importSample && data.importSample.length > 0 ? (
                                    <div className="mt-2 border border-slate-200 rounded-md overflow-hidden bg-white">
                                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
                                            <span>Import Verification Table</span>
                                            <span className="text-slate-400 font-normal">First {data.importSample.length} rows shown</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                                    <tr>
                                                        {Object.keys(data.importSample[0]).map((h) => (
                                                            <th key={h} className="p-2 border-r border-slate-200 border-b whitespace-nowrap bg-slate-50 sticky top-0">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {data.importSample.map((row: any, i: number) => (
                                                        <tr key={i} className="hover:bg-blue-50 transition-colors">
                                                            {Object.keys(data.importSample[0]).map((h) => (
                                                                <td key={h} className="p-2 border-r border-slate-100 truncate max-w-[200px] font-mono text-slate-600">
                                                                    {row[h] === null || row[h] === undefined ?
                                                                        <span className="text-slate-300 italic">null</span> :
                                                                        <span className="text-slate-700">{String(row[h])}</span>
                                                                    }
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 text-xs font-mono text-center py-4 bg-slate-100 rounded border border-slate-200">
                                        {status.message && status.message.includes("Processed") ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                <span className="animate-pulse">{status.message}</span>
                                            </div>
                                        ) : "Waiting for import data to generate preview..."}
                                    </div>
                                )}
                            </div>
                        )}
                    />

                    {/* STEP 5: IMPROVEMENT (Learner) */}
                    <PipelineStep
                        title="Improvement Agent (Learner)"
                        description="Analyzes failures and updates the dictionary autonomously."
                        state={getStepState('IMPROVEMENT')}
                        icon={<BrainCircuit className="w-6 h-6" />}
                        data={status.agentData?.learner}
                        timestamp={stepTimes['IMPROVEMENT']?.end}
                        duration={stepTimes['IMPROVEMENT']?.duration}
                        renderDetails={(data: any) => (
                            <div className="space-y-3 mt-3 bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                <div className="flex justify-between text-sm">
                                    <span className="text-indigo-700 font-bold">Score Improvement</span>
                                    <div className="text-right">
                                        <span className="font-bold text-green-600">+{data.scoreImprovement?.toFixed(1)}%</span>
                                        <div className="text-[10px] text-slate-400">(Current Batch)</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded">
                                    <span className="font-bold">Note:</span> The learning applies to <strong>FUTURE</strong> imports. This batch was already processed.

                                    <div className="mt-1 text-indigo-600 font-semibold">Future Impact: ~{(data.newSynonyms?.length * 1.5).toFixed(0)}% increase est.</div>
                                </div>
                                {data.newSynonyms?.length > 0 && (
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        <div className="text-xs font-bold text-indigo-400 uppercase">New Knowledge Acquired</div>
                                        {data.newSynonyms.map((s: string, i: number) => (
                                            <div key={i} className="text-xs bg-white px-2 py-1 rounded shadow-sm border border-indigo-100 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        isLast
                    />

                    {status.step === 'COMPLETE' && (
                        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl shadow-sm animate-in zoom-in-95 duration-500">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-100 rounded-full text-green-700">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-green-800">Simulation Complete</h2>
                                    <p className="text-green-700 font-medium">Final Import Statistics</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-green-100 hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Processing</div>
                                    <div className="text-3xl font-black text-slate-800">
                                        6.8s
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Total Duration</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-green-100 hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Containers</div>
                                    <div className="text-3xl font-black text-slate-800">
                                        {status.agentData?.translator?.mappedCount || 0}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Successfully Ingested</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-green-100 hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Data Completeness</div>
                                    <div className="text-3xl font-black text-blue-600">
                                        {status.agentData?.translator?.stats ? Math.min(100, Math.round((status.agentData.translator.stats.avgFieldsPerContainer / status.agentData.translator.schemaStats.schemaFields) * 100)) : 0}%
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Avg Fields Populated</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-green-100 hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Knowledge Gained</div>
                                    <div className="text-3xl font-black text-indigo-600">
                                        {status.agentData?.learner?.newSynonyms?.length || 0}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">New Synonyms Learned</div>
                                </div>
                            </div>

                            <div className="mt-6 mb-2">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Performance Breakdown</div>
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-blue-400" style={{ width: '15%' }} title="Archivist" />
                                    <div className="h-full bg-indigo-500" style={{ width: '35%' }} title="Translator" />
                                    <div className="h-full bg-amber-400" style={{ width: '10%' }} title="Auditor" />
                                    <div className="h-full bg-green-500" style={{ width: '20%' }} title="Importer" />
                                    <div className="h-full bg-purple-500" style={{ width: '20%' }} title="Learner" />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                                    <span>Archivist (15%)</span>
                                    <span>Translator (35%)</span>
                                    <span>Auditor (10%)</span>
                                    <span>Importer (20%)</span>
                                    <span>Learner (20%)</span>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-center">
                                <Button onClick={() => window.location.href = '/dashboard'} size="lg" className="w-full md:w-auto bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all font-bold text-lg h-14">
                                    Go to Operational Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-8 mb-12">
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200"><FileText className="w-5 h-5 text-slate-600" /></div>
                                <div className="text-left">
                                    <h3 className="font-bold text-slate-900 text-lg">Simulation Log</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-500 font-medium">Download full execution log for this import.</p>
                                        {status?.logFilename && (
                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                Active: {status.logFilename}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={fetchLogs}
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" /> Refresh
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                {logFiles.length > 0 ? logFiles.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-700 font-mono group-hover:text-blue-700 transition-colors">{f.name}</div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                                    <span>{(f.size / 1024).toFixed(1)} KB</span>
                                                    <span>•</span>
                                                    <span>{new Date(f.time).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href={`/api/simulation/logs/download?importLogId=${f.importLogId || f.name.replace('.log', '')}`}
                                            download={f.name}
                                            className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Download
                                        </a>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 mb-2">
                                            <Search className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="text-sm font-medium text-slate-500">No log file found</div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {status.logFilename ? `Expected: ${status.logFilename}` : "No active log associated with this import."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

