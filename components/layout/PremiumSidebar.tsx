"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    Truck,
    LayoutDashboard,
    Package,
    FileEdit,
    ShieldAlert,
    Info,
    UploadCloud,
    Bot,
    AlertTriangle,
    Clock
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PremiumSidebarProps {
    attentionCount?: number;
}

export function PremiumSidebar({ attentionCount = 0 }: PremiumSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');

    // Helper to check active state including query params for dashboard tabs
    const isActive = (path: string, tab?: string) => {
        if (path === '/dashboard') {
            if (pathname !== '/dashboard') return false;
            // If no tab is specified, default to 'containers' (All Shipments)
            if (!tab && (!currentTab || currentTab === 'containers')) return true;
            return currentTab === tab;
        }
        return pathname === path;
    };

    return (
        <aside className="w-72 bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 h-screen sticky top-0">
            <div className="p-8 pb-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center transform rotate-3">
                        <Truck className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-xl font-black tracking-tight italic">FBG <span className="text-blue-500">Container Tracker</span></h1>
                </div>
            </div>

            <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2">Operational Cockpit</div>

                {/* All Shipments */}
                <Link href="/dashboard?tab=containers" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/dashboard', 'containers')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <Package className={cn("h-5 w-5", isActive('/dashboard', 'containers') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">All Containers</span>
                        </div>
                    </div>
                </Link>

                {/* Action Items - HIDDEN 
                <Link href="/dashboard?tab=attention" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/dashboard', 'attention')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <AlertCircle className={cn("h-5 w-5", isActive('/dashboard', 'attention') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">Action Items</span>
                        </div>
                        {attentionCount > 0 ? (
                            <Badge className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 border-none animate-pulse">
                                {attentionCount}
                            </Badge>
                        ) : (
                            <Badge className={cn("text-[10px] font-black px-2 py-0.5 border-none", isActive('/dashboard', 'attention') ? "bg-blue-700 text-blue-200" : "bg-slate-800 text-slate-500")}>
                                0
                            </Badge>
                        )}
                    </div>
                </Link>
                */}

                {/* Import Manifest (Ingestion) */}
                <Link href="/ingestion" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/ingestion')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <UploadCloud className={cn("h-5 w-5", isActive('/ingestion') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">Import Manifest</span>
                        </div>
                    </div>
                </Link>

                {/* Import History */}
                <Link href="/import-history" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/import-history')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <Clock className={cn("h-5 w-5", isActive('/import-history') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">Import History</span>
                        </div>
                    </div>
                </Link>

                {/* Data Entry (Manual) - HIDDEN
                <Link href="/dashboard?tab=manual" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/dashboard', 'manual')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <LayoutDashboard className={cn("h-5 w-5", isActive('/dashboard', 'manual') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">Data Entry</span>
                        </div>
                    </div>
                </Link>
                */}

                <div className="mt-6 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2">System</div>

                {/* About / Help */}
                <Link href="/about" className="block w-full">
                    <div className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl flex items-center justify-between group transition-all duration-200",
                        isActive('/about')
                            ? "bg-blue-600 shadow-lg shadow-blue-900/50 text-white"
                            : "hover:bg-white/5 text-slate-400 hover:text-white"
                    )}>
                        <div className="flex items-center gap-3">
                            <Info className={cn("h-5 w-5", isActive('/about') ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-bold text-sm tracking-wide">About / Help</span>
                        </div>
                    </div>
                </Link>

                <div className="pl-4 space-y-1 mt-2">
                    <Link href="/about/agents" className="block w-full">
                        <div className={cn(
                            "w-full text-left px-5 py-3 rounded-xl flex items-center justify-between group transition-all duration-200",
                            isActive('/about/agents')
                                ? "bg-white/10 text-white"
                                : "hover:bg-white/5 text-slate-500 hover:text-white"
                        )}>
                            <div className="flex items-center gap-3">
                                <Bot className={cn("h-4 w-4", isActive('/about/agents') ? "text-blue-400" : "text-slate-600 group-hover:text-blue-400")} />
                                <span className="font-semibold text-xs tracking-wide">AI Agents</span>
                            </div>
                        </div>
                    </Link>

                    <Link href="/about/exceptions" className="block w-full">
                        <div className={cn(
                            "w-full text-left px-5 py-3 rounded-xl flex items-center justify-between group transition-all duration-200",
                            isActive('/about/exceptions')
                                ? "bg-white/10 text-white"
                                : "hover:bg-white/5 text-slate-500 hover:text-white"
                        )}>
                            <div className="flex items-center gap-3">
                                <AlertTriangle className={cn("h-4 w-4", isActive('/about/exceptions') ? "text-orange-400" : "text-slate-600 group-hover:text-orange-400")} />
                                <span className="font-semibold text-xs tracking-wide">Exception Matrix</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            <div className="p-6 border-t border-white/5 mx-4">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="h-4 w-4 text-purple-200" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-100">Pilot Mode</span>
                        </div>
                        <p className="text-xs font-medium text-purple-100 leading-relaxed mb-3">System is live for pilot testing. Report issues directly.</p>
                        <Button size="sm" variant="secondary" className="w-full text-[10px] font-black uppercase h-8 bg-white/10 text-white hover:bg-white/20 border-none">Report Bug</Button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                </div>
            </div>
        </aside>
    );
}
