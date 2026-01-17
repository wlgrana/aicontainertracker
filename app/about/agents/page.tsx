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
    Terminal,
    Archive,
    Languages,
    MessageSquare
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
        name: "Archivist",
        purpose: "The \"Librarian\" - Raw Ingestion & Traceability",
        icon: Archive,
        thinking: "NONE (Programmatic)",
        status: "Active & Integrated",
        gradient: "from-slate-500 to-slate-600",
        steps: [
            "Ingests raw Excel files",
            "Captures every row as-is (Zero Data Loss)",
            "Creates initial Import Log",
            "Ensures full traceability"
        ],
        prompt: `N/A - Pure TypeScript Logic.

The Archivist is a deterministic agent responsible for the raw ingestion of data. It ensures that 100% of the source data is preserved in the 'RawRow' tables before any AI processing occurs.`,
        when: "Step 1 of Import Pipeline"
    },
    {
        name: "Translator",
        purpose: "The \"Mapper\" - Schema Detection & Normalization",
        icon: Languages,
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-blue-500 to-indigo-600",
        steps: [
            "Analyzes headers to detect schema",
            "Performs complex data transformation",
            "Generates normalized Container records",
            "Derives ContainerEvent history"
        ],
        prompt: `You are the Translator Agent for a logistics shipment tracking system. Your job is to map raw Excel data to a structured database schema and generate container events.

## YOUR RESPONSIBILITIES
1. **Schema Detection**: Analyze headers to identify the data source (forwarder/carrier) and create field mappings
2. **Data Transformation**: Convert raw values to proper types (especially Excel serial dates)
3. **Event Generation**: Extract milestone events from date fields and status codes
4. **Confidence Scoring**: Rate each mapping's reliability`,
        when: "Step 2 of Import Pipeline (Batch)"
    },
    {
        name: "Auditor",
        purpose: "The \"Reconciler\" - Data Integrity Verification",
        icon: Shield,
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-emerald-500 to-teal-600",
        steps: [
            "Reviews post-persistence data",
            "Compares raw Excel vs Database",
            "Identifies lost data or mapping errors",
            "Flags logical inconsistencies"
        ],
        prompt: `You are the Auditor Agent for a logistics data system. Your job is to verify that raw import data was correctly transferred to the database.

## THE PROBLEM YOU SOLVE
The Translator creates a mapping from raw Excel fields to database columns. But sometimes:
1. Mapped fields don't actually get populated (data is LOST)
2. Date conversions go wrong (data is WRONG)
3. Valuable data has no database column (data is UNMAPPED)

You catch all of these.`,
        when: "Step 6 of Import Pipeline (Post-Persistence)"
    },
    {
        name: "Oracle Chat",
        purpose: "The \"Assistant\" - Interactive Intelligence",
        icon: BrainCircuit, // or MessageSquare
        thinking: "HIGH",
        status: "Active & Integrated",
        gradient: "from-violet-600 to-purple-600",
        steps: [
            "Answers user queries about status",
            "Provide context on data sources",
            "Executes tools (Notes, Status Updates)",
            "Proactive anomaly highlighting"
        ],
        prompt: `You are the Oracle, an intelligent logistics assistant for the Shipment Tracker system.

## YOUR CAPABILITIES
1. **Answer Questions**: Explain container status, timeline, risks, and data
2. **Provide Context**: Explain where data came from and confidence levels
3. **Execute Actions**: Use tools to modify data when requested
4. **Proactive Insights**: Highlight risks, anomalies, or items needing attention`,
        when: "On-Demand (User Interaction)"
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
