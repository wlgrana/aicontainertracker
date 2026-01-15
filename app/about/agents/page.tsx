"use client";

import React, { useState } from 'react';
import {
    Microscope,
    Cpu,
    Target,
    Shield,
    CheckCircle,
    BrainCircuit,
    FileSearch,
    Code,
    Terminal
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const aiAgents = [
    {
        name: "Schema Detector",
        purpose: "Identifies column layouts & unmapped data",
        icon: Microscope,
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-blue-500 to-indigo-600",
        steps: [
            "Analyzes raw Excel headers",
            "Identifies Carrier/Forwarder identity",
            "Maps columns to canonical schema",
            "Proposes meaning for unmapped fields"
        ],
        prompt: `You are a logistics data expert. Analyze these Excel headers and sample rows to create a schema mapping.

HEADERS: [...]
SAMPLE DATA: [...]
CANONICAL FIELDS: shipment_reference, container_number, ...

Your Goal:
1. Identify the Carrier or Forwarder if possible.
2. Map the provided HEADERS to the CANONICAL FIELDS.
3. IMPORTANT: For EVERY header that CANNOT be mapped to a canonical field, you MUST provide an "unmappedField" analysis.

For Unmapped Fields, analyze:
- potentialMeaning: A clear description of field context
- suggestedCanonicalField: A camelCase field name
- confidenceScore: How confident you are (0-1.0)
- dataType: string, number, date, currency`,
        when: "Runs continuously during file ingestion"
    },
    {
        name: "Data Normalizer",
        purpose: "Standardizes carrier events & statuses",
        icon: Cpu,
        thinking: "LOW",
        status: "Active & Integrated",
        gradient: "from-emerald-500 to-teal-600",
        steps: [
            "Normalizes status raw text to codes",
            "Aligns ISO timestamps",
            "Cleanses container numbers",
            "Validates numeric occurrences"
        ],
        prompt: `Map this logistics status text "\${status}" to EXACTLY one of these standard codes:
BOOK, CEP, CGI, STUF, LOA, DEP, TS1, TSD, TSL, TS1D,
ARR, DIS, INSP, CUS, REL, AVL, CGO, OFD, DEL, STRP, RET.

Return ONLY the code.`,
        when: "Executes per-row during processing"
    },
    {
        name: "Exception Classifier",
        purpose: "Flags operational risks & anomalies",
        icon: Target,
        thinking: "MEDIUM",
        status: "Active & Integrated",
        gradient: "from-amber-500 to-orange-600",
        steps: [
            "Detects incorrect status sequences",
            "Identifies missing ETAs when ETD passed",
            "Flag's unusual delays at specific stages",
            "Assigns ownership (Freight vs Distribution)"
        ],
        prompt: `Analyze this container data for any operational exceptions or anomalies:
CONTAINER: {...}
NOW: 2024-03-20T10:00:00Z

Look for:
- Incorrect status sequences
- Missing ETA when ETD passed
- Unusual delays at any stage

Return ONLY a JSON object:
{ "isException": boolean, "type": "string", "owner": "string", "reason": "string" }`,
        when: "Daily 6AM sync + Post-Import"
    },
    {
        name: "Mission Oracle (Container)",
        purpose: "Risk Assessment & Future Prediction",
        icon: BrainCircuit,
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-violet-600 to-purple-600",
        steps: [
            "Calculates 0-100 Risk Score",
            "Predicts next 24-48h outcomes",
            "Audits data integrity (Warning vs Critical)",
            "Synthesizes unmapped data insights"
        ],
        prompt: `You are the "Mission Oracle", an advanced logistics risk engine.
Analyze this container shipment.

STRUCTURED DATA: {...}
UNMAPPED / AI-INFERRED DATA: {...}

TASK:
1. Assess the risk level (0-100) and identify key risk factors.
   CRITICAL RULE: If status is 'DEL', 'DELIVERED', or 'COMPLETED', Risk Score MUST be 0-10.
2. Check for discrepancies between structured data and inferred data.
3. Generate a "Prediction" for the next 24-48 hours.
4. Generate a "Projected Outcome" (Final delivery success/delay).
5. PERFORM A DATA INTEGRITY AUDIT (Check for logical inconsistencies).`,
        when: "On-Demand (User Request) + Batch Analysis"
    },
    {
        name: "Mission Oracle (Import)",
        purpose: "Batch Intelligence & Financial Summary",
        icon: FileSearch,
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-pink-500 to-rose-600",
        steps: [
            "Aggregates financial exposure (Demurrage)",
            "Detects batch-wide anomalies",
            "Scored Data Quality & Completeness",
            "Identifies systemic carrier issues"
        ],
        prompt: `You are Mission Oracle, an AI logistics intelligence analyst.

IMPORT SUMMARY:
- File: ...
- Containers: ... (Demurrage Risk, Customs Holds, etc.)
- Financial Data (Avg Freight, Outliers)

YOUR TASK:
Analyze this data and provide actionable intelligence. Focus on:
1. What needs URGENT attention
2. Financial anomalies that need verification
3. Data quality issues affecting operations
4. Operational patterns and insights`,
        when: "Triggered upon Import Completion"
    }
];

export default function AgentsPage() {
    return (
        <div className="p-10 space-y-12 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="space-y-4">
                <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest px-4 py-1">
                    System Intelligence
                </Badge>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                            AI Agent <span className="text-primary italic">Manifest</span>
                        </h1>
                        <p className="text-slate-500 text-xl leading-relaxed font-medium max-w-2xl mt-2">
                            A transparent view of the autonomous agents powering your logistics intelligence.
                            Status: <span className="text-emerald-600 font-bold">Active & Fully Integrated</span>.
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {aiAgents.map((agent, idx) => (
                    <Card key={idx} className="group flex flex-col overflow-hidden border-slate-200 rounded-[2.5rem] shadow-sm hover:border-primary/50 hover:shadow-2xl transition-all duration-500">
                        <div className={`h-2 text-white bg-gradient-to-r ${agent.gradient}`} />
                        <CardHeader className="p-8 pb-0 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-2xl bg-gradient-to-br ${agent.gradient} text-white glow-blue shadow-lg`}>
                                    <agent.icon className="h-8 w-8" />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant="outline" className="rounded-lg font-black uppercase tracking-widest px-3 py-1 bg-white">
                                        {agent.thinking} THINK
                                    </Badge>
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] uppercase font-bold px-2">
                                        Active
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">
                                    {agent.name}
                                </CardTitle>
                                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
                                    {agent.purpose}
                                </p>
                            </div>
                        </CardHeader>

                        <CardContent className="p-8 space-y-6 flex-grow">
                            <div className="space-y-3">
                                {agent.steps.map((step, sIdx) => (
                                    <div key={sIdx} className="flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-slate-400 mt-0.5">
                                            {sIdx + 1}
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 leading-tight">
                                            {step}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Terminal className="h-3 w-3" />
                                    Execution Trigger
                                </div>
                                <p className="text-sm font-bold text-slate-700">{agent.when}</p>
                            </div>
                        </CardContent>

                        <CardFooter className="p-8 pt-0">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full rounded-xl border-slate-200 hover:bg-slate-50 hover:text-primary font-bold transition-all group-hover:border-primary/30">
                                        <Code className="mr-2 h-4 w-4" />
                                        View System Prompt
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-3 text-2xl">
                                            <agent.icon className="h-6 w-6 text-primary" />
                                            {agent.name} <span className="text-slate-400 font-normal">System Prompt</span>
                                        </DialogTitle>
                                        <DialogDescription>
                                            The actual recursive instruction set driving this agent.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-grow mt-4 rounded-xl border bg-slate-950 p-6">
                                        <pre className="text-xs md:text-sm font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                                            {agent.prompt}
                                        </pre>
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="p-8 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between glow-blue relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20" />
                <div className="flex items-center gap-6 relative z-10">
                    <div className="p-4 bg-primary rounded-2xl shadow-xl shadow-primary/20">
                        <Shield className="h-8 w-8" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black tracking-tight">Adaptive Learning Matrix</h4>
                        <p className="text-slate-400 font-medium max-w-xl">
                            Confirmed mappings are automatically cached via <code>CarrierFormat</code> registry for zero-latency detection on subsequent uploads of the same layout.
                        </p>
                    </div>
                </div>
                <CheckCircle className="h-12 w-12 text-primary opacity-50 relative z-10 hidden md:block" />
            </div>
        </div>
    );
}
