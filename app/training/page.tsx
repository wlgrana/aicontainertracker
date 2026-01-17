
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// Types aligning with API response
interface IterationScores {
    scores: {
        coverage: number;
        required_field_fill: number;
        overall_score: number;
        avg_confidence: number;
        optional_field_fill: number;
    };
    metrics: {
        total_rows: number;
        valid_records: number;
        unmapped_headers: number;
        rows_with_errors: number;
    };
    stopped: boolean;
    stop_reason?: string;
    improvements?: {
        synonyms_added: number;
        pending_fields: number;
    };
}

interface ImprovementSuggestion {
    unmappedHeader: string;
    canonicalField: string;
    confidence: number;
    reasoning: string;
    action: string;
}

interface IterationData {
    id: string;
    scores: IterationScores | null;
    improvements: ImprovementSuggestion[];
}

interface TrainingRun {
    id: string;
    startedAt: string;
    lastUpdated: string;
    config: any;
    iterations: IterationData[];
}

export default function TrainingDashboard() {
    const [runs, setRuns] = useState<TrainingRun[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRuns = async () => {
        try {
            const res = await fetch('/api/training/runs');
            const data = await res.json();
            if (data.runs) {
                setRuns(data.runs);
                if (data.runs.length > 0 && !selectedRunId) {
                    setSelectedRunId(data.runs[0].id);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
        const interval = setInterval(fetchRuns, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, []);

    const selectedRun = runs.find(r => r.id === selectedRunId);

    if (loading && runs.length === 0) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
                <div className="text-xl text-blue-400 animate-pulse">Loading Training Data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
                            Engine Trainer
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            LIVE MONITORING
                        </span>
                        <Link href="/simulation" className="text-sm text-slate-400 hover:text-white transition-colors">
                            View Simulation
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6">

                {/* Sidebar: Run History */}
                <div className="col-span-12 lg:col-span-3 space-y-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Training Sessions</h2>
                    <div className="space-y-2">
                        {runs.map(run => (
                            <button
                                key={run.id}
                                onClick={() => setSelectedRunId(run.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${selectedRunId === run.id
                                    ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                                    : 'bg-slate-900 border-white/5 hover:border-white/10 hover:bg-slate-800'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${selectedRunId === run.id
                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                        {new Date(run.startedAt).toLocaleTimeString()}
                                    </span>
                                    {run.iterations.length > 0 && (
                                        <span className="text-xs text-slate-500">
                                            {run.iterations.length} Iterations
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm font-medium text-slate-200 truncate mb-1">
                                    {(run.config.benchmarkFiles && run.config.benchmarkFiles.length > 1)
                                        ? `Multi-File Batch (${run.config.benchmarkFiles.length} files)`
                                        : (run.config.benchmarkFiles?.[0]?.split(/[/\\]/).pop() || 'Unknown File')
                                    }
                                </div>
                                <div className="text-xs text-slate-500">
                                    Final Score: <span className="text-emerald-400 font-mono">
                                        {(Number(run.iterations[run.iterations.length - 1]?.scores?.scores?.overall_score || 0) * 100).toFixed(1)}%
                                    </span>
                                </div>

                                {selectedRunId === run.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Selected Run Details */}
                {selectedRun ? (
                    <div className="col-span-12 lg:col-span-9 space-y-6">

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MetricCard
                                label="Current Coverage"
                                value={`${(Number(selectedRun.iterations[selectedRun.iterations.length - 1]?.scores?.scores?.coverage || 0) * 100).toFixed(1)}%`}
                                trend={selectedRun.iterations.length > 1 ? "increasing" : "neutral"}
                            />
                            <MetricCard
                                label="Overall Score"
                                value={`${(Number(selectedRun.iterations[selectedRun.iterations.length - 1]?.scores?.scores?.overall_score || 0) * 100).toFixed(1)}%`}
                                subValue="Target: 90.0%"
                                highlight
                            />
                            <MetricCard
                                label="Total Synonyms Learned"
                                value={String(selectedRun.iterations.reduce((acc, it) => acc + (it.scores?.improvements?.synonyms_added || (it.improvements ? it.improvements.length : 0)), 0))}
                                trend="positive"
                            />
                        </div>

                        {/* Iteration Timeline */}
                        <div className="space-y-6">
                            {selectedRun.iterations.map((iteration, idx) => (
                                <IterationBlock
                                    key={iteration.id}
                                    iteration={iteration}
                                    index={idx + 1}
                                    isLast={idx === selectedRun.iterations.length - 1}
                                />
                            ))}
                        </div>

                    </div>
                ) : (
                    <div className="col-span-9 flex items-center justify-center text-slate-500">
                        Select a run to view details
                    </div>
                )}
            </main>
        </div>
    );
}

// Components

function MetricCard({ label, value, subValue, highlight, trend }: any) {
    return (
        <div className={`p-5 rounded-xl border ${highlight ? 'bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border-indigo-500/30' : 'bg-slate-900 border-white/5'} backdrop-blur-sm`}>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
            <div className={`text-3xl font-bold font-mono ${highlight ? 'text-indigo-400' : 'text-white'}`}>
                {value}
            </div>
            {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
        </div>
    );
}

function IterationBlock({ iteration, index, isLast }: { iteration: IterationData, index: number, isLast: boolean }) {
    const scores = iteration.scores?.scores;
    const metrics = iteration.scores?.metrics;

    return (
        <div className="relative pl-8 pb-8 last:pb-0">
            {/* Timeline Line */}
            {!isLast && <div className="absolute left-3 top-8 bottom-0 w-px bg-slate-800"></div>}

            {/* Timeline Node */}
            <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 ${isLast ? 'border-emerald-500 bg-emerald-950 animate-pulse' : 'border-slate-700 bg-slate-900'
                } flex items-center justify-center z-10 box-content shadow-lg shadow-black/50`}>
                {isLast && <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>}
            </div>

            <div className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-200">
                        Iteration {index}
                    </h3>
                    <div className="flex gap-4 text-sm font-mono">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            <span className="text-slate-400">Score:</span>
                            <span className="text-blue-400">{(Number(scores?.overall_score || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            <span className="text-slate-400">Coverage:</span>
                            <span className="text-purple-400">{(Number(scores?.coverage || 0) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Metrics Column */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Performance Metrics</h4>
                        <div className="space-y-3">
                            <ProgressBar label="Overall Coverage" value={scores?.coverage || 0} color="bg-purple-500" />
                            <ProgressBar label="Required Fields Filled" value={scores?.required_field_fill || 0} color="bg-blue-500" />
                            <ProgressBar label="Optional Fields Filled" value={scores?.optional_field_fill || 0} color="bg-cyan-500" />
                            <ProgressBar label="AI Confidence (Avg)" value={scores?.avg_confidence || 0} color="bg-emerald-500" />
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <StatBox label="Unmapped Headers" value={metrics?.unmapped_headers || 0} bad={(metrics?.unmapped_headers || 0) > 0} />
                            <StatBox label="Rows with Errors" value={metrics?.rows_with_errors || 0} bad={(metrics?.rows_with_errors || 0) > 0} />
                        </div>
                    </div>

                    {/* Learnings Column */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            New Learnings
                            <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full text-[10px] border border-indigo-500/30">
                                {iteration.improvements.length}
                            </span>
                        </h4>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {iteration.improvements.length > 0 ? (
                                iteration.improvements.map((imp, i) => (
                                    <div key={i} className="bg-slate-950/50 border border-white/5 p-3 rounded-lg text-sm group hover:border-indigo-500/30 transition-colors">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">
                                                {imp.unmappedHeader}
                                            </span>
                                            <span className="text-slate-600 px-1">→</span>
                                            <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">
                                                {imp.canonicalField}
                                            </span>
                                        </div>
                                        {/* <div className="text-xs text-slate-500 opacity-60 line-clamp-1 group-hover:opacity-100 transition-opacity">
                                            {imp.reasoning}
                                        </div> */}
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-slate-600 italic py-4 text-center border border-dashed border-slate-800 rounded-lg">
                                    No new synonyms learned in this step.
                                </div>
                            )}
                        </div>

                        {iteration.scores?.stopped && (
                            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-start gap-2">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <span className="font-bold block mb-0.5">Optimization Complete</span>
                                    {iteration.scores.stop_reason}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

function ProgressBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-300 font-mono">{(value * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${color}`}
                    style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
                ></div>
            </div>
        </div>
    );
}

function StatBox({ label, value, bad }: { label: string, value: number, bad: boolean }) {
    return (
        <div className={`p-3 rounded-lg border ${bad ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950 border-white/5'}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-tight mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${bad ? 'text-red-400' : 'text-slate-300'}`}>
                {value}
            </div>
        </div>
    );
}
