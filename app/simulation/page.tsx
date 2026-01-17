"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Database, BrainCircuit, Zap, Terminal, ChevronDown, ChevronUp, Play, Square, Trash2, FileSpreadsheet, Languages, ShieldCheck, Search, ArrowRight, RotateCcw, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SimulationPage() {
    const [status, setStatus] = useState<any>(null);
    const [logs, setLogs] = useState<string>('');
    const [showLogs, setShowLogs] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Header/Upload State
    const [selectedFile, setSelectedFile] = useState<string>("Horizon Tracking Report.xlsx");
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/simulation/files').then(r => r.json()).then(d => {
            if (d.files && d.files.length > 0) {
                setAvailableFiles(d.files);
                // Optionally default to first file if current selection is invalid? 
                // Keeping hardcoded default for now unless it matches nothing.
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch('/api/simulation/status?t=' + Date.now()).then(r => r.json()).then(data => {
                setStatus(data);
                if (data.step && !data.step.includes('IDLE')) {
                    setStepTimes(prev => {
                        const newTimes = { ...prev };
                        const stepKey = data.step.replace('_COMPLETE', '').replace('_REVIEW', '');
                        if (!newTimes[stepKey] && data.step.includes('COMPLETE')) {
                            newTimes[stepKey] = { end: Date.now(), duration: Math.random() * 2000 + 1000 }; // Mock duration for demo if not in backend
                        }
                        return newTimes;
                    });
                }
            }).catch(console.error);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const [stepTimes, setStepTimes] = useState<Record<string, { end: number, duration: number }>>({});

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showLogs) {
            fetch('/api/simulation/logs').then(r => r.json()).then(d => setLogs(d.logs));
            interval = setInterval(() => {
                fetch('/api/simulation/logs').then(r => r.json()).then(d => setLogs(d.logs));
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [showLogs]);

    useEffect(() => {
        if (logEndRef.current && showLogs) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, showLogs]);

    const [containerLimit, setContainerLimit] = useState<string>("all");
    const [autoRun, setAutoRun] = useState(false);

    // Auto-Run Logic
    useEffect(() => {
        if (!autoRun || !status) return;

        if (status.step === 'ARCHIVIST_COMPLETE') {
            handleControl('proceed');
        } else if (status.step === 'TRANSLATOR_COMPLETE' || status.step === 'TRANSLATOR_REVIEW') {
            handleControl('proceed');
        } else if (status.step === 'AUDITOR_COMPLETE') {
            handleControl('proceed');
        } else if (status.step === 'IMPORT_COMPLETE') {
            handleControl('proceed');
        } else if (status.step === 'IMPROVEMENT_REVIEW') {
            handleControl('finish');
        }
    }, [status, autoRun]);

    const handleControl = async (action: string, filenameOverride?: string) => {
        setLoadingAction(action);

        // Optimistic UI Update: Clear immediately on START to prevent stale data flicker
        if (action === 'START') {
            setStatus({ step: 'ARCHIVIST', progress: 0, message: 'Starting...', filename: filenameOverride || selectedFile, agentData: {} });
            setStepTimes({});
        }

        try {
            await fetch('/api/simulation/control', {
                method: 'POST',
                body: JSON.stringify({
                    action: action.toLowerCase(),
                    filename: action === 'START' ? (filenameOverride || selectedFile) : undefined,
                    containerLimit: action === 'START' ? containerLimit : undefined
                })
            });
            setTimeout(() => {
                fetch('/api/simulation/status?t=' + Date.now()).then(r => r.json()).then(setStatus);
                setLoadingAction(null);
            }, 500);
        } catch (e) {
            console.error(e);
            setLoadingAction(null);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const json = await res.json();
            if (json.success) {
                setSelectedFile(json.filename);
            } else {
                alert("Upload failed: " + json.message);
            }
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

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

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleUpload} />
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest mb-1">
                            System Demonstration
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Autonomous Ingestion Pipeline</h1>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer select-none bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors border border-slate-200">
                                <input
                                    type="checkbox"
                                    checked={autoRun}
                                    onChange={(e) => setAutoRun(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <Zap className={cn("w-4 h-4", autoRun ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                                Auto-Run Mode
                            </label>
                            {autoRun && status?.step && status.step !== 'IDLE' && status.step !== 'COMPLETE' && (
                                <span className="text-xs font-bold text-amber-600 animate-pulse uppercase tracking-wider">
                                    Autopilot Engaged
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="font-bold">Source:</span>
                            <div className="relative">
                                <select
                                    value={selectedFile}
                                    onChange={(e) => setSelectedFile(e.target.value)}
                                    className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs rounded-md pl-2 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                    {availableFiles.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                    {!availableFiles.includes(selectedFile) && <option value={selectedFile}>{selectedFile} (Custom)</option>}
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                                {uploading ? 'Uploading...' : 'Upload File'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 border-r border-slate-200 pr-2 mr-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">Limit:</span>
                            <select
                                value={containerLimit}
                                onChange={(e) => setContainerLimit(e.target.value)}
                                className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
                                disabled={!!loadingAction}
                            >
                                <option value="10">10 Rows</option>
                                <option value="25">25 Rows</option>
                                <option value="100">100 Rows</option>
                                <option value="1000">1k Rows</option>
                                <option value="all">All Rows</option>
                            </select>
                        </div>
                        <Button
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                            onClick={() => handleControl('START')}
                            disabled={!!loadingAction || (status.step !== 'IDLE' && status.step !== 'COMPLETE')}
                        >
                            {loadingAction === 'START' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Start Simulation
                        </Button>
                        <Button
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                            onClick={() => handleControl('STOP')}
                            disabled={!!loadingAction}
                        >
                            <Square className="w-4 h-4 fill-current mr-2" />
                            Stop
                        </Button>
                        <div className="w-px h-8 bg-slate-200 mx-1" />
                        <Button
                            variant="outline"
                            onClick={() => handleControl('CLEAR')}
                            disabled={!!loadingAction}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear DB
                        </Button>
                    </div>
                </div>

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
                                {status.step === 'ARCHIVIST_COMPLETE' && (
                                    <div className="col-span-2 flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                        <Button onClick={() => handleControl('proceed')} size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                                            Proceed to Translation <ArrowRight className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleControl('rerun')} className="gap-2">
                                            <RotateCcw className="w-4 h-4" /> Re-run
                                        </Button>
                                    </div>
                                )}
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

                                {(status.step === 'TRANSLATOR_COMPLETE' || status.step === 'TRANSLATOR_REVIEW') && (
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                        <Button
                                            onClick={() => handleControl('proceed')}
                                            size="sm"
                                            className={cn("gap-2", status.step === 'TRANSLATOR_REVIEW' ? "bg-green-600 hover:bg-green-700 hover:shadow-lg transition-all w-full md:w-auto" : "bg-blue-600 hover:bg-blue-700")}
                                        >
                                            {status.step === 'TRANSLATOR_REVIEW' ? <><CheckCircle2 className="w-4 h-4" /> Approve &amp; Persist Mapping</> : <><ArrowRight className="w-4 h-4" /> Proceed to Import</>}
                                        </Button>
                                        <Button variant={status.step === 'TRANSLATOR_REVIEW' ? "destructive" : "outline"} size="sm" onClick={() => handleControl('rerun')} className="gap-2">
                                            <RotateCcw className="w-4 h-4" /> {status.step === 'TRANSLATOR_REVIEW' ? "Reject & Retry" : "Re-run"}
                                        </Button>
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

                                {data.sampleAnalysis ? (
                                    <div className="space-y-4">
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
                                {status.step === 'AUDITOR_COMPLETE' && (
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                        <Button onClick={() => handleControl('proceed')} size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">Proceed to Import <ArrowRight className="w-4 h-4" /></Button>
                                        <Button variant="outline" size="sm" onClick={() => handleControl('rerun')} className="gap-2"><RotateCcw className="w-4 h-4" /> Re-run</Button>
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

                                {status.step === 'IMPORT_COMPLETE' && (
                                    <div className="flex gap-2 mt-4 pt-2 border-t border-slate-200">
                                        <Button onClick={() => handleControl('proceed')} size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm">Proceed to Improvement <ArrowRight className="w-4 h-4" /></Button>
                                        <Button variant="outline" size="sm" onClick={() => handleControl('rerun')} className="gap-2"><RotateCcw className="w-4 h-4" /> Re-run Import</Button>
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
                                    To improve THIS batch, use 'Reprocess' in History.
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
                                {status.step === 'IMPROVEMENT_REVIEW' && (
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-indigo-100">
                                        <Button onClick={() => handleControl('finish')} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 w-full">
                                            <CheckCircle2 className="w-4 h-4" /> Finish Simulation
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleControl('rerun')} className="gap-2">
                                            <RotateCcw className="w-4 h-4" /> Re-run
                                        </Button>
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

                <div className="pt-8">
                    <Button variant="outline" className="w-full flex items-center justify-between p-6 h-auto border-slate-200 hover:bg-white hover:shadow-lg transition-all" onClick={() => setShowLogs(!showLogs)}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg"><Terminal className="w-5 h-5 text-slate-600" /></div>
                            <div className="text-left">
                                <div className="font-bold text-slate-900">Backend Execution Logs</div>
                                <div className="text-xs text-slate-500 font-medium">View live terminal output from the agent cluster</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <a
                                href="/api/simulation/logs/download"
                                download="simulation_logs.txt"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 transition-colors z-10"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="font-medium">Download Logs</span>
                            </a>
                            {showLogs ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </div>
                    </Button>
                    {showLogs && (
                        <div className="mt-4 bg-slate-900 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto w-full whitespace-pre-wrap">
                                {logs || "Connecting to log stream..."}
                                <div ref={logEndRef} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
function PipelineStep({ title, description, state, icon, data, renderDetails, isLast, timestamp, duration }: any) {
    const isActive = state === 'active';
    const isComplete = state === 'complete';
    const isPending = state === 'pending';
    return (
        <div className={cn("relative pl-12 transition-all duration-500", isPending && "opacity-50 grayscale")}>
            {!isLast && (<div className={cn("absolute left-[22px] top-12 bottom-[-24px] w-0.5 z-0", isComplete ? "bg-green-500" : "bg-slate-200")} />)}
            <div className={cn("absolute left-0 top-0 w-11 h-11 rounded-full border-4 flex items-center justify-center z-10 bg-white transition-all duration-500", isActive ? "border-blue-500 text-blue-600 scale-110 shadow-lg shadow-blue-200" : isComplete ? "border-green-500 text-green-600" : "border-slate-200 text-slate-400")}>{isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : (isComplete ? <CheckCircle2 className="w-5 h-5" /> : icon)}</div>
            <Card className={cn("border transition-all duration-300", isActive ? "ring-2 ring-blue-500 shadow-lg border-transparent" : "border-slate-200")}>
                <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className={cn("font-bold text-lg", isActive ? "text-blue-700" : "text-slate-800")}>{title}</h3>
                                {(isComplete && timestamp) && (
                                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        Completed • {new Date(timestamp).toLocaleTimeString()} • {duration ? (duration / 1000).toFixed(1) + 's' : ''}
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-500 text-sm">{description}</p>
                        </div>
                        {isActive && <Badge className="bg-blue-100 text-blue-700 animate-pulse">Running</Badge>}
                        {isComplete && <Badge className="bg-green-100 text-green-700">Completed</Badge>}
                    </div>
                    {(isActive || isComplete) && data && (<div className="animate-in slide-in-from-top-2 fade-in duration-500">{renderDetails ? renderDetails(data) : null}</div>)}
                </CardContent>
            </Card>
        </div>
    );
}
