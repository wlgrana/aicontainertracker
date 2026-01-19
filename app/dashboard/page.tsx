"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManualContainerForm } from "@/components/shipment/ContainerForm";
import { ManualShipmentForm } from "@/components/shipment/ShipmentForm";
import { ContainerInventory } from "@/components/dashboard/ContainerInventory";
import { getDashboardData } from "../actions/entry/actions";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    AlertCircle,
    CheckCircle2,
    Package,
    Search,
    Bell
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { Suspense } from "react";

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Sync state with URL ?tab= parameter
    const defaultTab = searchParams.get('tab') || 'containers';

    // Pagination State
    const pageParam = searchParams.get('page');
    const currentPage = pageParam ? parseInt(pageParam, 10) : 1;
    const itemsPerPage = 50;

    const [activeTab, setActiveTab] = useState(defaultTab);

    // Filters
    const [forwarderFilter, setForwarderFilter] = useState("");
    const [buFilter, setBuFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("in_transit");

    const [data, setData] = useState<{
        attention: any[];
        containers: any[];
        totalCount: number;
        stats?: {
            totalExceptions: number;
            inTransitCount: number;
            totalDemurrage: number;
        }
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    // Reset page when filters change (Optional but good UX)
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (params.get('page') !== '1') {
            // We can't easily atomically reset page and fetch here without causing loops or two fetches.
            // For now, let's just fetch. If page is out of range, result will be empty.
            // Ideally update URL to page 1.
        }
    }, [forwarderFilter, buFilter, statusFilter]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch data for the current page
                const result = await getDashboardData(currentPage, itemsPerPage, "", statusFilter, forwarderFilter, buFilter);
                // Ensure default structure if result is null/undefined to prevent crashes
                setData(result || { attention: [], containers: [], totalCount: 0 });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(load, 300); // 300ms debounce for text inputs
        return () => clearTimeout(timer);
    }, [currentPage, statusFilter, forwarderFilter, buFilter]); // Re-fetch on any change

    const handleNavChange = (tab: string) => {
        setActiveTab(tab);
        // Reset to page 1 when switching tabs if needed, or keep current
        router.push(`/dashboard?tab=${tab}&page=1`, { scroll: false });
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        router.push(`/dashboard?${params.toString()}`);
    };

    // Only show full page loader on INITIAL load when we have no data at all
    if (!data) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 bg-slate-200 rounded-full" />
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                </div>
            </div>
        );
    }

    const { attention, containers, totalCount, stats } = data;
    const attentionCount = stats?.totalExceptions ?? attention.length;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 font-sans w-full">
            {/* Global Header */}
            <header className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        {activeTab === 'attention' && "Action Items"}
                        {activeTab === 'containers' && "All Containers"}
                        {activeTab === 'manual' && "Data Entry / Override"}
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                        {activeTab === 'attention' && (attentionCount > 0 ? "Critical exceptions require immediate resolution." : "Fleet is operating within normal parameters.")}
                        {activeTab === 'containers' && `${totalCount.toLocaleString()} containers monitored • ${attentionCount} need${attentionCount === 1 ? 's' : ''} attention • Page ${currentPage}`}
                        {activeTab === 'manual' && "Manual tools for system overrides and adjustments."}
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-6 pr-6 border-r border-slate-100">
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Exceptions</div>
                            <div className={cn("text-lg font-black uppercase tracking-tight", attentionCount > 0 ? "text-red-500" : "text-emerald-500")}>
                                {attentionCount} Active
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demurrage Exposure</div>
                            <div className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                {stats && stats.totalDemurrage > 0 ? `$${stats.totalDemurrage.toLocaleString()}` : "$0"}
                            </div>
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
                        <Bell className="h-5 w-5 text-slate-500" />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-8 scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-8 pb-12">

                    {/* VIEW: Action Items */}
                    {activeTab === 'attention' && (
                        <>
                            {attentionCount > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {attention.map((item: any) => (
                                        <Card key={item.containerNumber} className="group overflow-hidden border-slate-200 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 rounded-3xl cursor-pointer" onClick={() => router.push(`/container/${item.containerNumber}`)}>
                                            <div className="h-2 bg-gradient-to-r from-primary to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                            {item.carrier || 'Global Carrier'}
                                                        </div>
                                                        <div className="font-black text-2xl text-slate-900 group-hover:text-primary transition-colors">{item.containerNumber}</div>
                                                    </div>
                                                    <Badge className="bg-red-50 text-red-700 border-red-100 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase">{item.currentStatus}</Badge>
                                                </div>

                                                <div className="space-y-4">
                                                    {item.exceptionType && (
                                                        <div className="p-3 bg-red-600 rounded-xl text-white shadow-xl shadow-red-500/20">
                                                            <div className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Critical Blocker</div>
                                                            <div className="font-bold text-sm tracking-tight">{item.exceptionType}</div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Update</div>
                                                            <div className="text-xs font-bold text-slate-700">{item.daysAtStage}d ago</div>
                                                        </div>
                                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Demurrage</div>
                                                            <div className="text-xs font-bold text-slate-700">{item.daysOverFree > 0 ? `${item.daysOverFree}d Over` : "Safe"}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[500px] text-center bg-white border border-slate-100 rounded-[2.5rem] shadow-sm animate-in fade-in duration-700">
                                    <div className="p-8 bg-emerald-50 rounded-full mb-6 glow-blue animate-bounce">
                                        <CheckCircle2 className="h-20 w-20 text-emerald-500" />
                                    </div>
                                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Transmission All-Clear</h3>
                                    <p className="text-slate-500 max-w-lg mx-auto font-medium text-lg leading-relaxed">
                                        No critical exceptions detected. Your fleet is operating optimally.
                                    </p>
                                    <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 max-w-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">System Status</p>
                                        <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                                            <span>Pipeline Latency</span>
                                            <span className="text-emerald-500">24ms (Optimal)</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-10">
                                        <Button onClick={() => handleNavChange('containers')} className="px-8 py-6 h-auto bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all hover:scale-105">
                                            View All Shipments
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* VIEW: All Shipments */}
                    {activeTab === 'containers' && (
                        <>


                            <ContainerInventory
                                containers={containers}
                                totalItems={totalCount}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onPageChange={handlePageChange}
                                stats={stats}
                            />
                        </>
                    )}

                    {/* VIEW: Data Entry */}
                    {activeTab === 'manual' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="p-8 rounded-[2.5rem] border-slate-200">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle className="text-xl font-black text-slate-900">Manual Override</CardTitle>
                                    <p className="text-sm font-medium text-slate-500">Inject single container data directly.</p>
                                </CardHeader>
                                <ManualContainerForm />
                            </Card>
                            <Card className="p-8 rounded-[2.5rem] border-slate-200">
                                <CardHeader className="p-0 mb-6">
                                    <CardTitle className="text-xl font-black text-slate-900">Create Shipment Mission</CardTitle>
                                    <p className="text-sm font-medium text-slate-500">Initialize new commercial shipment profile.</p>
                                </CardHeader>
                                <ManualShipmentForm />
                            </Card>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 bg-slate-200 rounded-full" />
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                </div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
