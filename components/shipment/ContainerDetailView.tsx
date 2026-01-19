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

    const dataCards = [
        {
            title: "DATES & MILESTONES",
            icon: Calendar,
            fields: [
                { key: "shipment.bookingDate", label: "Booking Date", type: "date" },
                { key: "etd", label: "ETD", type: "date" },
                { key: "atd", label: "ATD", type: "date" },
                { key: "eta", label: "ETA", type: "date" },
                { key: "ata", label: "ATA", type: "date" },
                { key: "lastFreeDay", label: "Last Free Day (LFD)", type: "date", warningIfMissing: true },
                { key: "detentionFreeDay", label: "Detention Free Day", type: "date" },
                { key: "gateOutDate", label: "Gate Out", type: "date" },
                { key: "deliveryDate", label: "Delivered", type: "date" },
                { key: "finalDestinationEta", label: "Final Dest ETA", type: "date" },
                { key: "emptyReturnDate", label: "Empty Return", type: "date" },
            ]
        },
        {
            title: "PARTIES & REFERENCES",
            icon: Building2,
            fields: [
                { key: "shipment.consignee", label: "Consignee" },
                { key: "shipment.shipper", label: "Shipper" },
                { key: "businessUnit", label: "Business Unit" },
                { key: "mbl", label: "Master BL" },
                { key: "hbl", label: "House BL" }, // Verified: container.hbl should be available if populated
                { key: "shipment.shipmentReference", label: "Reference", readOnly: true },
                { key: "sealNumber", label: "Seal #" },
                { key: "shipment.customerPo", label: "Customer PO" },
            ]
        },
        {
            title: "CONTAINER SPECS",
            icon: MapPin,
            fields: [
                { key: "containerNumber", label: "Container #", readOnly: true },
                { key: "containerType", label: "Type" },
                { key: "carrier", label: "Carrier" },
                { key: "pieces", label: "Pieces", type: "number" },
                { key: "grossWeight", label: "Weight (kg)", type: "number" },
                { key: "volumeCbm", label: "Volume (CBM)", type: "number" },
            ]
        },
        {
            title: "ROUTING",
            icon: MapPin,
            fields: [
                { key: "pol", label: "POL" },
                { key: "pod", label: "POD" },
                { key: "shipment.finalDestination", label: "Final Destination" },
                { key: "serviceType", label: "Service Type" },
                { key: "currentVessel", label: "Vessel" },
                { key: "currentVoyage", label: "Voyage" },
                { key: "loadType", label: "Load Type" },
            ]
        }
    ];

    // Helper to extract value
    const getValue = (key: string) => {
        const isLinked = key.startsWith("shipment.");
        const rawKey = isLinked ? key.split('.')[1] : key;
        const value = isLinked
            ? data.shipmentContainers?.[0]?.shipment?.[rawKey]
            : data[rawKey];
        return value;
    };

    const formatValue = (key: string, value: any) => {
        if (value === null || value === undefined) return "--";
        if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && (key.includes('Date') || key === 'etd' || key === 'atd' || key === 'eta' || key === 'ata' || key === 'lastFreeDay'))) {
            try { return new Date(value).toISOString().split('T')[0]; } catch (e) { return "--"; }
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

            {/* 1. HEADER SECTION */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="rounded-full hover:bg-slate-100">
                                <ArrowLeft className="h-5 w-5 text-slate-500" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{data.containerNumber}</h1>
                                <div className="text-lg font-medium text-indigo-600 mt-1">
                                    {data.businessUnit || "No Business Unit"}
                                </div>
                                <div className="flex gap-2 text-sm text-slate-500 mt-1 items-center">
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

                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-3">
                                {/* Run Enricher Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRunEnricher}
                                    disabled={isLoading}
                                    className="border-purple-200 text-purple-700 hover:text-purple-900 hover:bg-purple-50 hover:border-purple-300"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                                    Run Enricher
                                </Button>

                                {/* Status Dropdown */}
                                <Select onValueChange={handleStatusChange} defaultValue={data.currentStatus}>
                                    <SelectTrigger className="w-[180px] font-bold bg-slate-50 border-slate-200 focus:ring-indigo-500">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <OracleChat containerId={data.containerNumber} />
                            </div>

                            {data.daysInTransit !== null && (
                                <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    {data.daysInTransit} Days in Transit
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* AI STATUS BANNER */}
            {(data.aiOperationalStatus || data.aiAttentionCategory) && (
                <div className="bg-slate-900 text-white border-b border-slate-800">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "p-3 rounded-xl",
                                    data.aiUrgencyLevel === 'CRITICAL' ? "bg-red-500/20 text-red-400" :
                                        data.aiUrgencyLevel === 'HIGH' ? "bg-orange-500/20 text-orange-400" :
                                            data.aiUrgencyLevel === 'MEDIUM' ? "bg-yellow-500/20 text-yellow-400" :
                                                "bg-green-500/20 text-green-400"
                                )}>
                                    <Bot className="h-8 w-8" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className={cn(
                                            "font-bold",
                                            data.aiUrgencyLevel === 'CRITICAL' ? "bg-red-500 text-white" :
                                                data.aiUrgencyLevel === 'HIGH' ? "bg-orange-500 text-white" :
                                                    data.aiUrgencyLevel === 'MEDIUM' ? "bg-yellow-500 text-black" :
                                                        "bg-green-500 text-white"
                                        )}>
                                            {data.aiOperationalStatus || "STATUS UNKNOWN"}
                                        </Badge>
                                        <span className="text-sm font-medium text-slate-400">
                                            Conf: {data.aiDataConfidence || "N/A"}
                                        </span>
                                    </div>
                                    <p className="text-lg font-medium text-white max-w-2xl">
                                        {data.aiStatusReason || "No status reason provided."}
                                    </p>
                                    {data.aiAttentionHeadline && (
                                        <div className="flex items-center gap-2 mt-2 text-sm text-yellow-400">
                                            <AlertTriangle className="h-4 w-4" />
                                            {data.aiAttentionHeadline}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right">
                                <div>
                                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Days in Transit</div>
                                    <div className="text-2xl font-black">{data.daysInTransit ?? "--"}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Health Score</div>
                                    <div className={cn("text-2xl font-black",
                                        (data.healthScore || 0) > 80 ? "text-green-400" :
                                            (data.healthScore || 0) > 50 ? "text-yellow-400" : "text-red-400"
                                    )}>{data.healthScore ?? "--"}/100</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">

                {/* 3. DATA CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {dataCards.map((card) => (
                        <Card key={card.title} className="shadow-sm border-slate-200">
                            <CardHeader className="pb-2 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <card.icon className="h-4 w-4" /> {card.title}
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingGroup(card)}>
                                    <Pencil className="h-3 w-3 text-slate-300 hover:text-indigo-600" />
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-4 grid grid-cols-2 gap-y-4 gap-x-6">
                                {card.fields.map((field: any) => {
                                    const value = getValue(field.key);
                                    const display = formatValue(field.key, value);

                                    // Check warning condition
                                    const showWarning = field.warningIfMissing && (value === null || value === undefined);

                                    return (
                                        <div key={field.key} className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">{field.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-sm font-medium break-all",
                                                    display === "--" ? "text-slate-300" : "text-slate-900"
                                                )}>
                                                    {display}
                                                </span>
                                                {showWarning && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* CUSTOMS & COMPLIANCE */}
                {(data.aceEntryNumber || data.pgaHold !== null || data.aceStatus) && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-2 border-b border-slate-50">
                            <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Customs & Compliance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">ACE Entry Number</span>
                                    <div className="font-mono font-medium text-slate-900">{data.aceEntryNumber || "—"}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">ACE Disposition</span>
                                    <div className="font-medium text-slate-900">{data.aceDisposition || "—"}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">PGA Hold</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={data.pgaHold ? "destructive" : "outline"} className={!data.pgaHold ? "bg-green-50 text-green-700 border-green-200" : ""}>
                                            {data.pgaHold ? "YES" : "NO"}
                                        </Badge>
                                        {data.pgaAgency && <Badge variant="secondary">{data.pgaAgency}</Badge>}
                                    </div>
                                </div>
                                {(data.pgaHoldReason || data.aceStatus) && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Status / Reason</span>
                                        <div className="font-medium text-slate-900">{data.pgaHoldReason || data.aceStatus || "—"}</div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* EXCEPTIONS & PRIORITY */}
                {(data.hasException || data.manualPriority) && (
                    <Card className={cn("shadow-sm border-2", data.manualPriority === 'CRITICAL' ? "border-red-200 bg-red-50/10" : "border-amber-200 bg-amber-50/10")}>
                        <CardHeader className="pb-2 border-b border-slate-100/50">
                            <CardTitle className={cn("text-xs font-black uppercase tracking-widest flex items-center gap-2", data.manualPriority === 'CRITICAL' ? "text-red-600" : "text-amber-600")}>
                                <Siren className="h-4 w-4" /> Exceptions & Priority
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Exception Side */}
                            <div className="space-y-4 p-4 rounded-lg bg-white/50 border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Exception Status</span>
                                    <Badge variant={data.hasException ? "destructive" : "outline"} className={!data.hasException ? "text-slate-400" : ""}>
                                        {data.hasException ? "ACTIVE" : "NONE"}
                                    </Badge>
                                </div>
                                {data.hasException && (
                                    <>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Type</span>
                                            <div className="font-medium text-red-700">{data.exceptionType}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Notes</span>
                                            <div className="text-sm text-slate-700">{data.exceptionNotes || "No notes provided."}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Owner</span>
                                            <div className="text-sm text-slate-700 font-medium">{data.exceptionOwner || "Unassigned"}</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Priority Side */}
                            <div className="space-y-4 p-4 rounded-lg bg-white/50 border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Priority Override</span>
                                    {data.manualPriority ? (
                                        <Badge className={cn(
                                            data.manualPriority === 'CRITICAL' ? "bg-red-600" : "bg-amber-600"
                                        )}>{data.manualPriority}</Badge>
                                    ) : (
                                        <span className="text-xs text-slate-400">Not Set</span>
                                    )}
                                </div>
                                {data.manualPriority && (
                                    <>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Reason</span>
                                            <div className="font-medium text-slate-900">{data.priorityReason}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Set By</span>
                                            <div className="text-sm text-slate-600">
                                                {data.prioritySetBy} on {data.prioritySetDate ? new Date(data.prioritySetDate).toLocaleDateString() : "-"}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}


                {/* 3b. AI ENRICHMENT CARD */}
                {data.aiDerived && data.aiDerived.fields && Object.keys(data.aiDerived.fields).length > 0 && (
                    <div className="bg-purple-50 rounded-xl border border-purple-200 shadow-sm p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <BrainCircuit className="w-32 h-32 text-purple-600" />
                        </div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest flex items-center gap-2">
                                    <BrainCircuit className="h-4 w-4" /> AI Enrichment
                                </h3>
                                <p className="text-xs text-purple-700 mt-1">
                                    Derived from raw metadata without modifying official records.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="bg-white border-purple-200 text-purple-700">
                                    Mode: {data.aiDerived.mode}
                                </Badge>
                                <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-1 rounded">
                                    Last Run: {new Date(data.aiDerived.lastRun).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                            {Object.entries(data.aiDerived.fields).map(([key, field]: any) => (
                                <div key={key} className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <Badge className={cn(
                                            "text-[10px] px-1.5 py-0 h-5",
                                            field.confidence === 'HIGH' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                field.confidence === 'MED' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                                    "bg-red-100 text-red-700 hover:bg-red-100"
                                        )}>
                                            {field.confidence}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 hover:bg-green-50 hover:text-green-600 rounded-full"
                                            onClick={() => handleAcceptEnrichment(key, field)}
                                            title="Accept this value"
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="text-lg font-bold text-slate-800 mb-1">
                                        {String(field.value)}
                                    </div>
                                    <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                                        <span className="font-semibold text-purple-600">Source:</span> {field.source}
                                        <br />
                                        <span className="font-semibold text-purple-600">Logic:</span> {field.rationale}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. NOTES SECTION */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-500" /> Operational Notes
                    </h3>

                    <form id="note-form" action={handleAddNote} className="flex gap-2 mb-6">
                        <Input name="note" placeholder="Add a note..." className="flex-1" />
                        <Button type="submit" size="sm">
                            <Plus className="h-4 w-4 mr-2" /> Add Note
                        </Button>
                    </form>

                    <div className="space-y-3">
                        {data.activityLogs?.filter((log: any) => log.action === 'Note Added').length > 0 ? (
                            data.activityLogs
                                .filter((log: any) => log.action === 'Note Added')
                                .map((log: any) => (
                                    <div key={log.id} className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-xs text-indigo-600">{log.actor || 'User'}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                                        </div>
                                        {log.detail}
                                    </div>
                                ))
                        ) : (
                            <div className="text-sm text-slate-400 italic text-center py-4">No notes recorded.</div>
                        )}
                    </div>
                </div>





                {/* 6. DATA LINEAGE & AUDIT LOG */}
                <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Data Lineage & Audit Log
                    </h3>
                    <DataLineageContent data={data} />
                </div>

                {/* 7. AI INSIGHTS ACCORDION */}
                {(data.aiAssessment || data.aiAnalysis) && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <details className="group">
                            <summary className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-purple-600" />
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">AI Insights & Assessment</h3>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="text-xs group-open:hidden">[Expand]</span>
                                    <span className="text-xs hidden group-open:inline">[Collapse]</span>
                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                </div>
                            </summary>
                            <div className="p-6 border-t border-slate-100 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            </div>
                        </details>
                    </div>
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
