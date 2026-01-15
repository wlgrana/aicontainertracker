"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, FileText, Activity, Layers, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import DataLineageContent from './DataLineageContent';

interface DataLineageViewProps {
    data: any;
}

export default function DataLineageView({ data }: DataLineageViewProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/container/${data.containerNumber}`)} className="hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Lineage & Audit</h1>
                        <div className="flex gap-2 text-xs text-slate-500 font-mono">
                            <span>{data.containerNumber}</span>
                            <span>•</span>
                            <span>ID: {data.id}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
                <DataLineageContent data={data} />
            </main>
        </div>
    );
}
