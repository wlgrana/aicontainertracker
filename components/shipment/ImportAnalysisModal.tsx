'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, DollarSign, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import type { ImportAnalysis } from '@/app/actions/analyzeImport';

interface ImportAnalysisModalProps {
    analysis: ImportAnalysis | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ImportAnalysisModal({ analysis, isOpen, onClose }: ImportAnalysisModalProps) {
    if (!analysis) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        Mission Oracle - Import Analysis
                    </DialogTitle>
                </DialogHeader>

                {/* Import Summary */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <div className="text-sm text-gray-600">Containers</div>
                        <div className="text-2xl font-bold">{analysis.summary.totalContainers.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Shipments</div>
                        <div className="text-2xl font-bold">{analysis.summary.totalShipments.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Events</div>
                        <div className="text-2xl font-bold">{analysis.summary.totalEvents.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Data Quality</div>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            {analysis.dataQuality.score}%
                            {analysis.dataQuality.score >= 90 ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Critical Alerts */}
                {analysis.criticalAlerts.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Critical Alerts ({analysis.criticalAlerts.length})
                        </h3>
                        <div className="space-y-2">
                            {analysis.criticalAlerts.map((alert, i) => (
                                <div
                                    key={i}
                                    className="p-3 border-l-4 border-red-500 bg-red-50 rounded"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-red-900">{alert.message}</p>
                                            {alert.estimatedImpact && (
                                                <p className="text-sm text-red-700 mt-1">{alert.estimatedImpact}</p>
                                            )}
                                        </div>
                                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                                            {alert.severity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Financial Summary */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Financial Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-blue-50 rounded">
                            <div className="text-sm text-gray-600">Total Freight</div>
                            <div className="text-xl font-bold">{analysis.financialSummary.totalFreight}</div>
                        </div>
                        <div className="p-3 bg-amber-50 rounded">
                            <div className="text-sm text-gray-600">Demurrage Risk</div>
                            <div className="text-xl font-bold text-amber-700">{analysis.financialSummary.demurrageRisk}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">Avg per Container</div>
                            <div className="text-xl font-bold">{analysis.financialSummary.avgCostPerContainer}</div>
                        </div>
                    </div>
                    {analysis.financialSummary.anomalies.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-amber-700">Cost Anomalies:</p>
                            {analysis.financialSummary.anomalies.map((anomaly, i) => (
                                <div key={i} className="text-sm p-2 bg-amber-50 rounded">
                                    <span className="font-mono font-medium">{anomaly.container}</span>: {anomaly.amount} - {anomaly.reason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Exceptions */}
                {analysis.topExceptions.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-orange-600" />
                            Top Exceptions ({analysis.topExceptions.length})
                        </h3>
                        <div className="space-y-2">
                            {analysis.topExceptions.map((exception, i) => (
                                <div
                                    key={i}
                                    className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {/* Navigate to container detail */ }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-semibold">{exception.containerNumber}</span>
                                                <Badge variant="outline">{exception.severity}</Badge>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{exception.issue}</p>
                                            <p className="text-xs text-gray-600 mt-1">{exception.details}</p>
                                            <p className="text-xs text-blue-600 mt-2">→ {exception.recommendedAction}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommended Actions */}
                {analysis.recommendedActions.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Recommended Actions</h3>
                        <div className="space-y-2">
                            {analysis.recommendedActions.map((action, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded">
                                    <span className="text-blue-600 font-bold">{i + 1}.</span>
                                    <div className="flex-1">
                                        <p className="font-medium">{action.action}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Priority: {action.priority} • Affects {action.affectedContainers} container(s)
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button onClick={() => {/* Export report */ }}>
                        Export Report
                    </Button>
                    <Button onClick={() => {/* Flag all exceptions */ }}>
                        Flag All Exceptions
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
