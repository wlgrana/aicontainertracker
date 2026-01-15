"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Ship,
    Brain,
    Zap,
    ShieldAlert,
    ChevronRight,
    CheckCircle2,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOUR_STEPS = [
    {
        title: "Welcome to AG Ops",
        description: "Your new AI-powered mission control for global shipment tracking. Let's take a 30-second tour of the command center.",
        icon: Ship,
        image: "https://images.unsplash.com/photo-1494412574005-4e1124c69e90?auto=format&fit=crop&q=80&w=800",
        benefits: ["Single source of truth", "AI-automated data entry", "Risk-based prioritization"]
    },
    {
        title: "Broadcast Ingestion",
        description: "Upload any carrier Excel manifest. Our Schema Detector identifies headers automatically, so you don't have to map columns manually anymore.",
        icon: Brain,
        benefits: ["Zero-config mapping", "Batch processing", "Audit-trailed imports"]
    },
    {
        title: "Work Queue Intelligence",
        description: "Focus only on containers that need action. The Exception Classifier flags demurrage, customs holds, and stale statuses in real-time.",
        icon: ShieldAlert,
        benefits: ["Demurrage exposure tracking", "Team-level routing", "Financial risk mitigation"]
    },
    {
        title: "Advanced Audit Trail",
        description: "Click any container to see a full immutable history. Track events from raw import to final delivery with AI verifications.",
        icon: Zap,
        benefits: ["Event timeline", "Source verification", "Remediation log"]
    }
];

export function WelcomeTour() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('ag_ops_tour_seen');
        if (!hasSeenTour) {
            setOpen(true);
        }
    }, []);

    const finishTour = () => {
        localStorage.setItem('ag_ops_tour_seen', 'true');
        setOpen(false);
    };

    const nextStep = () => {
        if (step < TOUR_STEPS.length - 1) {
            setStep(step + 1);
        } else {
            finishTour();
        }
    };

    const currentStep = TOUR_STEPS[step];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-slate-200 shadow-2xl">
                <DialogTitle className="sr-only">Welcome Tour</DialogTitle>
                <div className="flex flex-col md:flex-row h-full min-h-[500px]">
                    {/* Left: Visuals */}
                    <div className="w-full md:w-5/12 bg-slate-900 relative p-8 flex flex-col justify-between overflow-hidden">
                        <div className="relative z-10">
                            <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center glow-blue mb-6">
                                <currentStep.icon className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter leading-tight">
                                {currentStep.title}
                            </h3>
                        </div>

                        <div className="relative z-10 space-y-4">
                            {currentStep.benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                    {benefit}
                                </div>
                            ))}
                        </div>

                        {/* Background flare */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/20 blur-[60px] rounded-full" />
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 bg-indigo-500/10 blur-[50px] rounded-full" />
                    </div>

                    {/* Right: Content */}
                    <div className="w-full md:w-7/12 bg-white p-10 flex flex-col justify-between">
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Step {step + 1} of {TOUR_STEPS.length}
                                </div>
                                <button onClick={finishTour} className="text-[10px] font-black text-slate-300 hover:text-slate-600 uppercase tracking-widest transition-colors">
                                    Skip Tour
                                </button>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                                    Modernizing <span className="text-primary italic">Operations</span>
                                </h4>
                                <p className="text-slate-500 font-medium leading-relaxed">
                                    {currentStep.description}
                                </p>
                            </div>

                            <div className="flex gap-1.5">
                                {TOUR_STEPS.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "h-1 rounded-full transition-all duration-500",
                                            idx === step ? "w-8 bg-primary" : "w-4 bg-slate-100"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="mt-8">
                            <Button
                                onClick={nextStep}
                                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg group transition-all active:scale-[0.98] glow-blue"
                            >
                                {step === TOUR_STEPS.length - 1 ? "Initialize Command Center" : "Continue Mission"}
                                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
