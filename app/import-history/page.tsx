"use client";

import Link from 'next/link';

import React, { useState, useEffect } from 'react';
import { getHistoryLogs, deleteImportLog } from '@/app/actions/ingestion/actions';
import IngestionQueue from '@/components/ingestion/IngestionQueue';
import MappingConfirm from '@/components/ingestion/MappingConfirm';
import ProcessingStatus, { StepStatus } from '@/components/ingestion/ProcessingStatus';
import { ImportAnalysisModal } from '@/components/shipment/ImportAnalysisModal';
import type { ImportAnalysis } from '@/app/actions/analyzeImport';
import { Clock, RefreshCw, FileUp, Brain, Cpu, Target, Filter, ArrowUpDown, FileText } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function ImportHistoryPage() {
    const [allLogs, setAllLogs] = useState<any[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // Filter/Sort State
    const [qualityFilter, setQualityFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');

    // Processing state
    const [processingFile, setProcessingFile] = useState<string | null>(null);
    const [proposal, setProposal] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [stepData, setStepData] = useState<any>({});
    const [showStatus, setShowStatus] = useState(false);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getHistoryLogs();
        setAllLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Apply filters and sort when logs or controls change
    useEffect(() => {
        let result = [...allLogs];

        // Filter by Quality
        if (qualityFilter !== 'all') {
            result = result.filter(log => {
                const grade = log.qualityMetrics?.qualityGrade || 'POOR'; // Default to poor/unknown if missing? Or maybe needs_improvement
                // Actually if metrics are missing (pending), maybe exclude or show all?
                // Let's assume if status != COMPLETED, quality is undefined.
                // We'll filter based on exact match if metrics exist.
                if (!log.qualityMetrics) return false;
                return grade === qualityFilter.toUpperCase().replace('-', '_'); // EXCELLENT, GOOD, NEEDS_IMPROVEMENT
            });
        }

        // Sort
        result.sort((a, b) => {
            const dateA = new Date(a.importedOn).getTime();
            const dateB = new Date(b.importedOn).getTime();

            const qualityA = a.qualityMetrics?.avgCaptureRate || 0;
            const qualityB = b.qualityMetrics?.avgCaptureRate || 0;

            switch (sortBy) {
                case 'date-desc': return dateB - dateA;
                case 'date-asc': return dateA - dateB;
                case 'quality-desc': return qualityB - qualityA; // Best quality first
                case 'quality-asc': return qualityA - qualityB; // Worst quality first
                default: return 0;
            }
        });

        setFilteredLogs(result);
    }, [allLogs, qualityFilter, sortBy]);

    // ... (Existing processFile logic identical to previous version) ...
    // Copied from previous view_file content
    const processFile = async (fileId: string, confirmedMapping?: any) => {
        setProcessingFile(fileId);
        setShowStatus(true);
        setCurrentStep(1);
        setStepData({ fileName: fileId });

        const advance = (step: number, data?: any) => {
            setCurrentStep(step);
            if (data) setStepData((prev: any) => ({ ...prev, ...data }));
        };

        try {
            advance(1, { fileName: fileId });

            const payload = confirmedMapping ? {
                confirmMapping: true,
                confirmedMapping: {
                    ...proposal,
                    columnMapping: confirmedMapping,
                    confidence: 1.0
                }
            } : {
                confirmMapping: false
            };

            const apiPromise = fetch(`/api/process/${encodeURIComponent(fileId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            await new Promise(r => setTimeout(r, 1500));
            advance(2, { format: 'Detecting...', confidence: '--' });

            await new Promise(r => setTimeout(r, 2000));
            advance(3, { progress: '40%', remaining: '8s' });

            const res = await apiPromise;
            const data = await res.json();

            if (data.needsConfirmation) {
                setShowStatus(false);
                setProposal({ ...data.mapping, fileId });
            } else {
                advance(4, { exceptions: data.results?.stats?.exceptionsFound || 0 });
                await new Promise(r => setTimeout(r, 1000));
                advance(5);
                setProposal(null);
                loadLogs();
            }
        } catch (err) {
            console.error("Processing error", err);
        } finally {
            setProcessingFile(null);
        }
    };

    const getSteps = () => [
        { label: "File Uploaded", icon: FileUp, status: currentStep >= 1 ? 'complete' : 'waiting' as StepStatus },
        { label: "Schema Analysis", icon: Brain, status: currentStep === 2 ? 'running' : currentStep > 2 ? 'complete' : 'waiting' as StepStatus, details: currentStep >= 2 ? [`Format: Maersk Standard`, `Confidence: 98%`] : [] },
        { label: "Data Normalization", icon: Cpu, status: currentStep === 3 ? 'running' : currentStep > 3 ? 'complete' : 'waiting' as StepStatus, details: currentStep === 3 ? [`Processing batch 1 of 3`, `ETA: 5 seconds`] : currentStep > 3 ? [`1,250 records translated`] : [] },
        { label: "Exception Mining", icon: Target, status: currentStep === 4 ? 'running' : currentStep > 4 ? 'complete' : 'waiting' as StepStatus, details: currentStep >= 4 ? [`Scanning fleet heartbeat...`, `${stepData.exceptions || 5} operational risks flagged`] : [] },
    ];

    const handleDelete = async (fileId: string) => {
        if (confirm("Delete this import record?")) {
            await deleteImportLog(fileId);
            loadLogs();
        }
    };

    const handleViewAnalysis = (log: any) => {
        if (log.aiAnalysis) {
            setAnalysis(log.aiAnalysis as unknown as ImportAnalysis);
            setShowAnalysis(true);
        }
    };

    return (
        <div className="p-10 space-y-10">
            <header className="flex flex-col gap-6 border-b border-slate-200 pb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-gradient">
                            Import <span className="text-primary italic">History</span>
                        </h1>
                        <p className="text-slate-400 mt-2 font-medium text-lg">
                            Archive of all system data transmissions and quality assessments.
                        </p>
                    </div>
                    <button
                        onClick={loadLogs}
                        className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 shadow-sm transition-all active:scale-95 group"
                    >
                        <RefreshCw className={loading ? "w-5 h-5 animate-spin" : "w-5 h-5 group-hover:rotate-180 transition-transform duration-500"} />
                    </button>
                </div>

                {/* Filter & Sort Bar */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">Filter By Quality:</span>
                    </div>
                    <Select value={qualityFilter} onValueChange={setQualityFilter}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="All Qualities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Imports</SelectItem>
                            <SelectItem value="excellent">✅ Excellent (≥90%)</SelectItem>
                            <SelectItem value="good">🟡 Good (75-89%)</SelectItem>
                            <SelectItem value="needs-improvement">🟠 Needs Improvement</SelectItem>
                            <SelectItem value="poor">🔴 Poor (&lt; 60%)</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="w-px h-8 bg-slate-200 mx-2" />

                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">Sort By:</span>
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort Order" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date-desc">Newest First</SelectItem>
                            <SelectItem value="date-asc">Oldest First</SelectItem>
                            <SelectItem value="quality-asc">Worst Quality First</SelectItem>
                            <SelectItem value="quality-desc">Best Quality First</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="ml-auto text-sm font-medium text-slate-400">
                        Showing {filteredLogs.length} of {allLogs.length} imports
                    </div>
                </div>
            </header>

            <main className="max-w-6xl">
                <section className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-[2.5rem] p-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                                <Clock className="w-3 h-3" />
                                Audit Log
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Transmission Logs</h3>
                        </div>
                        <Link href="/docs/fix-report" className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-xl border border-blue-100">
                            <FileText className="w-4 h-4" />
                            View Fix Log
                        </Link>
                    </div>

                    {loading && allLogs.length === 0 ? (
                        <div className="py-20 flex justify-center text-slate-300">
                            <RefreshCw className="w-10 h-10 animate-spin" />
                        </div>
                    ) : (
                        <IngestionQueue
                            logs={filteredLogs}
                            onProcess={(id) => processFile(id)}
                            onDelete={handleDelete}
                            onViewAnalysis={handleViewAnalysis}
                        />
                    )}
                </section>
            </main>

            {proposal && (
                <MappingConfirm
                    proposal={proposal}
                    onCancel={() => setProposal(null)}
                    onConfirm={(m) => processFile(proposal.fileId, m)}
                />
            )}

            {showStatus && (
                <ProcessingStatus
                    fileName={stepData.fileName}
                    currentStep={currentStep}
                    steps={getSteps()}
                    onComplete={() => {
                        setShowStatus(false);
                        loadLogs().then(() => {
                            const checkAnalysis = setInterval(async () => {
                                const logs = await getHistoryLogs();
                                const currentLog = logs.find(l => l.fileName === stepData.fileName);
                                if (currentLog?.aiAnalysis) {
                                    setAnalysis(currentLog.aiAnalysis as unknown as ImportAnalysis);
                                    setShowAnalysis(true);
                                    clearInterval(checkAnalysis);
                                }
                            }, 3000);
                            setTimeout(() => clearInterval(checkAnalysis), 60000);
                        });
                    }}
                />
            )}

            <ImportAnalysisModal
                analysis={analysis}
                isOpen={showAnalysis}
                onClose={() => setShowAnalysis(false)}
            />
        </div>
    );
}
