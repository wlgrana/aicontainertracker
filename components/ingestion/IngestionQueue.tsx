"use client";

import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Loader2, Play, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

interface IngestionQueueProps {
    logs: ImportLog[];
    onProcess: (fileId: string) => void;
    onDelete: (fileId: string) => void;
    onViewAnalysis?: (log: ImportLog) => void;
}

export default function IngestionQueue({ logs, onProcess, onDelete, onViewAnalysis }: IngestionQueueProps) {
    return (
        <div className="w-full space-y-6">
            <div className="space-y-4">
                {logs.map((log) => (
                    <div
                        key={log.fileName}
                        className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-between group hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                    >
                        <div className="flex items-center space-x-6">
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

                        <div className="flex items-center space-x-3">
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
                ))}

                {logs.length === 0 && (
                    <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[2.5rem]">
                        <div className="p-6 bg-slate-50 rounded-full inline-block mb-4">
                            <Clock className="h-10 w-10 text-slate-300" />
                        </div>
                        <h4 className="text-xl font-black text-slate-300 uppercase tracking-tighter">Void Queue</h4>
                        <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2">No transmission data found in the current environment.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
