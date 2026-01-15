"use client";

import React from 'react';
import {
    FileUp,
    Brain,
    Zap,
    AlertTriangle,
    CheckCircle,
    Network
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function AboutPage() {
    return (
        <div className="p-10 space-y-12 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HERO SECTION */}
            <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-16 text-white shadow-2xl glow-blue">
                <div className="relative z-10 max-w-3xl space-y-6">
                    <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest px-4 py-1">
                        System Architecture
                    </Badge>
                    <h1 className="text-6xl font-black tracking-tighter leading-none">
                        How FBG Tracker <span className="text-primary italic">Works</span>
                    </h1>
                    <p className="text-slate-400 text-xl leading-relaxed font-medium">
                        Understand the AI-powered intelligence engine that transforms
                        fragmented carrier data into a high-fidelity operational command center.
                    </p>
                </div>
                {/* Abstract Visuals */}
                <div className="absolute top-0 right-0 -mr-24 -mt-24 w-log h-96 bg-primary/20 blur-[130px] rounded-full" />
                <Network className="absolute right-12 bottom-12 h-64 w-64 text-white/5 rotate-12" />
            </header>

            <div className="space-y-12">
                <div className="relative space-y-8">
                    {/* Vertical line connector */}
                    <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-indigo-200 to-transparent rounded-full hidden md:block" />

                    {processSteps.map((step, idx) => (
                        <div key={idx} className="relative flex items-start gap-10 group">
                            <div className="z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-white border-4 border-slate-50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                                <step.icon className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1 space-y-4 pb-12">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-primary uppercase tracking-widest">Step {idx + 1}: {step.label}</h3>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{step.title}</h2>
                                </div>
                                <p className="text-slate-500 text-lg leading-relaxed max-w-3xl font-medium">
                                    {step.description}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                                    {step.details.map((detail, dIdx) => (
                                        <div key={dIdx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 text-sm">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            {detail}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-[2rem] flex items-center gap-6 glow-blue">
                    <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <Zap className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Typical Processing Latency</h4>
                        <div className="flex gap-8 mt-2">
                            <div className="text-sm font-bold text-slate-500">
                                Known Formats (Maersk, MSC): <span className="text-primary">2-5 seconds</span>
                            </div>
                            <div className="text-sm font-bold text-slate-500">
                                Unknown AI Analysis: <span className="text-primary">10-15 seconds</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const processSteps = [
    {
        label: "Ingestion",
        title: "Submit Carrier Manifests",
        icon: FileUp,
        description: "Submit raw carrier Excel outputs directly into the hub. Our system ingest .xlsx and .xls formats with deep-parsing support for high-volume logs.",
        details: [
            "Accepts up to 50MB files",
            "Parallel batch uploads",
            "Secure encrypted storage",
            "Historical audit trails"
        ]
    },
    {
        label: "Extraction",
        title: "AI Header Synthesis",
        icon: Brain,
        description: "The Schema Detector agent analyzes column structures to find container numbers, events, and timestamps, regardless of the carrier's proprietary format.",
        details: [
            "Instant known format matching",
            "Gemini-powered AI analysis",
            "Confidence-based verification",
            "Global header mapping cache"
        ]
    },
    {
        label: "Translation",
        title: "Data Normalization Feed",
        icon: Zap,
        description: "Non-standard status codes (e.g., 'GATE OUT' vs 'DRAYAGE START') are mapped to a universal Logistics Schema for consistent cross-fleet reporting.",
        details: [
            "ISO Timestamp conversion",
            "Stage code standardized",
            "ISO Container validation",
            "High-speed batch processing"
        ]
    },
    {
        label: "Detection",
        title: "Exception Mining",
        icon: AlertTriangle,
        description: "The Classifier agent scans the heartbeat of your inventory to find containers stuck at port, incurring demurrage, or missing critical documents.",
        details: [
            "Financial risk calculation",
            "Customs hold monitoring",
            "Stale status flagging",
            "Cross-team routing"
        ]
    },
    {
        label: "Operation",
        title: "Work Queue Allocation",
        icon: CheckCircle,
        description: "Actionable intelligence is delivered to the Work Queue, prioritized by financial impact and operational urgency for your teams.",
        details: [
            "Prioritized by dollar risk",
            "Team-specific grouping",
            "Timeline drill-down",
            "Direct action protocols"
        ]
    }
];
