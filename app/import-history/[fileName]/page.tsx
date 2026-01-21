"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileText, Clock, Database, CheckCircle2, AlertCircle, TrendingUp, Loader2, Calendar, TruckIcon, FileSpreadsheet, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ContainerInventory } from '@/components/dashboard/ContainerInventory';

interface ImportDetails {
    fileName: string;
    importedOn: string;
    importedBy?: string;
    status: string;
    completedAt?: string;
    forwarder?: string;
    fileStoragePath?: string;
    fileSizeBytes?: number;
    importSource: string;
    rowsProcessed: number;
    rowsSucceeded: number;
    rowsFailed: number;
    processingDurationMs?: number;
    containersCreated: number;
    containersUpdated: number;
    containersEnriched: number;
    overallConfidence?: number;
    unmappedFieldsCount: number;
    discrepanciesFound: number;
    discrepanciesPatched: number;
    aiAnalysis?: any;
    summary?: any;
    simulationLog?: string;
    counts: {
        rawRows: number;
        containers: number;
        shipments: number;
        events: number;
    };
}

export default function ImportDetailsPage({ params }: { params: Promise<{ fileName: string }> }) {
    const router = useRouter();
    const [details, setDetails] = useState<ImportDetails | null>(null);
    const [containers, setContainers] = useState<any[]>([]);
    const [containersTotalCount, setContainersTotalCount] = useState(0);
    const [containersPage, setContainersPage] = useState(1);
    const [containersItemsPerPage, setContainersItemsPerPage] = useState(25);
    const [containersLoading, setContainersLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Unwrap the async params
    const resolvedParams = React.use(params);
    const fileName = decodeURIComponent(resolvedParams.fileName);

    useEffect(() => {
        fetchImportDetails();
        fetchContainers();
    }, [fileName]);

    useEffect(() => {
        fetchContainers();
    }, [containersPage, containersItemsPerPage]);

    const fetchImportDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/import-history/${encodeURIComponent(fileName)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch import details');
            }
            const data = await response.json();
            setDetails(data);
        } catch (err) {
            console.error('Error fetching import details:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const fetchContainers = async () => {
        setContainersLoading(true);
        try {
            const response = await fetch(`/api/import-history/${encodeURIComponent(fileName)}/containers?page=${containersPage}&limit=${containersItemsPerPage}`);
            if (!response.ok) {
                throw new Error('Failed to fetch containers');
            }
            const data = await response.json();
            setContainers(data.containers);
            setContainersTotalCount(data.totalCount);
        } catch (err) {
            console.error('Error fetching containers:', err);
        } finally {
            setContainersLoading(false);
        }
    };

    const handleDownload = async (action: 'download' | 'download-log') => {
        try {
            const response = await fetch(`/api/import-history/${encodeURIComponent(fileName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = action === 'download' ? fileName : `${fileName.replace(/\.[^/.]+$/, '')}_simulation.log`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download file');
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return 'N/A';
        return (bytes / 1024).toFixed(2) + ' KB';
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return 'N/A';
        const seconds = ms / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Loading import details...</p>
                </div>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Import</h2>
                        <p className="text-slate-600 mb-4">{error || 'Import not found'}</p>
                        <Button onClick={() => router.push('/import-history')}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to History
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const dataCompleteness = details.overallConfidence ? (details.overallConfidence * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <header className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => router.push('/import-history')}
                            className="gap-2 text-slate-600 hover:text-slate-900"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Import History
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                        >
                            Re-import
                        </Button>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Data Ingestion Engine</h1>
                        <p className="text-slate-500 font-medium">Autonomous import pipeline with AI-powered validation</p>
                    </div>
                </header>

                {/* Import Metadata Card */}
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
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-sm text-slate-900 truncate" title={details.fileName}>
                                            {details.fileName}
                                        </div>
                                        {details.fileStoragePath && (
                                            <button
                                                onClick={() => handleDownload('download')}
                                                className="shrink-0 w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                                                title="Download file"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        )}
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
                                        {new Date(details.importedOn).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(details.importedOn).toLocaleTimeString('en-US', {
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
                                        {details.forwarder || <span className="text-slate-400 italic">Not specified</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Import Statistics Row */}
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Rows Processed</div>
                                    <div className="text-2xl font-black text-slate-900">{details.rowsProcessed || 0}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-bold text-green-600 uppercase mb-1">Created</div>
                                    <div className="text-2xl font-black text-green-600">{details.containersCreated || 0}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-bold text-blue-600 uppercase mb-1">Updated</div>
                                    <div className="text-2xl font-black text-blue-600">{details.containersUpdated || 0}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-bold text-indigo-600 uppercase mb-1">Total Items</div>
                                    <div className="text-2xl font-black text-indigo-600">
                                        {(details.containersCreated || 0) + (details.containersUpdated || 0)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Imported Containers */}
                {!containersLoading && containers.length > 0 && (
                    <div className="space-y-4">
                        <ContainerInventory
                            containers={containers}
                            totalItems={containersTotalCount}
                            currentPage={containersPage}
                            itemsPerPage={containersItemsPerPage}
                            onPageChange={setContainersPage}
                            onItemsPerPageChange={(newValue) => {
                                setContainersItemsPerPage(newValue);
                                setContainersPage(1); // Reset to first page
                            }}
                            title="Import Manifest Details"
                            showImportButton={false}
                        />
                    </div>
                )}

                {/* Progress Timeline */}
                <div className="space-y-4">
                    {/* Agent 1 - Archivist */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">Agent 1: Archivist</h3>
                                        <p className="text-sm text-slate-600">Data ingestion and header detection</p>
                                        <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">{details.rowsProcessed}</div>
                                            <div className="text-xs text-slate-500 font-medium">Rows Ingested</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">
                                                {(details.aiAnalysis as any)?.detectedHeaders?.length || 0}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Headers Detected</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">{details.importSource}</div>
                                            <div className="text-xs text-slate-500 font-medium">Source</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-600 space-y-1">
                                        <div><span className="font-medium">File:</span> {details.fileName}</div>
                                        {details.forwarder && <div><span className="font-medium">Forwarder:</span> {details.forwarder}</div>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent 2 - Translator */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">Agent 2: Translator</h3>
                                        <p className="text-sm text-slate-600">Schema mapping and field translation</p>
                                        <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">
                                                {((details.aiAnalysis as any)?.detectedHeaders?.length || 0) - details.unmappedFieldsCount}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Mapped Fields</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">
                                                {dataCompleteness.toFixed(0)}%
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Confidence</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className={cn(
                                                "text-2xl font-bold",
                                                details.unmappedFieldsCount > 0 ? "text-amber-600" : "text-slate-900"
                                            )}>
                                                {details.unmappedFieldsCount}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Unmapped</div>
                                        </div>
                                    </div>
                                    {details.unmappedFieldsCount > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-sm text-amber-800">
                                                ⚠️ {details.unmappedFieldsCount} field{details.unmappedFieldsCount > 1 ? 's' : ''} could not be automatically mapped
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent 3 - Auditor */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">Agent 3: Auditor</h3>
                                        <p className="text-sm text-slate-600">Data quality validation and verification</p>
                                        <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-green-600">
                                                {details.rowsSucceeded - details.discrepanciesFound}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Exact Matches</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className={cn(
                                                "text-2xl font-bold",
                                                details.discrepanciesFound > 0 ? "text-amber-600" : "text-slate-900"
                                            )}>
                                                {details.discrepanciesFound}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Discrepancies</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {dataCompleteness.toFixed(0)}%
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Overall Score</div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "rounded-lg p-3 border",
                                        details.discrepanciesFound === 0
                                            ? "bg-green-50 border-green-200"
                                            : "bg-amber-50 border-amber-200"
                                    )}>
                                        <p className={cn(
                                            "text-sm font-medium",
                                            details.discrepanciesFound === 0 ? "text-green-800" : "text-amber-800"
                                        )}>
                                            {details.discrepanciesFound === 0
                                                ? "✓ All data verified successfully"
                                                : `${details.discrepanciesPatched} discrepancies auto-patched, ${details.discrepanciesFound - details.discrepanciesPatched} require attention`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent 4 - Importer */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">Agent 4: Importer</h3>
                                        <p className="text-sm text-slate-600">Database persistence and enrichment</p>
                                        <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-blue-600">{details.containersCreated}</div>
                                            <div className="text-xs text-slate-500 font-medium">Created</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-purple-600">{details.containersUpdated}</div>
                                            <div className="text-xs text-slate-500 font-medium">Updated</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-green-600">{details.containersEnriched}</div>
                                            <div className="text-xs text-slate-500 font-medium">Enriched</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent 5 - Improvement */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">Agent 5: Improvement</h3>
                                        <p className="text-sm text-slate-600">Dictionary learning and optimization</p>
                                        <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <div className="text-2xl font-bold text-slate-900">0</div>
                                            <div className="text-xs text-slate-500 font-medium">Synonyms Learned</div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-sm text-blue-800">
                                            ℹ️ Learning engine analyzed patterns for future imports
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Completion Summary */}
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="p-8 space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete</h2>
                            <p className="text-slate-600">All agents executed successfully</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{formatDuration(details.processingDurationMs)}</div>
                                <div className="text-xs text-slate-500 font-medium">Duration</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Database className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{details.counts.containers}</div>
                                <div className="text-xs text-slate-500 font-medium">Containers Imported</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{dataCompleteness.toFixed(0)}%</div>
                                <div className="text-xs text-slate-500 font-medium">Data Completeness</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">0</div>
                                <div className="text-xs text-slate-500 font-medium">Synonyms Learned</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium text-slate-700">
                                <span>Overall Progress</span>
                                <span>100%</span>
                            </div>
                            <Progress value={100} className="h-3 bg-green-100" />
                        </div>

                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 gap-2"
                                onClick={() => router.push('/dashboard')}
                            >
                                Go to Operational Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Simulation Logs */}
                {details.simulationLog && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Simulation Logs</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('download-log')}
                                    className="gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Log
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                    {details.simulationLog}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
