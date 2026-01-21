"use client";

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { getHistoryLogs } from '@/app/actions/ingestion/actions';
import { Clock, RefreshCw, FileText, Calendar, ArrowRight, Database, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ImportHistoryPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await getHistoryLogs();
            console.log('[Import History] Loaded logs:', data.length, 'logs');
            console.log('[Import History] Log details:', data);
            setLogs(data);
        } catch (e) {
            console.error("Failed to load logs", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);



    const getQualityBadge = (grade: string) => {
        switch (grade) {
            case 'EXCELLENT': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Excellent Quality</Badge>;
            case 'GOOD': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Good Quality</Badge>;
            case 'NEEDS_IMPROVEMENT': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Needs Review</Badge>;
            case 'POOR': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Poor Quality</Badge>;
            default: return <Badge variant="outline" className="text-slate-500">Unknown</Badge>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Import History</h1>
                        <p className="text-slate-500 font-medium">Archive of past data ingestion events.</p>
                    </div>
                    <Button
                        onClick={loadLogs}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-600 gap-2"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </header>

                {/* Main List */}
                <main className="space-y-4">
                    {loading && logs.length === 0 ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No History Found</h3>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                                Start a new import simulation to see records appear here.
                            </p>
                            <Link href="/import" className="mt-6 inline-flex">
                                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                                    Start New Import
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <Link
                                href={`/import-history/${encodeURIComponent(log.fileName)}`}
                                key={log.fileName}
                                className="block group"
                            >
                                <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group-hover:-translate-y-0.5">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">

                                            {/* Left: Info */}
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1 break-all">
                                                            {log.fileName}
                                                        </h3>
                                                        <Badge variant={log.status === 'COMPLETED' ? 'default' : 'secondary'} className={cn(
                                                            "text-[10px] uppercase font-bold tracking-wider",
                                                            log.status === 'COMPLETED' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {log.status}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                            {new Date(log.importedOn).toLocaleString()}
                                                        </div>
                                                        <div className="w-px h-3 bg-slate-200" />
                                                        <div className="flex items-center gap-1.5">
                                                            <Database className="w-3.5 h-3.5 text-slate-400" />
                                                            {log.rowsProcessed} Rows
                                                        </div>
                                                        {log.qualityMetrics && (
                                                            <>
                                                                <div className="w-px h-3 bg-slate-200" />
                                                                <div className="flex items-center gap-1.5">
                                                                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                                                    {(log.qualityMetrics.avgCaptureRate * 100).toFixed(0)}% Capture
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Middle: Quality Badge */}
                                            <div className="hidden md:block">
                                                {log.qualityMetrics ? getQualityBadge(log.qualityMetrics.qualityGrade) : (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-200">Processing...</Badge>
                                                )}
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 justify-end">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition-all"
                                                >
                                                    View Details <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))
                    )}
                </main>
            </div>
        </div>
    );
}
