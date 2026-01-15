"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getImportLogDetails } from '@/app/actions/ingestion/actions';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Database, FileJson, Columns } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // Assuming generic utility exists, else will inline or avoid

export default function IngestionDetailsPage() {
    const { id } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedContainer, setSelectedContainer] = useState<any>(null);

    const fileName = decodeURIComponent(id as string);

    useEffect(() => {
        const load = async () => {
            const res = await getImportLogDetails(fileName);
            setData(res);
            setLoading(false);
            if (res?.containers?.length) {
                setSelectedContainer(res.containers[0]);
            }
        };
        load();
    }, [fileName]);

    if (loading) return <div className="p-10 text-slate-500">Loading details...</div>;
    if (!data) return <div className="p-10 text-red-500">Import log not found.</div>;

    const containers = data.containers || [];
    const stats = {
        total: containers.length,
        success: containers.length,
        unmappedContainerCount: containers.filter((c: any) => {
            const u = c.metadata?.mapping?.unmappedFields || c.metadata?.unmapped || {};
            return Object.keys(u).length > 0;
        }).length,
        uniqueUnmappedFieldsCount: new Set(containers.flatMap((c: any) => {
            const u = c.metadata?.mapping?.unmappedFields || c.metadata?.unmapped || {};
            return Object.keys(u);
        })).size,
        missingCount: containers.filter((c: any) => c.metadata?.missing && c.metadata.missing.length > 0).length
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/ingestion" className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Ingestion Details</h1>
                    <p className="text-slate-500 text-sm font-mono">{fileName}</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-slate-700">{stats.total}</span>
                        <span className="text-slate-400 text-sm">Containers</span>
                    </div>
                    {stats.uniqueUnmappedFieldsCount > 0 && (
                        <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                            <Columns className="w-4 h-4 text-amber-500" />
                            <span className="font-bold text-slate-700">{stats.uniqueUnmappedFieldsCount}</span>
                            <span className="text-slate-400 text-sm">Unique Unmapped Fields</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                {/* List Sidebar */}
                <div className="col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-700">Processed Containers</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {containers.map((c: any) => {
                            const hasIssues = (c.metadata?.missing?.length > 0) || (c.metadata?.unmapped && Object.keys(c.metadata.unmapped).length > 0);

                            return (
                                <div
                                    key={c.containerNumber}
                                    onClick={() => setSelectedContainer(c)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedContainer?.containerNumber === c.containerNumber
                                        ? 'bg-blue-50 border-blue-200 shadow-inner'
                                        : 'bg-white border-transparent hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-800">{c.containerNumber}</span>
                                        {hasIssues && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex justify-between">
                                        <span>{c.currentStatus}</span>
                                        <span>{c.metadata?.unmapped ? Object.keys(c.metadata.unmapped).length : 0} extra fields</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Details Panel */}
                <div className="col-span-8 space-y-6 overflow-y-auto pr-2">
                    {selectedContainer ? (
                        <>
                            {/* Visual Warnings */}
                            {selectedContainer.metadata?.missing?.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-red-800">Missing Required Fields</h4>
                                        <p className="text-red-600 text-sm mt-1">
                                            The following standard fields could not be found in the source:
                                        </p>
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {selectedContainer.metadata.missing.map((f: string) => (
                                                <span key={f} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-mono">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(() => {
                                const unmapped = selectedContainer.metadata?.mapping?.unmappedFields || selectedContainer.metadata?.unmapped || {};
                                if (Object.keys(unmapped).length > 0) {
                                    return (
                                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold text-amber-800">Unmapped Data Detected</h4>
                                                <p className="text-amber-700 text-sm mt-1">
                                                    These fields were present in the source but did not match our standard schema. They are stored in metadata.
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 mt-3 w-full">
                                                    {Object.entries(unmapped).map(([key, val]: any) => {
                                                        const isObj = typeof val === 'object' && val !== null && 'rawValue' in val;
                                                        const displayVal = isObj ? val.rawValue : val;
                                                        return (
                                                            <div key={key} className="flex justify-between items-center p-2 bg-amber-100/50 rounded-lg text-xs">
                                                                <span className="font-medium text-amber-900 truncate max-w-[120px]" title={key}>{key}</span>
                                                                <span className="font-mono text-amber-800 truncate max-w-[150px]" title={displayVal?.toString()}>{displayVal?.toString()}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Raw Data View */}
                            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileJson className="w-5 h-5 text-slate-400" />
                                    <h3 className="font-bold text-slate-800">Raw Source Data</h3>
                                </div>
                                <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl overflow-x-auto text-xs font-mono">
                                    {JSON.stringify(selectedContainer.metadata?.raw || {}, null, 2)}
                                </pre>
                            </section>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            Select a container to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
