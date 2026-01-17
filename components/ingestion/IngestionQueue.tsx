"use client";

import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Loader2, Play, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { ImportCard } from '@/components/imports/ImportCard';
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
                    <ImportCard
                        key={log.fileName}
                        log={log}
                        onProcess={onProcess}
                        onDelete={onDelete}
                        onViewAnalysis={onViewAnalysis}
                    />
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
