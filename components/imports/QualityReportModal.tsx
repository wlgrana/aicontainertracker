"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { QualityBadge } from './QualityBadge';

export interface ImportQualityMetrics {
    totalContainers: number;
    processedContainers: number;
    avgCaptureRate: number;
    minCaptureRate: number;
    maxCaptureRate: number;
    totalFieldsMapped: number;
    totalFieldsUnmapped: number;
    totalRawFields: number;
    uniqueUnmappedFields: string[];
    avgMappingConfidence: number;
    lowConfidenceCount: number;
    qualityTiers: {
        excellent: number;
        good: number;
        needsImprovement: number;
        poor: number;
    };
    qualityGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
    recommendImprovement: boolean;
}

interface QualityReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    metrics: ImportQualityMetrics | null;
    onImprove: () => void;
    isImproving?: boolean;
    jobStatus?: { status: string; progress: number; message?: string };
}

export function QualityReportModal({ isOpen, onClose, fileName, metrics, onImprove, isImproving, jobStatus }: QualityReportModalProps) {
    if (!metrics) return null;

    const total = metrics.totalContainers || 1; // Avoid divide by zero
    const tiers = metrics.qualityTiers || { excellent: 0, good: 0, needsImprovement: 0, poor: 0 };

    // Simple bar chart data
    const distribution = [
        { label: 'High (≥90%)', count: tiers.excellent, color: 'bg-green-500', percent: (tiers.excellent / total) * 100 },
        { label: 'Good (75-89%)', count: tiers.good, color: 'bg-yellow-400', percent: (tiers.good / total) * 100 },
        { label: 'Fair (60-74%)', count: tiers.needsImprovement, color: 'bg-orange-400', percent: (tiers.needsImprovement / total) * 100 },
        { label: 'Poor (<60%)', count: tiers.poor, color: 'bg-red-500', percent: (tiers.poor / total) * 100 },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-black">{fileName}</DialogTitle>
                            <DialogDescription>Import Quality Assessment Report</DialogDescription>
                        </div>
                        <QualityBadge grade={metrics.qualityGrade} captureRate={metrics.avgCaptureRate} className="scale-125 origin-right" />
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 pt-2">
                    <div className="space-y-6">
                        {/* Progress Section */}
                        {(isImproving || (jobStatus && jobStatus.status === 'RUNNING')) && (
                            <Card className="p-6 border-blue-200 bg-blue-50">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-700">
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Improving Data Quality...
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium text-blue-600">
                                        <span>{jobStatus?.message || "Processing batch..."}</span>
                                        <span>{jobStatus?.progress || 0}%</span>
                                    </div>
                                    <Progress value={jobStatus?.progress || 0} className="h-2 bg-blue-200" />
                                </div>
                            </Card>
                        )}

                        {jobStatus?.status === 'COMPLETED' && (
                            <Card className="p-6 border-green-200 bg-green-50">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-green-700">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Improvement Complete!
                                </h3>
                                <p className="text-green-800">
                                    The batch has been re-processed. Close and re-open this report to see updated metrics.
                                </p>
                            </Card>
                        )}

                        {/* Summary Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <div className="text-sm text-slate-500 font-medium">Capture Rate</div>
                                <div className="text-2xl font-black text-slate-900">{(metrics.avgCaptureRate * 100).toFixed(1)}%</div>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <div className="text-sm text-slate-500 font-medium">Confidence</div>
                                <div className="text-2xl font-black text-slate-900">{(metrics.avgMappingConfidence * 100).toFixed(1)}%</div>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <div className="text-sm text-slate-500 font-medium">Unmapped Fields</div>
                                <div className="text-2xl font-black text-red-600">{metrics.uniqueUnmappedFields.length}</div>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <div className="text-sm text-slate-500 font-medium">Containers</div>
                                <div className="text-2xl font-black text-slate-900">{metrics.totalContainers}</div>
                            </Card>
                        </div>

                        {/* Distribution Chart */}
                        <Card className="p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-slate-400" />
                                Quality Distribution
                            </h3>
                            <div className="space-y-3">
                                {distribution.map((item) => (
                                    <div key={item.label} className="flex items-center gap-4">
                                        <div className="w-32 text-sm font-medium text-slate-600">{item.label}</div>
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${item.color}`}
                                                style={{ width: `${item.percent}%` }}
                                            />
                                        </div>
                                        <div className="w-12 text-right text-sm font-bold text-slate-900">{item.count}</div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Unmapped Fields Analysis */}
                        {metrics.uniqueUnmappedFields.length > 0 && (
                            <Card className="p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-600">
                                    <AlertTriangle className="w-5 h-5" />
                                    Unmapped Data Fields
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    The following fields were found in the source file but coundn't be mapped to the canonical schema.
                                    Running the improvement loop will attempt to learn these synonyms.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {metrics.uniqueUnmappedFields.map(field => (
                                        <div key={field} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm font-medium">
                                            {field}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-lg">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {metrics.recommendImprovement && !jobStatus?.status && (
                        <Button
                            onClick={onImprove}
                            disabled={isImproving}
                            className="bg-primary text-white hover:bg-primary/90"
                        >
                            {isImproving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Improve Batch ({metrics.totalContainers} containers)
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
