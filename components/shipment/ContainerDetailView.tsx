"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, Building2, MapPin, Pencil, Plus, AlertTriangle, ArrowRight, Save, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateContainer, addNote } from "@/app/actions/operational/actions";
import { runAgentAudit } from "@/app/actions/reRunAgentAction";
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
        const result = await updateContainer(data.containerNumber, { currentStatus: newStatus });
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

        const currentNotes = data.notes ? data.notes + "\n" + note : note;
        // Also simpler: standard addNote action usually appends
        const result = await addNote(data.containerNumber, note);

        if (result.success) {
            toast.success("Note added");
            setData((prev: any) => ({
                ...prev,
                notes: currentNotes // Optimistic, ideally fetch fresh
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

    const statusOptions = [
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
                { key: "gateOutDate", label: "Gate Out", type: "date" },
                { key: "deliveryDate", label: "Delivered", type: "date" },
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
                { key: "hbl", label: "House BL" },
                { key: "shipment.shipmentReference", label: "Reference", readOnly: true },
                { key: "sealNumber", label: "Seal #" },
                { key: "shipment.customerPo", label: "Customer PO" },
            ]
        },
        {
            title: "CONTAINER SPECS",
            icon: MapPin, // logic stretch but works for location/physical
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


    const handleReAudit = async () => {
        setIsLoading(true);
        toast.info("Starting Auditor Agent re-run...");
        try {
            const result = await runAgentAudit(data.containerNumber);
            if (result.success) {
                toast.success("Auditor Agent finished. Decision: " + result.decision);
                router.refresh();
            } else {
                toast.error("Audit failed: " + result.error);
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
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
                                {/* Re-run Auditor Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReAudit}
                                    disabled={isLoading}
                                    className="border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                    Re-run Auditor
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

            {/* 2. ATTENTION BANNER */}
            {hasIssues && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3 text-amber-900">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <span className="font-bold">Attention Required:</span>
                            <span className="font-medium">{issueText}</span>
                        </div>
                        <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100 text-amber-900">
                            Resolve
                        </Button>
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
                                {card.fields.map(field => {
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
                        {data.notes ? (
                            data.notes.split('\n').map((note: string, i: number) => (
                                <div key={i} className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700">
                                    {note}
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-400 italic text-center py-4">No notes recorded.</div>
                        )}
                    </div>
                </div>

                {/* 5. EVENT HISTORY */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Event History</h3>
                        <Button variant="ghost" size="sm" className="text-xs hover:bg-white">+ Add Event</Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Date/Time</th>
                                    <th className="px-6 py-3">Event</th>
                                    <th className="px-6 py-3">Location</th>
                                    <th className="px-6 py-3">Source</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.events && data.events.length > 0 ? (
                                    data.events.map((ev: any) => (
                                        <tr key={ev.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-mono text-slate-600">
                                                {new Date(ev.eventDateTime).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-slate-900">{ev.stageName}</td>
                                            <td className="px-6 py-3 text-slate-600">{ev.location || "--"}</td>
                                            <td className="px-6 py-3">
                                                <Badge variant="secondary" className="text-[10px] h-5">{ev.source}</Badge>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">No events recorded.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
