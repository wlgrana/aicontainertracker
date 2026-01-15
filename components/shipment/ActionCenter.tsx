
import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Anchor, FileText, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
    id: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
    icon: any;
}

interface ActionCenterProps {
    data: any;
    onAddLfd: () => void;
    onAddVessel: () => void;
    onAddData: () => void;
    mode: string; // Add mode prop for strict filtering
}

export function ActionCenter({ data, onAddLfd, onAddVessel, onAddData, mode }: ActionCenterProps) {
    const actions: ActionItem[] = [];

    // Status Logic
    const isDelivered = ['DEL', 'DELIVERED', 'COMPLETED', 'RET', 'RETURNED'].includes(data.currentStatus || '');

    // Strict Mode Filtering from Director
    // If mode is TRANSIT, RISK_MONITOR, ACTIVE, or COMPLETE, suppress 'Assign Vessel'
    const isPastBooking = ['TRANSIT', 'RISK_MONITOR', 'ACTIVE', 'COMPLETE', 'RISK_DETENTION'].includes(mode);

    // Logic for generating actions

    // 1. Missing LFD (Critical for Risk Monitor)
    if (!data.lastFreeDay && !isDelivered && !data.emptyReturnDate) {
        actions.push({
            id: 'missing-lfd',
            priority: 'CRITICAL',
            title: 'Add Last Free Day',
            description: 'Cannot calculate demurrage risk without LFD.',
            actionLabel: 'Add LFD Now',
            onAction: onAddLfd,
            icon: Clock
        });
    }

    // 2. Missing Vessel (Strictly suppressed if past booking)
    if (!data.currentVessel && !isPastBooking && !isDelivered) {
        actions.push({
            id: 'missing-vessel',
            priority: 'HIGH',
            title: 'Assign Vessel',
            description: 'Missing vessel assignment may delay clearance tracking.',
            actionLabel: 'Check Carrier Portal',
            onAction: onAddVessel,
            icon: Anchor
        });
    }

    // 3. Missing Data (General fields)
    const missingFields = [
        !data.pol, !data.pod, !data.etd, !data.eta, !data.carrier
    ].filter(Boolean).length;

    // Suppress general data alerts if past booking or delivered
    if (missingFields > 0 && !isDelivered && !isPastBooking) {
        actions.push({
            id: 'missing-data',
            priority: 'MEDIUM',
            title: `Complete missing data (${missingFields} fields)`,
            description: 'Origin Port, Destination Port, Departure/Arrival Dates.',
            actionLabel: 'Add Missing Data',
            onAction: onAddData,
            icon: FileText
        });
    }

    if (actions.length === 0) return null;

    return (
        <div className="w-full bg-white rounded-3xl border-2 border-indigo-100 overflow-hidden shadow-lg mb-8">
            <div className="bg-indigo-50/50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-red-500 text-white p-1 rounded-md">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <h3 className="font-black text-indigo-900 tracking-tight text-lg">REQUIRED ACTIONS</h3>
                </div>
                <div className="text-xs font-bold text-indigo-400 bg-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    {actions.length} Pending
                </div>
            </div>

            <div className="divide-y divide-indigo-50">
                {actions.map((action) => (
                    <div key={action.id} className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-colors group">
                        <div className={cn(
                            "p-3 rounded-xl shrink-0",
                            action.priority === 'CRITICAL' ? "bg-red-50 text-red-600" :
                                action.priority === 'HIGH' ? "bg-orange-50 text-orange-600" :
                                    "bg-blue-50 text-blue-600"
                        )}>
                            <action.icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                    action.priority === 'CRITICAL' ? "bg-red-100 text-red-700 border-red-200" :
                                        action.priority === 'HIGH' ? "bg-orange-100 text-orange-700 border-orange-200" :
                                            "bg-blue-100 text-blue-700 border-blue-200"
                                )}>
                                    {action.priority}
                                </span>
                                <h4 className="font-bold text-slate-800 text-sm">{action.title}</h4>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mb-3">
                                {action.description}
                            </p>
                            <Button
                                size="sm"
                                onClick={action.onAction}
                                className={cn(
                                    "font-bold text-xs h-8",
                                    action.priority === 'CRITICAL' ? "bg-red-600 hover:bg-red-700 text-white" :
                                        "bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200"
                                )}
                            >
                                {action.actionLabel}
                                <ArrowRight className="ml-2 h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
