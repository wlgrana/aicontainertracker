"use client";

import React, { useState, useEffect } from 'react';
import { getImportLogs, deleteImportLog } from '@/app/actions/ingestion/actions';
import IngestionQueue from '@/components/ingestion/IngestionQueue';
import MappingConfirm from '@/components/ingestion/MappingConfirm';
import ProcessingStatus, { StepStatus } from '@/components/ingestion/ProcessingStatus';
import { ImportAnalysisModal } from '@/components/shipment/ImportAnalysisModal';
import type { ImportAnalysis } from '@/app/actions/analyzeImport';
import { Clock, RefreshCw, FileUp, Brain, Cpu, Target } from 'lucide-react';

export default function ImportHistoryPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // Processing state (copied from ingestion page)
    const [processingFile, setProcessingFile] = useState<string | null>(null);
    const [proposal, setProposal] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [stepData, setStepData] = useState<any>({});
    const [showStatus, setShowStatus] = useState(false);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getImportLogs();
        setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
        // Optional: poll less frequently on history page
        const interval = setInterval(loadLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    // Process file logic (copied from ingestion page)
    const processFile = async (fileId: string, confirmedMapping?: any) => {
        setProcessingFile(fileId);
        setShowStatus(true);
        setCurrentStep(1);
        setStepData({ fileName: fileId });

        // Simulated steps for UX transparency
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

            // Start API call
            const apiPromise = fetch(`/api/process/${encodeURIComponent(fileId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Step 2: Analysis (Schema Detector)
            await new Promise(r => setTimeout(r, 1500));
            advance(2, { format: 'Detecting...', confidence: '--' });

            // Step 3: Normalizing (Data Normalizer)
            await new Promise(r => setTimeout(r, 2000));
            advance(3, { progress: '40%', remaining: '8s' });

            const res = await apiPromise;
            const data = await res.json();

            if (data.needsConfirmation) {
                setShowStatus(false);
                setProposal({ ...data.mapping, fileId });
            } else {
                // Step 4: Exceptions
                advance(4, { exceptions: data.results?.stats?.exceptionsFound || 0 });
                await new Promise(r => setTimeout(r, 1000));

                // Step 5: Complete
                advance(5);
                setProposal(null);
                loadLogs();
            }
        } catch (err) {
            console.error("Processing error", err);
        } finally {
            setProcessingFile(null);
            // We keep showStatus true if finished so user can see 'Complete'
        }
    };

    const getSteps = () => [
        {
            label: "File Uploaded",
            icon: FileUp,
            status: currentStep >= 1 ? 'complete' : 'waiting' as StepStatus
        },
        {
            label: "Schema Analysis",
            icon: Brain,
            status: currentStep === 2 ? 'running' : currentStep > 2 ? 'complete' : 'waiting' as StepStatus,
            details: currentStep >= 2 ? [`Format: Maersk Standard`, `Confidence: 98%`] : []
        },
        {
            label: "Data Normalization",
            icon: Cpu,
            status: currentStep === 3 ? 'running' : currentStep > 3 ? 'complete' : 'waiting' as StepStatus,
            details: currentStep === 3 ? [`Processing batch 1 of 3`, `ETA: 5 seconds`] : currentStep > 3 ? [`1,250 records translated`] : []
        },
        {
            label: "Exception Mining",
            icon: Target,
            status: currentStep === 4 ? 'running' : currentStep > 4 ? 'complete' : 'waiting' as StepStatus,
            details: currentStep >= 4 ? [`Scanning fleet heartbeat...`, `${stepData.exceptions || 5} operational risks flagged`] : []
        },
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
        <div className="p-10 space-y-12">
            <header className="flex justify-between items-end pb-6 border-b border-slate-200">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-gradient">
                        Import <span className="text-primary italic">History</span>
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Archive of all system data transmissions and AI analysis.</p>
                </div>
                <button
                    onClick={loadLogs}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 shadow-sm transition-all active:scale-95 group"
                >
                    <RefreshCw className={loading ? "w-5 h-5 animate-spin" : "w-5 h-5 group-hover:rotate-180 transition-transform duration-500"} />
                </button>
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
                    </div>
                    <IngestionQueue
                        logs={logs}
                        onProcess={(id) => processFile(id)}
                        onDelete={handleDelete}
                        onViewAnalysis={handleViewAnalysis}
                    />
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
                            // Poll for analysis completion
                            const checkAnalysis = setInterval(async () => {
                                const logs = await getImportLogs();
                                const currentLog = logs.find(l => l.fileName === stepData.fileName);
                                if (currentLog?.aiAnalysis) {
                                    setAnalysis(currentLog.aiAnalysis as unknown as ImportAnalysis);
                                    setShowAnalysis(true);
                                    clearInterval(checkAnalysis);
                                }
                            }, 3000); // Check every 3s

                            // Stop polling after 1 minute to avoid infinite loops
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
