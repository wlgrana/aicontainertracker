"use client";

import React, { useEffect, useState } from 'react';
import {
    FileText,
    Brain,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export type StepStatus = 'waiting' | 'running' | 'complete' | 'error';

interface ProcessingStatusProps {
    fileName: string;
    fileSize?: string;
    currentStep: number;
    steps: {
        label: string;
        icon: any;
        details?: string[];
        status: StepStatus;
    }[];
    onComplete?: () => void;
    onCancel?: () => void;
}

export default function ProcessingStatus({
    fileName,
    fileSize,
    currentStep,
    steps,
    onComplete,
    onCancel
}: ProcessingStatusProps) {
    const isFinished = steps.every(s => s.status === 'complete');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="p-3 bg-primary rounded-2xl glow-blue">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight truncate max-w-[300px]">{fileName}</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {fileSize || "Calculating Payload"} • Mission In-Progress
                            </p>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/20 blur-[60px] rounded-full" />
                </div>

                {/* Progress Content */}
                <div className="p-10 space-y-8">
                    <div className="space-y-6">
                        {steps.map((step, idx) => (
                            <div key={idx} className={cn(
                                "flex items-start gap-5 transition-all duration-500",
                                step.status === 'waiting' ? "opacity-30 grayscale" : "opacity-100"
                            )}>
                                <div className={cn(
                                    "mt-1 p-2 rounded-xl transition-colors duration-500",
                                    step.status === 'complete' ? "bg-green-100 text-green-600" :
                                        step.status === 'running' ? "bg-primary/20 text-primary animate-pulse" :
                                            "bg-slate-100 text-slate-400"
                                )}>
                                    {step.status === 'complete' ? <CheckCircle2 className="h-5 w-5" /> :
                                        step.status === 'running' ? <Loader2 className="h-5 w-5 animate-spin" /> :
                                            <step.icon className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className={cn(
                                            "font-black tracking-tight",
                                            step.status === 'running' ? "text-primary text-lg" : "text-slate-900"
                                        )}>
                                            {step.label}
                                        </h4>
                                        {step.status === 'running' && (
                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Active</span>
                                        )}
                                    </div>

                                    {step.details && step.status !== 'waiting' && (
                                        <div className="space-y-1 animate-in fade-in slide-in-from-left-2 transition-all">
                                            {step.details.map((detail, dIdx) => (
                                                <div key={dIdx} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                    <ChevronRight className="h-3 w-3 text-slate-300" />
                                                    {detail}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {isFinished ? (
                        <div className="pt-6 animate-in zoom-in-95 duration-500">
                            <Link
                                href="/dashboard"
                                className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-primary/20 glow-blue transition-all active:scale-95"
                            >
                                View in Work Queue <ArrowRight className="h-5 w-5" />
                            </Link>
                            <button
                                onClick={onComplete}
                                className="w-full mt-3 py-2 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors"
                            >
                                Return to Ingestion Page
                            </button>
                        </div>
                    ) : (
                        <div className="pt-6 space-y-3">
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary glow-blue transition-all duration-1000"
                                    style={{ width: `${(currentStep / steps.length) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Processing Batch {currentStep} of {steps.length}
                                </p>
                                {onCancel && (
                                    <button
                                        onClick={onCancel}
                                        className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                    >
                                        <AlertTriangle className="w-3 h-3" />
                                        Cancel & Cleanup
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
