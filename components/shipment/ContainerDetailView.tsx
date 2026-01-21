"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, Building2, MapPin, Pencil, Plus, AlertTriangle, ArrowRight, Save, MessageSquare, ShieldCheck, BrainCircuit, Check, Ship, Anchor, FileText, Siren, Bot, Zap, Flag, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateContainer, addNote, acceptEnrichment, overrideStatus } from "@/app/actions/operational/actions";
import { runEnricherAgent } from "@/app/actions/reRunAgentAction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { OracleChat } from './OracleChat';
import Link from 'next/link';
import DataLineageContent from './DataLineageContent';


interface ContainerDetailViewProps {
    initialData: any;
    transitStages: any[];
}

export default function ContainerDetailView({ initialData, transitStages }: ContainerDetailViewProps) {
    const router = useRouter();
    const [data, setData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any | null>(null);
    const [showAiEnrichment, setShowAiEnrichment] = useState(false);
    const [showDataLineage, setShowDataLineage] = useState(false);
    const [showAiInsights, setShowAiInsights] = useState(false);

    // Sync state on prop change
    React.useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // --- Actions ---

    const handleStatusChange = async (newStatus: string) => {
        const result = await overrideStatus(data.containerNumber, newStatus, "Manual update from Dashboard");
        if (result.success) {
            toast.success(`Status updated to ${newStatus}`);
            setData((prev: any) => ({ ...prev, currentStatus: newStatus }));
            router.refresh();
        } else {
            toast.error("Failed to update status");
        }
    };

    const handleAddNote = async (formData: FormData) => {
        const note = formData.get('note') as string;
        if (!note) return;

        const result = await addNote(data.containerNumber, note);

        if (result.success) {
            toast.success("Note added");

            const newLog = {
                id: 'temp-' + Date.now(),
                action: 'Note Added',
                detail: note,
                createdAt: new Date().toISOString(),
                actor: 'Current User',
                source: 'Manual'
            };

            setData((prev: any) => ({
                ...prev,
                activityLogs: [newLog, ...(prev.activityLogs || [])]
            }));

            router.refresh();
            (document.getElementById('note-form') as HTMLFormElement)?.reset();
        } else {
            toast.error("Failed to add note: " + result.error);
        }
    };

    const handleSaveGroup = async (formData: FormData) => {
        if (!editingGroup) return;

        const updates: any = {};
        formData.forEach((value, key) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                // Handle Dates
                if (key.includes('Date') || key === 'atd' || key === 'etd' || key === 'eta' || key === 'ata' || key === 'lastFreeDay' || key === 'finalDestinationEta') {
                    updates[key] = trimmed === '' ? null : new Date(value);
                }
                // Handle Numbers
                else if (key === 'grossWeight' || key === 'volumeCbm' || key === 'pieces') {
                    updates[key] = trimmed === '' ? null : parseFloat(value);
                }
                else {
                    updates[key] = trimmed === '' ? null : value;
                }
            }
        });

        const result = await updateContainer(data.containerNumber, updates);
        if (result.success) {
            toast.success("Details updated");
            // Optimistic merge
            setData((prev: any) => {
                const newData = { ...prev };
                Object.keys(updates).forEach(key => {
                    // Check linked fields
                    if (['shipper', 'consignee', 'poNumber', 'customerPo', 'bookingDate', 'finalDestination'].includes(key)) {
                        if (!newData.shipmentContainers?.[0]?.shipment) return;
                        newData.shipmentContainers[0].shipment[key] = updates[key];
                    } else {
                        newData[key] = updates[key];
                    }
                });
                return newData;
            });
            setEditingGroup(null);
            router.refresh();
        } else {
            toast.error("Failed to update");
        }
    };


    // --- Configuration ---

    const statusOptions = transitStages?.map((stage: any) => ({
        value: stage.stageCode || stage.code,
        label: stage.stageName || stage.name || stage.definition
    })) || [
            { value: "BOOK", label: "Booked" },
            { value: "DEP", label: "Departed" },
            { value: "ARR", label: "Arrived" },
            { value: "DIS", label: "Discharged" },
            { value: "CUS", label: "Customs Hold" },
            { value: "REL", label: "Released" },
            { value: "OGF", label: "Out Gate" },
            { value: "DLV", label: "Delivered" },
            { value: "EMP", label: "Empty Return" },
        ];

    // Restructured for dense 3-column layout
    const logisticsCard = {
        title: "LOGISTICS OVERVIEW",
        sections: [
            {
                subtitle: "Dates & Milestones",
                icon: Calendar,
                fields: [
                    { key: "shipment.bookingDate", label: "Booking", type: "date" },
                    { key: "etd", label: "ETD", type: "date" },
                    { key: "atd", label: "ATD", type: "date" },
                    { key: "eta", label: "ETA", type: "date" },
                    { key: "ata", label: "ATA", type: "date" },
                    { key: "lastFreeDay", label: "LFD", type: "date", warningIfMissing: true },
                    { key: "gateOutDate", label: "Gate Out", type: "date" },
                    { key: "deliveryDate", label: "Delivered", type: "date" },
                ]
            },
            {
                subtitle: "Container & Specs",
                icon: Ship,
                fields: [
                    { key: "containerNumber", label: "Container #", readOnly: true, monospace: true, copyable: true },
                    { key: "containerType", label: "Type" },
                    { key: "carrier", label: "Carrier" },
                    { key: "sealNumber", label: "Seal #", monospace: true, copyable: true },
                    { key: "pieces", label: "Pieces", type: "number", align: "right", divider: true },
                    { key: "grossWeight", label: "Weight (kg)", type: "number", align: "right" },
                    { key: "volumeCbm", label: "Volume (CBM)", type: "number", align: "right" },
                ]
            },
            {
                subtitle: "Routing",
                icon: Anchor,
                fields: [
                    { key: "pol", label: "POL" },
                    { key: "pod", label: "POD" },
                    { key: "shipment.finalDestination", label: "Final Dest" },
                    { key: "serviceType", label: "Service Type" },
                    { key: "currentVessel", label: "Vessel" },
                    { key: "currentVoyage", label: "Voyage" },
                    { key: "loadType", label: "Load Type" },
                ]
            }
        ]
    };

    const partiesCard = {
        title: "PARTIES & REFERENCES",
        icon: Building2,
        fields: [
            { key: "shipment.consignee", label: "Consignee" },
            { key: "shipment.shipper", label: "Shipper" },
            { key: "businessUnit", label: "Business Unit" },
            { key: "mbl", label: "Master BL", monospace: true, copyable: true },
            { key: "hbl", label: "House BL", monospace: true, copyable: true },
            { key: "shipment.shipmentReference", label: "Reference", readOnly: true, monospace: true, copyable: true },
            { key: "shipment.customerPo", label: "Customer PO", copyable: true },
        ]
    };

    // Helper to extract value
    const getValue = (key: string) => {
        const isLinked = key.startsWith("shipment.");
        const rawKey = isLinked ? key.split('.')[1] : key;
        const value = isLinked
            ? data.shipmentContainers?.[0]?.shipment?.[rawKey]
            : data[rawKey];
        return value;
    };

    const formatValue = (key: string, value: any, type?: string) => {
        // Handle null/undefined/empty values
        if (value === null || value === undefined || value === '') return "—";

        // Handle dates
        if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && (key.includes('Date') || key === 'etd' || key === 'atd' || key === 'eta' || key === 'ata' || key === 'lastFreeDay'))) {
            try {
                const date = new Date(value);
                // Format as "May 15, 2025"
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch (e) {
                return "—";
            }
        }

        // Handle numbers
        if (type === 'number' && typeof value === 'number') {
            // Add thousand separators
            const formatted = value.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });

            // Add units based on field
            if (key === 'grossWeight') return `${formatted} kg`;
            if (key === 'volumeCbm') return `${formatted} m³`;

            return formatted;
        }

        return String(value);
    };

    // Derived Logic
    const hasIssues = data.hasException || (data.lastFreeDay && new Date(data.lastFreeDay) < new Date() && !data.emptyReturnDate);
    const issueText = data.exceptionType || (hasIssues ? "Review Required" : "");


    const handleRunEnricher = async () => {
        setIsLoading(true);
        toast.info("Starting Enricher Agent...");
        try {
            const result = await runEnricherAgent(data.containerNumber);
            if (result.success) {
                toast.success("Enricher Agent complete: " + result.summary);
                router.refresh();
            } else {
                toast.error("Enrichment failed: " + result.error);
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptEnrichment = async (key: string, field: any) => {
        const toastId = toast.loading(`Accepting ${key}...`);
        try {
            const result = await acceptEnrichment(data.containerNumber, key, field.value);
            if (result.success) {
                toast.success(`Accepted ${key}`, { id: toastId });
                router.refresh();
            } else {
                toast.error("Failed to accept: " + result.error, { id: toastId });
            }
        } catch (e) {
            toast.error("Error accepting enrichment", { id: toastId });
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">

            {/* 1. HEADER SECTION - COMPACT */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-2">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="rounded-full hover:bg-slate-100 h-8 w-8">
                                <ArrowLeft className="h-4 w-4 text-slate-500" />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-3 flex-wrap">
                                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.containerNumber}</h1>
                                    <span className="text-sm font-semibold text-indigo-600">{data.businessUnit || "No Business Unit"}</span>
                                    {data.daysInTransit !== null && (
                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {data.daysInTransit}d Transit
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 text-xs text-slate-500 items-center mt-0.5">
                                    <span className="font-medium text-slate-700">{data.carrier}</span>
                                    <span>•</span>
                                    <span>{data.pol || "?"}</span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span>{data.pod || "?"}</span>
                                    {data.shipmentContainers?.[0]?.shipment?.finalDestination && (
                                        <>
                                            <ArrowRight className="h-3 w-3" />
                                            <span>{data.shipmentContainers[0].shipment.finalDestination}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>


                        <div className="flex items-center gap-3">
                            {/* Status Display */}
                            <Badge className="h-8 px-3 text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {data.aiOperationalStatus || 'No Status'}
                            </Badge>

                            {/* Vertical Separator */}
                            <div className="h-6 w-px bg-slate-300"></div>

                            {/* Run Enricher Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRunEnricher}
                                disabled={isLoading}
                                className="border-purple-200 text-purple-700 hover:text-purple-900 hover:bg-purple-50 hover:border-purple-300 h-8 text-xs"
                            >
                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BrainCircuit className="h-3 w-3 mr-1" />}
                                Enricher
                            </Button>

                            <OracleChat containerId={data.containerNumber} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-4">

                {/* LOGISTICS OVERVIEW - 3 COLUMN DENSE LAYOUT */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-1.5 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {logisticsCard.title}
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => {
                            // Flatten sections into a single fields array for the edit dialog
                            const flattenedFields = logisticsCard.sections.flatMap((section: any) => section.fields);
                            setEditingGroup({ ...logisticsCard, fields: flattenedFields });
                        }}>
                            <Pencil className="h-3 w-3 text-slate-300 hover:text-indigo-600" />
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-2.5 pb-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {logisticsCard.sections.map((section: any) => (
                                <div key={section.subtitle} className="space-y-2">
                                    <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-slate-100">
                                        <section.icon className="h-3 w-3 text-indigo-500" />
                                        <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">{section.subtitle}</h4>
                                    </div>
                                    <div className="space-y-2">
                                        {section.fields.map((field: any, idx: number) => {
                                            const value = getValue(field.key);
                                            const display = formatValue(field.key, value, field.type);
                                            const showWarning = field.warningIfMissing && (value === null || value === undefined);

                                            return (
                                                <div key={field.key} className={cn("flex flex-col", field.divider && "mt-3 pt-2 border-t border-slate-100")}>
                                                    <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">{field.label}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "text-xs font-medium break-all",
                                                            display === "—" ? "text-slate-300" : "text-slate-900",
                                                            field.monospace && "font-mono",
                                                            field.align === "right" && "text-right w-full"
                                                        )}>
                                                            {display}
                                                        </span>
                                                        {showWarning && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                                        {field.copyable && value && display !== "—" && (
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(String(value));
                                                                    toast.success("Copied to clipboard!");
                                                                }}
                                                                className="opacity-0 hover:opacity-100 transition-opacity ml-1"
                                                                title="Copy to clipboard"
                                                            >
                                                                <svg className="h-3 w-3 text-slate-400 hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* PARTIES & REFERENCES - 2 COLUMN LAYOUT */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-1.5 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <partiesCard.icon className="h-3.5 w-3.5" /> {partiesCard.title}
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingGroup(partiesCard)}>
                            <Pencil className="h-3 w-3 text-slate-300 hover:text-indigo-600" />
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-2.5 pb-3 grid grid-cols-2 gap-y-2.5 gap-x-4">
                        {partiesCard.fields.map((field: any) => {
                            const value = getValue(field.key);
                            const display = formatValue(field.key, value, field.type);

                            return (
                                <div key={field.key} className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">{field.label}</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                            "text-xs font-medium break-all",
                                            display === "—" ? "text-slate-300" : "text-slate-900",
                                            field.monospace && "font-mono"
                                        )}>
                                            {display}
                                        </span>
                                        {field.copyable && value && display !== "—" && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(String(value));
                                                    toast.success("Copied to clipboard!");
                                                }}
                                                className="opacity-0 hover:opacity-100 transition-opacity ml-1"
                                                title="Copy to clipboard"
                                            >
                                                <svg className="h-3 w-3 text-slate-400 hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* CUSTOMS & COMPLIANCE - COMPACT */}
                {(data.aceEntryNumber || data.pgaHold !== null || data.aceStatus) && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-1.5 border-b border-slate-50">
                            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" /> Customs & Compliance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2.5 pb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase font-bold text-slate-400">ACE Entry Number</span>
                                    <div className="font-mono text-xs font-medium text-slate-900">{data.aceEntryNumber || "—"}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase font-bold text-slate-400">ACE Disposition</span>
                                    <div className="text-xs font-medium text-slate-900">{data.aceDisposition || "—"}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase font-bold text-slate-400">PGA Hold</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={data.pgaHold ? "destructive" : "outline"} className={cn("text-xs", !data.pgaHold ? "bg-green-50 text-green-700 border-green-200" : "")}>
                                            {data.pgaHold ? "YES" : "NO"}
                                        </Badge>
                                        {data.pgaAgency && <Badge variant="secondary" className="text-xs">{data.pgaAgency}</Badge>}
                                    </div>
                                </div>
                                {(data.pgaHoldReason || data.aceStatus) && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] uppercase font-bold text-slate-400">Status / Reason</span>
                                        <div className="text-xs font-medium text-slate-900">{data.pgaHoldReason || data.aceStatus || "—"}</div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* EXCEPTIONS & PRIORITY - COMPACT */}
                {(data.hasException || data.manualPriority) && (
                    <Card className={cn("shadow-sm border-2", data.manualPriority === 'CRITICAL' ? "border-red-200 bg-red-50/10" : "border-amber-200 bg-amber-50/10")}>
                        <CardHeader className="pb-1.5 border-b border-slate-100/50">
                            <CardTitle className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-2", data.manualPriority === 'CRITICAL' ? "text-red-600" : "text-amber-600")}>
                                <Siren className="h-3.5 w-3.5" /> Exceptions & Priority
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2.5 pb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Exception Side */}
                            <div className="space-y-2 p-2.5 rounded-lg bg-white/50 border border-slate-100">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Exception Status</span>
                                    <Badge variant={data.hasException ? "destructive" : "outline"} className={cn("text-xs", !data.hasException ? "text-slate-400" : "")}>
                                        {data.hasException ? "ACTIVE" : "NONE"}
                                    </Badge>
                                </div>
                                {data.hasException && (
                                    <>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Type</span>
                                            <div className="text-xs font-medium text-red-700">{data.exceptionType}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Notes</span>
                                            <div className="text-xs text-slate-700">{data.exceptionNotes || "No notes provided."}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Owner</span>
                                            <div className="text-xs text-slate-700 font-medium">{data.exceptionOwner || "Unassigned"}</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Priority Side */}
                            <div className="space-y-2 p-2.5 rounded-lg bg-white/50 border border-slate-100">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Priority Override</span>
                                    {data.manualPriority ? (
                                        <Badge className={cn(
                                            "text-xs",
                                            data.manualPriority === 'CRITICAL' ? "bg-red-600" : "bg-amber-600"
                                        )}>{data.manualPriority}</Badge>
                                    ) : (
                                        <span className="text-xs text-slate-400">Not Set</span>
                                    )}
                                </div>
                                {data.manualPriority && (
                                    <>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Reason</span>
                                            <div className="text-xs font-medium text-slate-900">{data.priorityReason}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Set By</span>
                                            <div className="text-xs text-slate-600">
                                                {data.prioritySetBy} on {data.prioritySetDate ? new Date(data.prioritySetDate).toLocaleDateString() : "-"}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}


                {/* NOTES - INLINE COMPACT */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
                    <form id="note-form" action={handleAddNote} className="flex gap-2">
                        <Input name="note" placeholder="Add operational note..." className="flex-1 h-7 text-xs" />
                        <Button type="submit" size="sm" className="h-7 text-xs px-2">
                            <Plus className="h-3 w-3" />
                        </Button>
                    </form>

                    {data.activityLogs?.filter((log: any) => log.action === 'Note Added').length > 0 && (
                        <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-100">
                            {data.activityLogs
                                .filter((log: any) => log.action === 'Note Added')
                                .slice(0, 3)
                                .map((log: any) => (
                                    <div key={log.id} className="text-xs bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-700">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="font-semibold text-[9px] text-indigo-600">{log.actor || 'User'}</span>
                                            <span className="text-[8px] text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-[10px]">{log.detail}</div>
                                    </div>
                                ))}
                            {data.activityLogs.filter((log: any) => log.action === 'Note Added').length > 3 && (
                                <div className="text-[9px] text-slate-400 text-center pt-1">+{data.activityLogs.filter((log: any) => log.action === 'Note Added').length - 3} more notes</div>
                            )}
                        </div>
                    )}
                </div>


                {/* AI ENRICHMENT - COLLAPSIBLE */}
                {data.aiDerived && data.aiDerived.fields && Object.keys(data.aiDerived.fields).length > 0 && (
                    <Card className="shadow-sm border-purple-200">
                        <CardHeader className="pb-1.5 border-b border-purple-100 cursor-pointer hover:bg-purple-50/50 transition-colors" onClick={() => setShowAiEnrichment(!showAiEnrichment)}>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-2">
                                    <BrainCircuit className="h-3.5 w-3.5" /> AI Enrichment ({Object.keys(data.aiDerived.fields).length} fields)
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-white border-purple-200 text-purple-700 text-[9px]">
                                        {data.aiDerived.mode}
                                    </Badge>
                                    {showAiEnrichment ? <ChevronUp className="h-4 w-4 text-purple-600" /> : <ChevronDown className="h-4 w-4 text-purple-600" />}
                                </div>
                            </div>
                        </CardHeader>
                        {showAiEnrichment && (
                            <CardContent className="pt-2.5 pb-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {Object.entries(data.aiDerived.fields).map(([key, field]: any) => (
                                        <div key={key} className="bg-white p-2 rounded-lg border border-purple-100 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <Badge className={cn(
                                                    "text-[9px] px-1 py-0 h-4",
                                                    field.confidence === 'HIGH' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                        field.confidence === 'MED' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                                            "bg-red-100 text-red-700 hover:bg-red-100"
                                                )}>
                                                    {field.confidence}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-5 w-5 p-0 hover:bg-green-50 hover:text-green-600 rounded-full"
                                                    onClick={() => handleAcceptEnrichment(key, field)}
                                                    title="Accept this value"
                                                >
                                                    <Check className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="text-sm font-bold text-slate-800 mb-0.5">
                                                {String(field.value)}
                                            </div>
                                            <div className="text-[9px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100">
                                                <span className="font-semibold text-purple-600">Source:</span> {field.source}
                                                <br />
                                                <span className="font-semibold text-purple-600">Logic:</span> {field.rationale}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )}


                {/* DATA LINEAGE - COLLAPSIBLE */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-1.5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setShowDataLineage(!showDataLineage)}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Data Lineage & Audit Log
                            </CardTitle>
                            {showDataLineage ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                    </CardHeader>
                    {showDataLineage && (
                        <CardContent className="pt-2.5 pb-3">
                            <DataLineageContent data={data} />
                        </CardContent>
                    )}
                </Card>

                {/* AI INSIGHTS - COLLAPSIBLE */}
                {(data.aiAssessment || data.aiAnalysis) && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-1.5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setShowAiInsights(!showAiInsights)}>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-purple-600" /> AI Insights & Assessment
                                </CardTitle>
                                {showAiInsights ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                        </CardHeader>
                        {showAiInsights && (
                            <CardContent className="pt-2.5 pb-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Last Analysis</span>
                                        <div className="font-medium text-slate-900">{data.aiLastUpdated ? new Date(data.aiLastUpdated).toLocaleString() : "—"}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Recommended Owner</span>
                                        <div className="font-medium text-slate-900">{data.aiRecommendedOwner || "Unassigned"}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">System Flags</span>
                                        <div className="font-medium text-slate-900">
                                            {data.metadata?._internal?.flags?.length > 0 ? (
                                                <div className="flex gap-1 flex-wrap">
                                                    {data.metadata._internal.flags.map((f: string) => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                                                </div>
                                            ) : "None"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Full Assessment Object</span>
                                    <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                                        <pre className="text-xs font-mono text-blue-300">
                                            {JSON.stringify(data.aiAssessment || data.aiAnalysis, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )}

            </main>

            {/* EDIT DIALOG */}
            <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit {editingGroup?.title}</DialogTitle>
                        <DialogDescription>Update fields in this section.</DialogDescription>
                    </DialogHeader>
                    {editingGroup && (
                        <form action={handleSaveGroup} className="grid grid-cols-2 gap-4 py-4">
                            {editingGroup.fields.map((field: any) => {
                                const val = getValue(field.key);
                                let defaultVal = "";
                                if (val !== null && val !== undefined) {
                                    // Basic formatting for edit inputs
                                    if (val instanceof Date || (typeof val === 'string' && !isNaN(Date.parse(val)) && field.type === 'date')) {
                                        try { defaultVal = new Date(val).toISOString().split('T')[0]; } catch (e) { defaultVal = String(val); }
                                    } else {
                                        defaultVal = String(val);
                                    }
                                }

                                return (
                                    <div key={field.key} className={cn("space-y-2", field.type === 'textarea' ? "col-span-2" : "")}>
                                        <Label className="text-xs text-slate-500">{field.label}</Label>
                                        {field.readOnly ? (
                                            <div className="h-9 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-500">
                                                {defaultVal || "--"}
                                            </div>
                                        ) : (
                                            <Input
                                                name={field.key}
                                                defaultValue={defaultVal}
                                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            <div className="col-span-2 flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
                                <Button type="submit" disabled={isLoading}><Save className="h-4 w-4 mr-2" /> Save Changes</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
