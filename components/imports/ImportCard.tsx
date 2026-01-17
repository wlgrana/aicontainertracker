"use client";

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, Loader2, Play, Trash2, Eye, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QualityBadge } from './QualityBadge';
import { QualityReportModal, type ImportQualityMetrics } from './QualityReportModal';
import { Button } from '@/components/ui/button'; // Assuming ui components exist, based on modal code
// If Button doesn't exist, I'll fallback to raw HTML button styles used in IngestionQueue

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ImportLog {
    fileName: string;
    status: string;
    rowsProcessed: number;
    rowsSucceeded: number;
    rowsFailed: number;
    importedOn: Date;
    errorLog?: string | null;
    aiAnalysis?: any;
}

interface ImportCardProps {
    log: ImportLog;
    onProcess: (fileId: string) => void;
    onDelete: (fileId: string) => void;
    onViewAnalysis?: (log: ImportLog) => void;
}

export function ImportCard({ log, onProcess, onDelete, onViewAnalysis }: ImportCardProps) {
    const [qualityMetrics, setQualityMetrics] = useState<ImportQualityMetrics | null>(null);
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [showQualityModal, setShowQualityModal] = useState(false);
    const [isImproving, setIsImproving] = useState(false);

    interface EnrichedImportLog extends ImportLog {
        qualityMetrics?: ImportQualityMetrics;
    }

    useEffect(() => {
        // Use pre-loaded metrics if available (from getHistoryLogs)
        if ((log as EnrichedImportLog).qualityMetrics) {
            setQualityMetrics((log as EnrichedImportLog).qualityMetrics!);
            return;
        }

        // Otherwise load metrics if the import is completed
        if (log.status === 'COMPLETED') {
            loadQualityMetrics();
        }
    }, [log.status, log.fileName, (log as any).qualityMetrics]);

    const [jobStatus, setJobStatus] = useState<{ status: string; progress: number; message?: string } | undefined>(undefined);

    async function loadQualityMetrics() {
        try {
            setLoadingMetrics(true);
            const response = await fetch(`/api/imports/${encodeURIComponent(log.fileName)}/quality`);
            if (response.ok) {
                const data = await response.json();
                setQualityMetrics(data);
            }
        } catch (error) {
            console.error('Failed to load quality metrics:', error);
        } finally {
            setLoadingMetrics(false);
        }
    }

    const handleImproveBatch = async () => {
        setIsImproving(true);
        try {
            const res = await fetch(`/api/imports/${encodeURIComponent(log.fileName)}/improve`, { method: 'POST' });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Failed to start job');
            }

            const { jobId } = await res.json();

            // Start polling
            const poll = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/improvement-jobs/${jobId}`);
                    if (statusRes.ok) {
                        const status = await statusRes.json();
                        setJobStatus({
                            status: status.status,
                            progress: status.progress,
                            message: status.status === 'RUNNING' ? `Progress: ${status.progress}%` : status.status
                        });

                        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                            clearInterval(poll);
                            setIsImproving(false);
                            if (status.status === 'COMPLETED') {
                                loadQualityMetrics(); // Refresh metrics
                            }
                        }
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 2000);

        } catch (error) {
            console.error("Error starting improvement:", error);
            setIsImproving(false);
            alert("Failed to start improvement job");
        }
    };

    return (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl group hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-6">
                    {/* Status Icon */}
                    <div className={cn(
                        "p-3 rounded-2xl glow-blue",
                        log.status === 'COMPLETED' ? "bg-green-100 text-green-700" :
                            log.status === 'FAILED' ? "bg-red-100 text-red-700" :
                                log.status === 'PROCESSING' || log.status === 'MAPPING_DETECTED' ? "bg-primary/20 text-primary" :
                                    "bg-slate-200 text-slate-500"
                    )}>
                        {log.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> :
                            log.status === 'FAILED' ? <AlertCircle className="w-6 h-6" /> :
                                log.status === 'PROCESSING' ? <Loader2 className="w-6 h-6 animate-spin" /> :
                                    <Clock className="w-6 h-6" />}
                    </div>

                    {/* File Info */}
                    <div>
                        <p className="text-lg font-black text-slate-900 max-w-md truncate tracking-tight">{log.fileName}</p>
                        <div className="flex items-center space-x-4 text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            <span suppressHydrationWarning>{new Date(log.importedOn).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{log.rowsProcessed} Records</span>
                            {log.status === 'COMPLETED' && (
                                <>
                                    <span>•</span>
                                    <span className="text-green-600">{log.rowsSucceeded} Success</span>
                                    {log.rowsFailed > 0 && <span className="text-red-500">{log.rowsFailed} Failed</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center space-x-3">
                    {/* Quality Badge - Only show if completed */}
                    {log.status === 'COMPLETED' && qualityMetrics && (
                        <div
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setShowQualityModal(true)}
                        >
                            <QualityBadge
                                grade={qualityMetrics.qualityGrade}
                                captureRate={qualityMetrics.avgCaptureRate}
                            />
                        </div>
                    )}

                    {log.aiAnalysis && onViewAnalysis && (
                        <button
                            onClick={() => onViewAnalysis(log)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold transition-all flex items-center space-x-2 text-xs border border-indigo-100 hover:bg-indigo-100 hover:scale-105 active:scale-95"
                        >
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span>Mission Oracle</span>
                        </button>
                    )}
                    {log.status === 'PENDING' && (
                        <button
                            onClick={() => onProcess(log.fileName)}
                            className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold transition-all flex items-center space-x-2 text-sm glow-blue hover:scale-105 active:scale-95"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Execute</span>
                        </button>
                    )}
                    {log.status === 'AWAITING_CONFIRMATION' && (
                        <button
                            onClick={() => onProcess(log.fileName)}
                            className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95"
                        >
                            Verify Map
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(log.fileName)}
                        className="p-2.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 rounded-xl transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <Link href={`/ingestion/${log.fileName}`}>
                        <button className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary rounded-xl transition-all">
                            <Eye className="w-5 h-5" />
                        </button>
                    </Link>
                </div>
            </div>

            {/* Quality Extended Info (if metrics loaded) */}
            {log.status === 'COMPLETED' && qualityMetrics && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-3 text-slate-500 text-xs">
                        <span className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Capture: <strong>{(qualityMetrics.avgCaptureRate * 100).toFixed(0)}%</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span title="Average fields per record">
                            <strong>{qualityMetrics.totalRawFields || '--'}</strong> Data Points
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-600">
                            <strong>{qualityMetrics.totalFieldsMapped || '--'}</strong> Mapped
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-amber-600">
                            <strong>{(qualityMetrics.uniqueUnmappedFields?.length || qualityMetrics.totalFieldsUnmapped || 0)}</strong> Orphaned
                        </span>
                        {qualityMetrics.recommendImprovement && (
                            <span className="text-amber-600 font-medium text-[10px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 ml-2">
                                Improvement Recommended
                            </span>
                        )}
                    </div>

                    <button
                        onClick={() => setShowQualityModal(true)}
                        className="text-primary hover:text-primary/80 font-bold text-xs"
                    >
                        View Quality Report
                    </button>
                </div>
            )}

            <QualityReportModal
                isOpen={showQualityModal}
                onClose={() => setShowQualityModal(false)}
                fileName={log.fileName}
                metrics={qualityMetrics}
                onImprove={handleImproveBatch}
                isImproving={isImproving}
                jobStatus={jobStatus}
            />
        </div>
    );
}
