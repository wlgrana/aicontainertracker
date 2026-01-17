"use client";

import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Search,
    AlertCircle,
    CheckCircle2,
    Check,
    AlertTriangle,
    Circle,
    ArrowUpDown,
    ShieldAlert,
    Inbox
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getDirectorState } from '@/lib/agents/director';

interface ContainerInventoryProps {
    containers: any[];
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    stats?: {
        totalExceptions: number;
        inTransitCount: number;
        totalDemurrage: number;
    };
}

// 1. Status Mapping Reference
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    'RET': { label: 'RETURNED', color: 'text-emerald-600' },
    'RETURNED': { label: 'RETURNED', color: 'text-emerald-600' },
    'COMPLETED': { label: 'RETURNED', color: 'text-emerald-600' },
    'ARR': { label: 'AT PORT', color: 'text-blue-600' },
    'DISCHARGED': { label: 'AT PORT', color: 'text-blue-600' },
    'CGO': { label: 'IN TRANSIT', color: 'text-slate-500' },
    'DEP': { label: 'IN TRANSIT', color: 'text-slate-500' },
    'HSEA': { label: 'IN TRANSIT', color: 'text-slate-500' },
    'DEL': { label: 'DELIVERED', color: 'text-emerald-600' },
    'DELIVERED': { label: 'DELIVERED', color: 'text-emerald-600' },
    'BOOK': { label: 'BOOKED', color: 'text-slate-400' },
};

// --- DATA CALCULATION UTILITIES ---

const calculateRowData = (container: any) => {
    // Leverage the existing robust Director Agent logic
    const director = getDirectorState(container);

    // Determine Health Key
    let healthKey: 'CRITICAL' | 'AT_RISK' | 'WARNING' | 'ON_TRACK' | 'COMPLETE' = 'ON_TRACK';

    // 1. Prefer AI Health Score if available
    if (container.healthScore !== null && container.healthScore !== undefined) {
        if (container.healthScore < 50) healthKey = 'CRITICAL';
        else if (container.healthScore < 70) healthKey = 'AT_RISK';
        else if (container.healthScore < 90) healthKey = 'WARNING';
        else healthKey = 'ON_TRACK';
    }
    // 2. Fallback to Director Logic
    else {
        if (director.mode === 'COMPLETE') healthKey = 'COMPLETE';
        else if (director.mode === 'RISK_DETENTION') healthKey = 'CRITICAL';
        else if (director.demurrage.status === 'overdue') {
            healthKey = director.demurrage.daysOverdue > 30 ? 'CRITICAL' : 'AT_RISK';
        } else if (director.mode === 'RISK_MONITOR' || !director.lfdValid) {
            healthKey = 'WARNING'; // Close to LFD or missing LFD
        }
    }

    return {
        director,
        healthKey
    };
};

