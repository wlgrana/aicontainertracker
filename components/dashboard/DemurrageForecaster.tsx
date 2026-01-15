
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, DollarSign, Calendar, Info, Clock, Bell, FileText, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, differenceInDays } from "date-fns";

interface DemurrageForecasterProps {
    lastFreeDay?: string | Date | null;
    demurrageRate?: number;
    currentStatus?: string;
    containerNumber: string;
}

export function DemurrageForecaster({
    lastFreeDay,
    demurrageRate = 150,
    currentStatus,
    containerNumber
}: DemurrageForecasterProps) {
    const now = new Date();
    const lfd = lastFreeDay ? new Date(lastFreeDay) : null;
    const isDelivered = ['DEL', 'RET', 'CMP'].includes(currentStatus || '');

    // determine state
    let state: 'NO_LFD' | 'DELIVERED' | 'OVERDUE' | 'ACTIVE' = 'ACTIVE';

    if (isDelivered) state = 'DELIVERED';
    else if (!lfd) state = 'NO_LFD';
    else if (lfd < now) state = 'OVERDUE';
    else state = 'ACTIVE';

    const daysUntilLFD = lfd ? differenceInDays(lfd, now) : 0;
    const daysOverdue = lfd && state === 'OVERDUE' ? differenceInDays(now, lfd) : 0;
    const currentCharges = daysOverdue > 0 ? daysOverdue * demurrageRate : 0;

    // ... (rest of logic)

    // Forecast Scenarios
    const getScenarios = () => {
        // ... (existing logic)
        if (state === 'ACTIVE' && lfd) {
            return [
                { daysAdded: 0, label: 'By Last Free Day', date: lfd, risk: 'safe' },
                { daysAdded: 3, label: '+3 Days', date: addDays(lfd, 3), risk: 'low' },
                { daysAdded: 7, label: '+7 Days', date: addDays(lfd, 7), risk: 'medium' },
                { daysAdded: 14, label: '+14 Days', date: addDays(lfd, 14), risk: 'high' }
            ];
        } else if (state === 'OVERDUE' && lfd) {
            return [
                { daysAdded: 0, label: 'Current Status', date: now, risk: 'high' },
                { daysAdded: 3, label: 'In 3 Days', date: addDays(now, 3), risk: 'high' },
                { daysAdded: 7, label: 'In 7 Days', date: addDays(now, 7), risk: 'high' },
                { daysAdded: 14, label: 'In 14 Days', date: addDays(now, 14), risk: 'critical' }
            ];
        }
        return [];
    };

    const scenarios = getScenarios();

    const getCost = (scenarioDate: Date) => {
        if (!lfd) return 0;
        const totalDays = Math.max(0, differenceInDays(scenarioDate, lfd));
        return totalDays * demurrageRate;
    };

    const getBarColor = (risk: string) => {
        // ... (existing logic)
        switch (risk) {
            case 'safe': return 'bg-emerald-500';
            case 'low': return 'bg-yellow-400';
            case 'medium': return 'bg-orange-500';
            case 'high': return 'bg-red-500';
            case 'critical': return 'bg-red-700';
            default: return 'bg-slate-200';
        }
    };

    const getProgressValue = (idx: number) => {
        // Visual scaling: 0 -> 0%, 3 -> 25%, 7 -> 50%, 14 -> 100%
        return state === 'ACTIVE' ? [5, 25, 50, 100][idx] : [25, 50, 75, 100][idx];
    };

    if (state === 'NO_LFD') {
        return (
            <Card className="rounded-[2rem] border-orange-200 bg-orange-50/30 overflow-hidden">
                <CardContent className="p-8 flex items-center gap-6">
                    <div className="h-16 w-16 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <h3 className="text-lg font-black text-orange-900 tracking-tight">Financial Exposure Unknown</h3>
                        <p className="text-sm font-medium text-orange-700/80">
                            Last Free Day data is missing. Unable to calculate demurrage risks.
                            Typical free time at this port is 5 days.
                        </p>
                    </div>
                    <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-100 font-bold">
                        Request LFD Update
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (state === 'DELIVERED') {
        // Calculate finalized charges if LFD exists
        let finalCharges = 0;
        let daysLate = 0;
        let hasFinalData = false;

        // Try to get delivery date, generic since we don't have it explicitly passed here yet, use NOW if recently delivered or implied
        // In a real scenario, we'd want the actual delivery date passed in props. 
        // For now, if we have LFD, we can estimate risk.
        if (lfd) {
            const deliveryDateEstimate = now; // Best effort without prop
            daysLate = Math.max(0, differenceInDays(deliveryDateEstimate, lfd));
            finalCharges = daysLate * demurrageRate;
            hasFinalData = true;
        }

        return (
            <Card className="rounded-[2rem] border-emerald-200 bg-emerald-50/30 overflow-hidden">
                <CardContent className="p-8 flex items-center gap-6">
                    <div className="h-16 w-16 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                        <DollarSign className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-emerald-900 tracking-tight">Delivery Complete</h3>
                            <Badge className="bg-emerald-200 text-emerald-800 border-none font-bold">DELIVERED</Badge>
                        </div>
                        <p className="text-sm font-medium text-emerald-700/80 mb-2">
                            ✅ Container Successfully Delivered
                        </p>
                        {hasFinalData ? (
                            <p className="text-sm font-medium text-emerald-700/80">
                                Total final charges: <span className="font-black">${finalCharges.toLocaleString()}</span> {daysLate > 0 && `(${daysLate} days late)`}
                            </p>
                        ) : (
                            <p className="text-sm font-medium text-emerald-700/80">
                                Final demurrage charges: <strong>Unknown</strong> (LFD missing).
                                <br />
                                <span className="text-xs opacity-75">Contact accounting for final verification if applicable.</span>
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-[2.5rem] border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden relative">
            {/* Header Section */}
            <CardHeader className={cn(
                "p-8 border-b border-slate-100 relative overflow-hidden",
                state === 'OVERDUE' ? "bg-red-50" : "bg-slate-900 text-white"
            )}>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <TrendingUp className={cn("h-6 w-6", state === 'OVERDUE' ? "text-red-500" : "text-emerald-400")} />
                            <CardTitle className={cn("text-xl font-black tracking-tight uppercase", state === 'OVERDUE' ? "text-red-900" : "text-white")}>
                                {state === 'OVERDUE' ? "Demurrage Charges Accruing" : "Financial Exposure Forecast"}
                            </CardTitle>
                        </div>
                        <p className={cn("text-sm font-bold opacity-80", state === 'OVERDUE' ? "text-red-700" : "text-slate-400")}>
                            {state === 'OVERDUE'
                                ? `CRITICAL: ${daysOverdue} days past free time expires.`
                                : `Free time expires in ${daysUntilLFD} days (${format(lfd!, 'MMM d')})`}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={cn("text-3xl font-black tracking-tighter", state === 'OVERDUE' ? "text-red-600" : "text-white")}>
                            ${currentCharges.toLocaleString()}
                        </div>
                        <div className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", state === 'OVERDUE' ? "text-red-800" : "text-slate-400")}>
                            Current Charges
                        </div>
                    </div>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none" />
            </CardHeader>

            <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                    {/* LEFT: Scenarios */}
                    <div className="col-span-2 p-8 space-y-8">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" /> Cost Projections
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Rate: ${demurrageRate}/day</span>
                        </div>

                        <div className="space-y-6">
                            {scenarios.map((scenario, idx) => {
                                const cost = getCost(scenario.date);
                                const isSafe = cost === 0;
                                return (
                                    <div key={idx} className="space-y-2 group">
                                        <div className="flex justify-between items-end text-sm">
                                            <div className="font-bold text-slate-600 group-hover:text-slate-900 transition-colors flex items-center gap-2">
                                                {scenario.label}
                                                <span className="opacity-40 font-normal ml-1">({format(scenario.date, 'MMM d')})</span>
                                                {idx === 0 && state === 'OVERDUE' && (
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 animate-pulse">
                                                        👉 YOU ARE HERE
                                                    </span>
                                                )}
                                            </div>
                                            <div className={cn(
                                                "font-black tracking-tight transition-all",
                                                isSafe ? "text-slate-400" : "text-slate-900 scale-110",
                                                state === 'OVERDUE' && "text-red-600"
                                            )}>
                                                ${cost.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000 ease-out", getBarColor(scenario.risk))}
                                                style={{ width: `${getProgressValue(idx)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-blue-800 leading-relaxed">
                                <span className="font-black">AI Insight:</span> Similar customs holds at this terminal currently average <strong>5-7 days</strong>.
                                Recommended budget exposure: <strong>${(5 * demurrageRate).toLocaleString()} - ${(7 * demurrageRate).toLocaleString()}</strong>.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="col-span-1 bg-slate-50/50 p-8 flex flex-col justify-center space-y-4">
                        <Button className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-200 text-slate-700 font-bold rounded-xl shadow-sm justify-start px-4 transition-all group">
                            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                <Mail className="h-4 w-4" />
                            </div>
                            Request Extension
                        </Button>
                        <Button className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm justify-start px-4 transition-all group">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                <FileText className="h-4 w-4" />
                            </div>
                            View Rules
                        </Button>
                        <Button className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm justify-start px-4 transition-all group">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                <Bell className="h-4 w-4" />
                            </div>
                            Set Cost Alert
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
