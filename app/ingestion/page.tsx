"use client";

import React, { useState, useEffect } from 'react';
import { getImportLogs, deleteImportLog } from '@/app/actions/ingestion/actions';
import FileUpload from '@/components/ingestion/FileUpload';
import IngestionQueue from '@/components/ingestion/IngestionQueue';
import MappingConfirm from '@/components/ingestion/MappingConfirm';
import Link from 'next/link';
import ProcessingStatus, { StepStatus } from '@/components/ingestion/ProcessingStatus';
import { RefreshCw, Zap, Brain, Cpu, Target, FileUp } from 'lucide-react';
import { ImportAnalysisModal } from '@/components/shipment/ImportAnalysisModal';
import type { ImportAnalysis } from '@/app/actions/analyzeImport';

export default function IngestionPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingFile, setProcessingFile] = useState<string | null>(null);
    const [proposal, setProposal] = useState<any>(null);
    const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // Real-time status state
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
        const interval = setInterval(loadLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleUploadComplete = (fileId: string) => {
        loadLogs();
        processFile(fileId);
    };

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

            // Start polling for progress
            const progressInterval = setInterval(async () => {
                try {
                    const logs = await getImportLogs();
                    const log = logs.find(l => l.fileName === fileId);
                    if (log) {
                        const totalProcessed = (log.rowsSucceeded || 0) + (log.rowsFailed || 0);
                        if (totalProcessed > 0 && currentStep <= 3) {
                            advance(3, {
                                processedCount: totalProcessed,
                                progress: 'Processing...'
                            });
                        }
                    }
                } catch (e) {
                    console.error("Progress poll failed", e);
                }
            }, 2000);

            // Step 2: Analysis (Schema Detector)
            await new Promise(r => setTimeout(r, 1500));
            advance(2, { format: 'Detecting...', confidence: '--' });

            // Step 3: Normalizing (Data Normalizer)
            // We remove the hardcoded wait here since we rely on polling/api
            advance(3, { progress: 'Starting...', remaining: '...' });

            const res = await apiPromise;
            clearInterval(progressInterval);
            const data = await res.json();

            if (data.needsConfirmation) {
                setShowStatus(false);
                setProposal({ ...data.mapping, fileId });
            } else {
                // SUCCESS: Capture stats locally
                const processedCount = data.stats?.success || 0;

                // Update Step 2 with actual detected format
                // This ensures that when the process completes, the user sees what was actually detected
                // rather than the hardcoded values.
                const detectedFormat = data.mapping?.forwarderName || "Auto-Detected";
                const detectedConfidence = data.mapping?.confidence ? Math.round(data.mapping.confidence * 100) : 0;

                // Step 3 (Retroactive update): Show actual count
                // We update step 3's display even though we are moving to step 4
                // but the 'details' logic in getSteps uses currentStep > 3 to show the final count.
                // We'll pass it in advance(4) so it's available in stepData.

                // Step 4: Exceptions
                advance(4, {
                    exceptions: data.stats?.exceptionsFound || 0,
                    processedCount: processedCount,
                    // Retroactively update step 2 data
                    format: detectedFormat,
                    confidence: `${detectedConfidence}%`
                });
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
            details: currentStep >= 2 ? [`Format: ${stepData.format || 'Detecting...'}`, `Confidence: ${stepData.confidence || '--'}`] : []
        },
        {
            label: "Data Normalization",
            icon: Cpu,
            status: currentStep === 3 ? 'running' : currentStep > 3 ? 'complete' : 'waiting' as StepStatus,
            details: currentStep === 3 ? [stepData.processedCount ? `${stepData.processedCount} records processed...` : `Starting ingestion...`, stepData.progress || ''] : currentStep > 3 ? [`${stepData.processedCount || 0} records translated`] : []
        },
        {
            label: "Exception Mining",
            icon: Target,
            status: currentStep === 4 ? 'running' : currentStep > 4 ? 'complete' : 'waiting' as StepStatus,
            details: currentStep >= 4 ? [`Scanning fleet heartbeat...`, `${stepData.exceptions || 0} operational risks flagged`] : [] // Fixed fallback to 0 instead of 5
        },
    ];

    const handleDelete = async (fileId: string) => {
        if (confirm("Delete this import record?")) {
            await deleteImportLog(fileId);
            loadLogs();
        }
    };

    const handleCancel = async () => {
        if (processingFile) {
            if (confirm("Stop processing and clean up this file?")) {
                await deleteImportLog(processingFile);
                setProcessingFile(null);
                setShowStatus(false);
                loadLogs();
            }
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
                        Data <span className="text-primary italic">Ingestion</span>
                    </h1>
                    <div className="flex items-center gap-4 mt-3 text-sm font-medium">
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-primary rounded-full border border-blue-100 glow-blue">
                            <Zap className="h-4 w-4" />
                            AI Normalization Active
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">Pipeline Status: <span className="text-green-600 font-bold">Ready</span></span>
                    </div>
                </div>
                <button
                    onClick={loadLogs}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 shadow-sm transition-all active:scale-95 group"
                >
                    <RefreshCw className={loading ? "w-5 h-5 animate-spin" : "w-5 h-5 group-hover:rotate-180 transition-transform duration-500"} />
                </button>
            </header>

            <main className="max-w-6xl space-y-16">
                <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-12 text-white glow-blue shadow-2xl">
                    <div className="relative z-10 max-w-2xl space-y-6">
                        <div className="inline-flex items-center px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-primary text-xs font-bold uppercase tracking-widest">
                            Enterprise Scale
                        </div>
                        <h2 className="text-5xl font-black tracking-tighter leading-none">
                            Broadcast Your <br /> Manifests
                        </h2>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Drag and drop your Excel manifests into the core. Our agents handle
                            header alignment, status translation, and exception detection automatically.
                        </p>
                        <FileUpload onUploadComplete={handleUploadComplete} />
                    </div>
                    {/* Visual Flare */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/20 blur-[120px] rounded-full" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full" />
                </section>

                <section className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-[2.5rem] p-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Transmission Logs</h3>
                            <p className="text-slate-400 font-medium text-sm">Real-time ingestion queue and audit history</p>
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