export function ContainerInventory({
    containers: initialContainers,
    totalItems,
    currentPage,
    itemsPerPage,
    onPageChange,
    stats
}: ContainerInventoryProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    // New Filters
    const [healthFilter, setHealthFilter] = useState("all");
    const [buFilter, setBuFilter] = useState("all");

    // Extract unique BUs
    const uniqueBUs = useMemo(() => {
        return Array.from(new Set(initialContainers.map(c => c.businessUnit).filter(Boolean)));
    }, [initialContainers]);

    // Metrics
    const totalContainers = totalItems;
    const totalExceptions = stats?.totalExceptions ?? initialContainers.filter(c => c.hasException).length;
    const totalDemurrage = stats?.totalDemurrage ?? initialContainers.reduce((sum, c) => sum + (c.estimatedDemurrage || 0), 0);
    const inTransitCount = stats?.inTransitCount ?? initialContainers.filter(c => ['DEP', 'HSEA', 'CGO'].includes(c.currentStatus)).length;

    // Filter Logic
    const filteredContainers = useMemo(() => {
        return initialContainers.filter(c => {
            const matchesSearch =
                c.containerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.carrier || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.currentStatus || "").toLowerCase().includes(searchQuery.toLowerCase());

            const { healthKey } = calculateRowData(c);
            const matchesHealth = healthFilter === "all" ? true : healthKey.toLowerCase() === healthFilter;
            const matchesBU = buFilter === "all" ? true : c.businessUnit === buFilter;

            return matchesSearch && matchesHealth && matchesBU;
        });
    }, [initialContainers, searchQuery, healthFilter, buFilter]);

    // Sort Logic
    const sortedContainers = useMemo(() => {
        return [...filteredContainers].sort((a, b) => {
            const dataA = calculateRowData(a);
            const dataB = calculateRowData(b);

            // Priority Map (0 is highest priority)
            const priorityMap = {
                'CRITICAL': 0,
                'AT_RISK': 1,
                'WARNING': 2,
                'ON_TRACK': 3,
                'COMPLETE': 4
            };

            const prioA = priorityMap[dataA.healthKey];
            const prioB = priorityMap[dataB.healthKey];

            if (prioA !== prioB) return prioA - prioB;

            // Secondary: Days Overdue/Left (Ascending)
            const diffA = differenceInDays(new Date(a.lastFreeDay || new Date()), new Date());
            const diffB = differenceInDays(new Date(b.lastFreeDay || new Date()), new Date());

            if (a.lastFreeDay && b.lastFreeDay && diffA !== diffB) return diffA - diffB;

            return a.containerNumber.localeCompare(b.containerNumber);
        });
    }, [filteredContainers]);

    return (
        <div className="space-y-6">
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div onClick={() => { setHealthFilter("all"); setBuFilter("all"); }} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Fleet</div>
                    <div className="text-2xl font-black text-slate-900">{totalContainers}</div>
                    <div className="text-xs font-bold text-slate-500">Containers</div>
                </div>
                <div onClick={() => setHealthFilter("critical")} className="p-4 bg-white hover:bg-red-50/50 rounded-2xl border border-slate-100 hover:border-red-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-red-600 transition-colors">Critical</div>
                    <div className="text-2xl font-black text-red-600 group-hover:scale-110 transition-transform origin-left">{totalExceptions}</div>
                    <div className="text-xs font-bold text-red-400 group-hover:text-red-500">Requires Action</div>
                </div>
                <div onClick={() => setHealthFilter("at_risk")} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-amber-500 transition-colors">Exposure</div>
                    <div className="text-2xl font-black text-slate-900">${totalDemurrage.toLocaleString()}</div>
                    <div className="text-xs font-bold text-slate-500">Total Risk</div>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">In Transit</div>
                    <div className="text-2xl font-black text-slate-900">{inTransitCount}</div>
                    <div className="text-xs font-bold text-slate-500">Active Movements</div>
                </div>
            </div>

            <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black text-slate-900">Master Inventory Ledger</CardTitle>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                Showing {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems.toLocaleString()} active assets
                            </p>
                        </div>
                        <Link href="/ingestion">
                            <Button className="rounded-xl font-black text-xs uppercase tracking-widest px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                                Import Manifest
                            </Button>
                        </Link>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex gap-4 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search containers..."
                                className="pl-9 bg-transparent border-none focus-visible:ring-0 font-medium text-sm h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-200" />
                        <Select value={buFilter} onValueChange={setBuFilter}>
                            <SelectTrigger className="w-[160px] border-none bg-transparent font-bold text-xs uppercase tracking-wide text-slate-600 shadow-none">
                                <SelectValue placeholder="Business Unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All BUs</SelectItem>
                                {uniqueBUs.map(bu => (
                                    <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={healthFilter} onValueChange={setHealthFilter}>
                            <SelectTrigger className="w-[140px] border-none bg-transparent font-bold text-xs uppercase tracking-wide text-slate-600 shadow-none">
                                <SelectValue placeholder="Health" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Health</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="at_risk">At Risk</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="on_track">On Track</SelectItem>
                                <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-white">
                            <TableRow className="hover:bg-transparent border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <TableHead className="w-[180px] pl-8">Container</TableHead>
                                <TableHead className="hidden md:table-cell">BU</TableHead>
                                <TableHead className="hidden md:table-cell">Carrier</TableHead>
                                <TableHead className="hidden md:table-cell">Status</TableHead>
                                <TableHead>ATD</TableHead>
                                <TableHead>ETA</TableHead>
                                <TableHead>LFD</TableHead>
                                <TableHead className="text-right pr-12">Days</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedContainers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Inbox className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-black text-slate-900">No containers found</h3>
                                                <p className="text-xs text-slate-500 font-medium">Try adjusting your filters or import a manifest</p>
                                            </div>
                                            <Link href="/ingestion">
                                                <Button variant="outline" size="sm" className="mt-2 text-xs font-bold border-slate-200">
                                                    Import Manifest
                                                </Button>
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedContainers.map(c => {
                                    // Use Shared logic
                                    const { director, healthKey } = calculateRowData(c);

                                    // Map Director Logic -> UI
                                    const statusDisplay = { label: director.headline, color: 'text-slate-600' };
                                    // Override simple status logic with Director's richer state if needed, 
                                    // OR keep the simple status column but rely on the health key for coloring.
                                    // Requirement is "Table Status must match Detail Page".
                                    // Detail Page uses `director.headline`. Let's use that but simplified?
                                    // Actually, standardizing on the short status code might be cleaner for the TABLE, 
                                    // but if the user wants "DETENTION ALERT", we should probably show that.
                                    // Let's stick to the mapped simple status for the 'Status' column but use Director logic for EVERYTHING else (Health, Days, Exposure).
                                    // AND if it is critical detention, we might want to override the status label column too?
                                    // Let's use the simple status map for general consistency, but if CRITICAL DETENTION, show "DETENTION ALERT".

                                    let finalStatusLabel = STATUS_MAP[(c.currentStatus || 'BOOK').toUpperCase()]?.label || c.currentStatus;
                                    let finalStatusColor = STATUS_MAP[(c.currentStatus || 'BOOK').toUpperCase()]?.color || 'text-slate-500';

                                    if (director.mode === 'RISK_DETENTION') {
                                        finalStatusLabel = 'DETENTION ALERT';
                                        finalStatusColor = 'text-red-600 font-bold';
                                    }

                                    // Render Logic
                                    const HealthIcon = healthKey === 'CRITICAL' ? AlertTriangle
                                        : healthKey === 'AT_RISK' ? Circle
                                            : healthKey === 'WARNING' ? Circle
                                                : healthKey === 'COMPLETE' ? Check
                                                    : Circle; // On Track

                                    const healthColor = healthKey === 'CRITICAL' ? 'text-red-600 animate-pulse'
                                        : healthKey === 'AT_RISK' ? 'text-red-500'
                                            : healthKey === 'WARNING' ? 'text-amber-500'
                                                : healthKey === 'COMPLETE' ? 'text-emerald-500'
                                                    : 'text-emerald-500'; // On Track key

                                    // Row Styling
                                    let rowBgClass = '';
                                    let rowBorderClass = 'border-l-[4px] border-l-transparent';

                                    if (healthKey === 'CRITICAL') {
                                        rowBgClass = 'bg-red-50/30 hover:bg-red-50/60';
                                        rowBorderClass = 'border-l-red-500';
                                    } else if (healthKey === 'AT_RISK') {
                                        rowBgClass = 'bg-red-50/20 hover:bg-red-50/40';
                                        rowBorderClass = 'border-l-red-400';
                                    } else if (healthKey === 'WARNING') {
                                        rowBgClass = 'bg-amber-50/20 hover:bg-amber-50/40';
                                        rowBorderClass = 'border-l-amber-400';
                                    } else if (healthKey === 'COMPLETE') {
                                        rowBgClass = 'bg-emerald-50/20 hover:bg-emerald-50/40';
                                        rowBorderClass = 'border-l-emerald-500';
                                    } else {
                                        // On Track
                                        rowBgClass = 'hover:bg-slate-50';
                                    }

                                    return (
                                        <TableRow
                                            key={c.containerNumber}
                                            className={cn(
                                                "cursor-pointer transition-all border-slate-100 group h-14 hover:shadow-sm",
                                                rowBgClass,
                                                rowBorderClass
                                            )}
                                            onClick={() => router.push(`/container/${c.containerNumber}`)}
                                        >
                                            <TableCell className="pl-8 font-black text-sm text-slate-900">
                                                {c.containerNumber}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                {c.businessUnit ? (
                                                    c.businessUnit
                                                ) : (
                                                    <span className="text-slate-400 italic">Unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell font-bold text-xs text-slate-600">
                                                {c.carrier || "—"}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {c.aiOperationalStatus ? (
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest",
                                                            c.aiAttentionCategory === 'CRITICAL' ? 'text-red-600' :
                                                                c.aiAttentionCategory === 'HIGH' ? 'text-amber-500' :
                                                                    c.aiOperationalStatus === 'IN_TRANSIT' ? 'text-slate-600' :
                                                                        'text-blue-600'
                                                        )}>
                                                            {c.aiOperationalStatus.replace('_', ' ')}
                                                        </span>

                                                    </div>
                                                ) : (
                                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", finalStatusColor)}>
                                                        {finalStatusLabel}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">
                                                {c.atd ? format(new Date(c.atd), 'yyyy-MM-dd') : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">
                                                {c.eta ? format(new Date(c.eta), 'yyyy-MM-dd') : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">
                                                {c.lastFreeDay ? format(new Date(c.lastFreeDay), 'yyyy-MM-dd') : '—'}
                                            </TableCell>
                                            <TableCell className="text-right pr-12 text-xs font-bold text-slate-900">
                                                {c.daysInTransit ?? '—'}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>

                {/* Pagination Footer */}
                <div className="bg-slate-50/50 border-t border-slate-100 px-8 py-4 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500">
                        Page {currentPage} of {Math.ceil(totalItems / itemsPerPage)}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="text-xs font-bold border-slate-200"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage * itemsPerPage >= totalItems}
                            className="text-xs font-bold border-slate-200"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
