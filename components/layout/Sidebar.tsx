
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    FileUp,
    Settings,
    Database,
    Truck,
    HelpCircle,
    Info,
    List,
    AlertCircle,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: 'All Containers', href: '/dashboard?tab=containers', icon: List },
    { name: 'Action Items', href: '/dashboard?tab=attention', icon: AlertCircle },
    { name: 'Ingestion', href: '/import', icon: FileUp },
    { name: 'Import History', href: '/import-history', icon: Clock },
    { name: 'Manual Entry', href: '/dashboard?tab=manual', icon: Database },
    { name: 'How It Works', href: '/about', icon: Info },
];

export function Sidebar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <div className="flex h-full w-64 flex-col glass-dark text-slate-100 shadow-2xl relative z-20">
            <div className="flex h-24 items-center px-8">
                <Link href="/dashboard?tab=containers" className="flex items-center gap-3 group">
                    <div className="p-2 bg-primary rounded-xl glow-blue group-hover:scale-110 transition-transform duration-300">
                        <Truck className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        AG Ops
                    </span>
                </Link>
            </div>

            <nav className="flex-1 space-y-2 px-4 py-4">
                {navigation.map((item) => {
                    let isActive = false;
                    if (item.href.includes('?')) {
                        const itemPath = item.href.split('?')[0];
                        const itemParams = new URLSearchParams(item.href.split('?')[1]);
                        const tab = itemParams.get('tab');
                        const currentTab = searchParams.get('tab') || 'attention'; // Default to attention if no tab
                        isActive = pathname === itemPath && currentTab === tab;
                    } else {
                        isActive = pathname === item.href;
                    }

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300",
                                isActive
                                    ? "bg-primary text-white glow-blue shadow-lg"
                                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon className={cn(
                                "mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-300",
                                isActive ? "text-white" : "text-slate-500 group-hover:text-blue-400"
                            )} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_oklch(0.6_0.2_150)]" />
                        Live Network
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400 leading-tight">
                        AI Nodes active. Schema detection at 100% capacity.
                    </p>
                </div>
            </div>
        </div>
    );
}
