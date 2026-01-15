"use client";

import React from 'react';
import {
    AlertTriangle,
    BarChart3,
    ArrowRight
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const exceptionMatrix = [
    {
        title: "Customs Hold",
        label: "Priority High",
        color: "bg-red-100 text-red-700 border-red-200",
        iconColor: "text-red-500",
        owner: "Freight Team",
        rule: "Status is 'CUS' for > 5 business days",
        action: "Coordinate with broker for release docs",
        clears: "Next movement status"
    },
    {
        title: "Demurrage Risk",
        label: "Financial Case",
        color: "bg-orange-100 text-orange-700 border-orange-200",
        iconColor: "text-orange-500",
        owner: "Distribution",
        rule: "Free time expires in < 48 hours",
        action: "Escalate for immediate pickup scheduling",
        clears: "Empty return confirmed"
    },
    {
        title: "Payment Hold",
        label: "Compliance",
        color: "bg-amber-100 text-amber-700 border-amber-200",
        iconColor: "text-amber-500",
        owner: "Accounts Payable",
        rule: "B/L status is NOT 'Surrendered'",
        action: "Obtain release authorization from carrier",
        clears: "B/L Status Update"
    },
    {
        title: "Stale Status",
        label: "Audit",
        color: "bg-slate-100 text-slate-700 border-slate-200",
        iconColor: "text-slate-500",
        owner: "Freight Team",
        rule: "No tracking update for > 72 hours",
        action: "Request update via Carrier Portals",
        clears: "Any new activity"
    }
];

export default function ExceptionsPage() {
    return (
        <div className="p-10 space-y-12 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="space-y-4">
                <Badge className="bg-red-50 text-red-600 border-red-100 uppercase tracking-widest px-4 py-1">
                    Risk Management
                </Badge>
                <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    Exception <span className="text-red-500 italic">Matrix</span>
                </h1>
                <p className="text-slate-500 text-xl leading-relaxed font-medium max-w-2xl">
                    Automated rules that flag risks before they become costs.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                {exceptionMatrix.map((exc, idx) => (
                    <Card key={idx} className="border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all">
                        <CardContent className="p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <Badge className={`${exc.color} font-black uppercase tracking-widest rounded-lg px-3 py-1`}>
                                    {exc.label}
                                </Badge>
                                <AlertTriangle className={`h-6 w-6 ${exc.iconColor}`} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900">{exc.title}</h3>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controller: <span className="text-slate-700">{exc.owner}</span></div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trigger Rule</div>
                                    <p className="text-sm font-bold text-slate-700 leading-tight italic">"{exc.rule}"</p>
                                </div>
                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Action Protocol</div>
                                    <p className="text-sm font-bold text-slate-700">{exc.action}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Auto-Clears: {exc.clears}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="p-10 bg-white border border-slate-200 rounded-[2.5rem] flex items-center justify-between shadow-sm">
                <div className="max-w-xl space-y-4">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Automatic Remediation</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">
                        Most exceptions are synchronized with the live tracking feed. When the underlying
                        data advances (e.g., a container moves past Customs), the exception will
                        automatically clear from your work queue.
                    </p>
                    <button className="flex items-center gap-2 text-primary font-black uppercase text-sm tracking-widest group">
                        Learn about manual clearing <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
                <BarChart3 className="h-48 w-48 text-slate-100" />
            </div>
        </div>
    );
}
