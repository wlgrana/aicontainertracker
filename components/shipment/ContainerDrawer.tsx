"use client";

import React, { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getContainerDetails } from "@/app/actions/entry/actions";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
    Info,
    History,
    Flag,
    Lock,
    FileText,
    Cpu,
    User,
    Globe,
    CheckCircle2,
    Calendar,
    ArrowRight,
    ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContainerDetailProps {
    containerId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function ContainerDetailDrawer({ containerId, isOpen, onClose }: ContainerDetailProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && containerId) {
            setLoading(true);
            getContainerDetails(containerId).then((res) => {
                setData(res);
                setLoading(false);
            });
        }
    }, [isOpen, containerId]);

    if (!isOpen) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[800px] sm:w-[540px] overflow-hidden flex flex-col px-10 pt-10">
                <SheetHeader className="mb-6">
                    <SheetTitle>Container {containerId}</SheetTitle>
                    <SheetDescription>
                        {loading ? "Loading details..." : "Operational Details"}
                    </SheetDescription>
                </SheetHeader>

                {data && !loading ? (
                    <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-4 bg-slate-100/50 p-1 rounded-xl h-auto">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 rounded-lg font-bold">Overview</TabsTrigger>
                            <TabsTrigger value="timeline" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 rounded-lg font-bold">Timeline</TabsTrigger>
                            <TabsTrigger value="flags" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 rounded-lg font-bold">Flags</TabsTrigger>
                            <TabsTrigger value="log" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 rounded-lg font-bold">Audit</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto mt-4 pr-1">
                            <TabsContent value="overview" className="space-y-6 pt-2 pb-8">
                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex gap-3 text-xs font-medium text-slate-600">
                                    <Info className="h-4 w-4 text-primary shrink-0" />
                                    <p>High-level operational profile. Includes current position, financial exposure, and active AI-detected risks.</p>
                                </div>

                                {/* Status Card */}
                                <div className="p-6 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden shadow-xl glow-blue">
                                    <div className="relative z-10">
                                        <h3 className="font-black mb-1 text-slate-400 text-[10px] uppercase tracking-widest">Protocol Status</h3>
                                        <div className="text-4xl font-black text-white tracking-tighter">{data.currentStatus}</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-2">
                                            <Calendar className="h-3.3 w-3.3" />
                                            Updated {data.statusLastUpdated ? format(new Date(data.statusLastUpdated), "MMM d, h:mm a") : "N/A"}
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 blur-[50px] rounded-full" />
                                </div>

                                {/* Mini Timeline */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journey Progress</h4>
                                    <div className="flex items-center gap-2">
                                        {['Ingested', 'Discharged', 'Gated-Out', 'Returned'].map((stage, idx) => (
                                            <React.Fragment key={stage}>
                                                <div className={cn(
                                                    "flex-1 h-2 rounded-full",
                                                    idx <= 1 ? "bg-primary glow-blue" : "bg-slate-100"
                                                )} />
                                                {idx < 3 && <div className="w-1 h-1 rounded-full bg-slate-200" />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                        <span>Start</span>
                                        <span>Final Delivery</span>
                                    </div>
                                </div>

                                {/* Exception Alert */}
                                {data.hasException && (
                                    <div className="p-5 bg-red-50 rounded-[2rem] border border-red-100 relative group overflow-hidden">
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest">
                                                    <Flag className="h-3 w-3" /> Critical Exception Detected
                                                </div>
                                                <h3 className="font-black text-xl text-red-900 tracking-tight">{data.exceptionType}</h3>
                                                <p className="text-sm font-bold text-red-700/70">Routing: {data.exceptionOwner}</p>
                                            </div>
                                            <Badge variant="destructive" className="rounded-lg px-3 py-1 font-black uppercase text-[10px] bg-red-600">Urgent</Badge>
                                        </div>
                                        <div className="absolute -bottom-8 -right-8 h-24 w-24 bg-red-500/5 rounded-full" />
                                    </div>
                                )}

                                {/* Key Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Carrier', value: data.carrier || "N/A", icon: Globe },
                                        { label: 'Spec', value: data.containerType || "N/A", icon: FileText },
                                        { label: 'Gate Cutoff', value: data.lastFreeDay ? format(new Date(data.lastFreeDay), "MMM d, yyyy") : "-", icon: Calendar },
                                        { label: 'Security Seal', value: data.sealNumber || "-", icon: Lock }
                                    ].map((field, idx) => (
                                        <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-primary/30 transition-all">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                <field.icon className="h-3 w-3" /> {field.label}
                                            </div>
                                            <div className="font-black text-slate-900">{field.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-6 border-t border-slate-100">
                                    <Button variant="outline" className="flex-1 rounded-xl font-bold py-6 border-slate-200">
                                        Add Note
                                    </Button>
                                    <Button variant="secondary" className="flex-1 rounded-xl font-bold py-6 text-red-700 bg-red-50 hover:bg-red-100 border-red-100">
                                        Flag Manual Issue
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="timeline" className="space-y-6 pt-2 pb-8">
                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex gap-3 text-xs font-medium text-slate-600">
                                    <History className="h-4 w-4 text-primary shrink-0" />
                                    <p>Chronological audit of all recognized milestones. Data is synthesized from multiple sources.</p>
                                </div>

                                <div className="flex items-center gap-4 px-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="h-2 w-2 rounded-full bg-blue-100 border border-blue-300" /> Excel Import
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="h-2 w-2 rounded-full bg-primary/20 border border-primary/40" /> AI Enriched
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="h-2 w-2 rounded-full bg-slate-200 border border-slate-300" /> System
                                    </div>
                                </div>

                                <div className="relative border-l border-slate-200 ml-5 space-y-8 pl-8 py-2">
                                    {data.events.map((event: any, idx: number) => (
                                        <div key={event.id} className="relative group">
                                            <div className={cn(
                                                "absolute -left-[41px] h-6 w-6 rounded-lg flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110",
                                                idx === 0 ? "bg-primary text-white border-primary glow-blue" : "bg-white text-slate-400 border-slate-200"
                                            )}>
                                                {idx === 0 ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                                            </div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-black text-slate-900 tracking-tight leading-none mb-1">{event.stageName}</div>
                                                    <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 mb-2">
                                                        <Cpu className="h-2.5 w-2.5" /> AI Verified
                                                    </div>
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 text-right">
                                                    {format(new Date(event.eventDateTime), "MMM d, yyyy")} <br />
                                                    {format(new Date(event.eventDateTime), "h:mm a")}
                                                </div>
                                            </div>

                                            {event.location && (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
                                                    <Globe className="h-3 w-3" /> {event.location}
                                                </div>
                                            )}
                                            {event.notes && (
                                                <div className="text-xs bg-slate-50 border border-slate-100 p-3 rounded-xl text-slate-600 font-medium leading-relaxed italic">
                                                    "{event.notes}"
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {data.events.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-3xl">
                                            No events captured yet.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="flags" className="space-y-6 pt-2 pb-8">
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-xs font-medium text-red-600">
                                    <Flag className="h-4 w-4 shrink-0" />
                                    <p>Critical operational blockers. Flags are used to halt automated workflows and require manual validation.</p>
                                </div>

                                {data.hasException ? (
                                    <div className="relative group">
                                        <div className="bg-white p-6 rounded-[2rem] border-2 border-red-100 shadow-xl shadow-red-500/5 relative z-10">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">
                                                <ShieldAlert className="h-3 w-3" /> Active Protocol Blocker
                                            </div>
                                            <h4 className="font-black text-2xl text-red-900 tracking-tight mb-2">{data.exceptionType}</h4>

                                            <div className="space-y-4 mb-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-50 rounded-lg"><User className="h-4 w-4 text-slate-400" /></div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsible Party</div>
                                                        <div className="text-sm font-bold text-slate-700">{data.exceptionOwner}</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detection Logic</div>
                                                    <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                                                        "{data.exceptionNotes || "Detected via AI Exception Classifier ruleset."}"
                                                    </p>
                                                </div>
                                            </div>

                                            <Button className="w-full h-14 bg-white hover:bg-red-50 border-2 border-red-100 text-red-700 font-black rounded-2xl shadow-sm transition-all active:scale-95">
                                                Apply Remediation & Clear
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 tracking-tight">System All-Clear</h4>
                                            <p className="text-sm text-slate-400 font-medium">No active exceptions for this identifier.</p>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="log" className="space-y-6 pt-2 pb-8">
                                <div className="p-4 bg-slate-900 text-white rounded-2xl flex gap-3 text-xs font-medium">
                                    <Lock className="h-4 w-4 shrink-0 text-primary" />
                                    <p>Immutable forensic record. Every status change, user edit, and AI proposal is audited here for regulatory compliance.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-8">
                                        {[
                                            { action: 'Container Created', actor: 'System Ingestion', time: '2h ago' },
                                            { action: 'AI Normalization Applied', actor: 'Normalizer Agent', time: '1h 58m ago' },
                                            { action: 'Exception Detected: Customs', actor: 'Classifier Agent', time: '1h 58m ago' }
                                        ].map((log, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[41px] h-6 w-6 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="text-sm font-black text-slate-900">{log.action}</div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.actor}</div>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{log.time}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                                        <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">End of Audit Trail</p>
                                        <Button variant="ghost" size="sm" className="font-black text-primary uppercase text-[10px] tracking-widest">
                                            Request Full Export
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-slate-400">Loading container data...</div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
