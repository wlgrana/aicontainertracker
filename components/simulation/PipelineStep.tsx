import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineStepProps {
    title: string;
    description?: string;
    state: 'active' | 'complete' | 'pending';
    icon: React.ReactNode;
    data?: any;
    renderDetails?: (data: any) => React.ReactNode;
    isLast?: boolean;
    timestamp?: number;
    duration?: number;
    stepNumber?: number; // Optional, wasn't explicitly used in original but helpful
}

export function PipelineStep({ title, description, state, icon, data, renderDetails, isLast, timestamp, duration }: PipelineStepProps) {
    const isActive = state === 'active';
    const isComplete = state === 'complete';
    const isPending = state === 'pending';

    return (
        <div className={cn("relative pl-12 transition-all duration-500", isPending && "opacity-50 grayscale")}>
            {!isLast && (<div className={cn("absolute left-[22px] top-12 bottom-[-24px] w-0.5 z-0", isComplete ? "bg-green-500" : "bg-slate-200")} />)}
            <div className={cn("absolute left-0 top-0 w-11 h-11 rounded-full border-4 flex items-center justify-center z-10 bg-white transition-all duration-500", isActive ? "border-blue-500 text-blue-600 scale-110 shadow-lg shadow-blue-200" : isComplete ? "border-green-500 text-green-600" : "border-slate-200 text-slate-400")}>
                {isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : (isComplete ? <CheckCircle2 className="w-5 h-5" /> : icon)}
            </div>
            <Card className={cn("border transition-all duration-300", isActive ? "ring-2 ring-blue-500 shadow-lg border-transparent" : "border-slate-200")}>
                <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className={cn("font-bold text-lg", isActive ? "text-blue-700" : "text-slate-800")}>{title}</h3>
                                {(isComplete && timestamp) && (
                                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        Completed • {new Date(timestamp).toLocaleTimeString()} • {duration ? (duration / 1000).toFixed(1) + 's' : ''}
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-500 text-sm">{description}</p>
                        </div>
                        {isActive && <Badge className="bg-blue-100 text-blue-700 animate-pulse">Running</Badge>}
                        {isComplete && <Badge className="bg-green-100 text-green-700">Completed</Badge>}
                    </div>
                    {(isActive || isComplete) && data && (<div className="animate-in slide-in-from-top-2 fade-in duration-500">{renderDetails ? renderDetails(data) : null}</div>)}
                </CardContent>
            </Card>
        </div>
    );
}
