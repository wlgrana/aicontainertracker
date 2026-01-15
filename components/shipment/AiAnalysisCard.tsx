
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, Clock, DollarSign, FileText, Megaphone, RefreshCw, XCircle, Sparkles, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface AiAnalysisCardProps {
    containerContext: any;
    className?: string;
    refreshTrigger?: number;
    mode?: 'full' | 'recommendations_only';
}

import { analyzeContainer, type ContainerAnalysis } from "@/app/actions/analyzeContainer";
import { getLatestAssessment } from "@/app/actions/ai/persistence";

export function AiAnalysisCard({ containerContext, className, refreshTrigger, mode = 'full' }: AiAnalysisCardProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefetching, setIsRefetching] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Forces override risk
    const forcedRisk = containerContext.forceRiskLevel;
    const isComplete = forcedRisk === 'LOW';
    const isCritical = forcedRisk === 'CRITICAL';

    // Server-side loaded analysis
    const fetchAnalysis = async (isRefresh = false) => {
        const { containerNumber } = containerContext;

        try {

            // 1. Try to load from DB first (unless forcing refresh)
            if (!isRefresh) {
                const saved = await getLatestAssessment(containerNumber);
                if (saved) {
                    const s = saved as any;
                    setAnalysis({
                        score: s.riskScore,
                        factors: s.riskFactors,
                        recommendations: s.recommendations,
                        prediction: s.prediction || "AI analysis complete.", // Fallback
                        outcome: s.outcome || "Status assessed.",
                        timestamp: new Date(s.timestamp),
                        dataChecks: s.dataChecks, // Pass through checks
                        dataSummary: s.dataSummary,
                        unmappedInsights: s.unmappedInsights,
                        structured_metadata: s.structured_metadata,
                        classification: s.classification
                    });
                    setIsLoading(false);
                    return;
                }
            }

            // 2. Generate new analysis (if refresh or no DB record)
            if (isRefresh) {
                setIsRefetching(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            // Call Server Action
            const newAnalysis = await analyzeContainer(containerNumber);
            setAnalysis(newAnalysis);
            setIsLoading(false);
            setIsRefetching(false);

        } catch (err) {
            console.error("AI Analysis Failed:", err);
            setError("Mission Oracle is temporarily offline. Please retry.");
            setIsLoading(false);
            setIsRefetching(false);
        }
    };

    useEffect(() => {
        fetchAnalysis(false);
    }, [containerContext.containerNumber]);

    // External Trigger Listener
    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            fetchAnalysis(true);
        }
    }, [refreshTrigger]);

    // Helper for colors
    // SWITCHING TO HEALTH SCORE: 100 = Good (Green), 0 = Bad (Red)
    const getHealthColor = (score: number) => {
        if (score >= 80) return "text-emerald-500";
        if (score >= 50) return "text-blue-500";
        if (score >= 30) return "text-amber-500";
        return "text-red-500";
    };

    const getHealthBadge = (score: number) => {
        if (score >= 80) return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">OPTIMAL</Badge>;
        if (score >= 50) return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">STABLE</Badge>;
        if (score >= 30) return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">AT RISK</Badge>;
        return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">CRITICAL</Badge>;
    };

    const getBarColor = (score: number) => {
        if (score >= 80) return "bg-emerald-500";
        if (score >= 50) return "bg-blue-500";
        if (score >= 30) return "bg-amber-400";
        return "bg-red-500";
    };

    if (isLoading) {
        if (mode === 'recommendations_only') return <Skeleton className="h-24 w-full rounded-2xl bg-slate-50" />;
        return (
            <Card className={cn("border-cyan-500/30 bg-slate-900/95 text-white backdrop-blur-xl shadow-[0_0_30px_-10px_rgba(6,182,212,0.3)]", className)}>
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
                        <BrainCircuit className="h-5 w-5" />
                        <span className="font-bold tracking-widest text-xs uppercase">Mission Oracle Analysis</span>
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4 bg-slate-800" />
                        <Skeleton className="h-2 w-full bg-slate-800" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        if (mode === 'recommendations_only') return null; // Hide on error in minimal mode
        return (
            <Card className="border-red-200 bg-red-50 text-red-900">
                <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div className="text-sm font-medium">AI Analysis Failed. <button onClick={() => fetchAnalysis(true)} className="underline">Retry</button></div>
                </CardContent>
            </Card>
        )
    }


    const { riskScore: rawRiskScore, riskFactors: factors, prediction, outcome, dataChecks, dataSummary, unmappedInsights, recommendations } = analysis;

    // CONVERT RISK (0=Good, 100=Bad) -> HEALTH (100=Good, 0=Bad)
    // Formula: Health = 100 - Risk
    // If rawRiskScore is missing (due to new prompt), derive from classification
    let healthScore = 100;
    if (rawRiskScore !== undefined) {
        healthScore = 100 - (rawRiskScore || 0);
    } else if (analysis.classification) {
        const urgency = analysis.classification.attention.urgency;
        if (urgency === 'CRITICAL') healthScore = 10;
        else if (urgency === 'HIGH') healthScore = 40;
        else if (urgency === 'MEDIUM') healthScore = 70;
        else healthScore = 100;
    }

    // Apply Overrides
    if (forcedRisk === 'CRITICAL') healthScore = 10;   // Bad -> Red
    if (forcedRisk === 'LOW') healthScore = 100;       // Good -> Green


    if (mode === 'recommendations_only') {
        // Mode 'recommendations_only' is effectively deprecated with this change but kept for compatibility
        return null;
    }

    return (
        <Card className={cn("border-cyan-500/20 bg-slate-900/95 text-slate-100 backdrop-blur-xl shadow-xl overflow-hidden relative h-full flex flex-col", className)}>
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 pointer-events-none" />

            {/* Header / Score */}
            <div className="p-6 border-b border-slate-800/50 relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                            <BrainCircuit className="h-4 w-4" />
                        </div>
                        <span className="font-black tracking-widest text-[10px] uppercase">Mission Oracle</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {analysis?.timestamp && <span suppressHydrationWarning className="text-[10px] text-slate-500">{formatDistanceToNow(new Date(analysis.timestamp))} ago</span>}
                        <Button variant="ghost" size="icon" onClick={() => fetchAnalysis(true)} disabled={isRefetching} className="h-6 w-6 text-slate-500 hover:text-cyan-400">
                            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-end justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {forcedRisk ? "Operational Override" : "Mission Health"}
                        </span>
                        <span className={cn("text-2xl font-black tracking-tighter", getHealthColor(healthScore))}>
                            {healthScore}/100
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-1000 ease-out", getBarColor(healthScore))} style={{ width: `${healthScore}%` }} />
                    </div>
                    <div className="flex justify-between items-center">
                        {getHealthBadge(healthScore)}
                        <span className="text-[10px] font-medium text-slate-500">
                            {forcedRisk ? "Rules Enforced" : (healthScore < 50 ? "Intervention Advised" : "Stable State")}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content: Why, Prediction, Outcome */}
            <CardContent className="p-6 space-y-8 overflow-y-auto flex-1 relative z-10 custom-scrollbar">

                {/* FORCE RISK EXPLANATION */}
                {isCritical && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Operational Alert
                        </h4>
                        <p className="text-xs font-bold text-red-200">
                            Critical demurrage accumulation detected. Immediate intervention mandatory.
                        </p>
                    </div>
                )}

                {/* AI STATUS CLASSIFICATION (NEW) */}
                {analysis.classification && (
                    <div className={cn(
                        "rounded-xl p-4 border transition-all duration-300",
                        analysis.classification.attention.urgency === 'CRITICAL' ? "bg-red-500/10 border-red-500/30" :
                            analysis.classification.attention.urgency === 'HIGH' ? "bg-amber-500/10 border-amber-500/30" :
                                "bg-indigo-500/10 border-indigo-500/20"
                    )}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                    "text-[10px] font-black uppercase tracking-widest border-2",
                                    analysis.classification.attention.urgency === 'CRITICAL' ? "text-red-400 border-red-500/50 bg-red-500/20" :
                                        analysis.classification.attention.urgency === 'HIGH' ? "text-amber-400 border-amber-500/50 bg-amber-500/20" :
                                            "text-indigo-300 border-indigo-500/50 bg-indigo-500/20"
                                )}>
                                    {analysis.classification.status.operational.replace('_', ' ')}
                                </Badge>
                                {analysis.classification.attention.category !== 'ON_TRACK' && (
                                    <Badge variant="secondary" className="text-[9px] h-5 bg-slate-800 text-slate-400">
                                        {analysis.classification.attention.category.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-70">
                                {analysis.classification.status.confidence}
                            </span>
                        </div>

                        {analysis.classification.attention.headline && (
                            <h4 className={cn(
                                "text-sm font-bold mb-2 leading-tight",
                                analysis.classification.attention.urgency === 'CRITICAL' ? "text-red-100" :
                                    analysis.classification.attention.urgency === 'HIGH' ? "text-amber-100" :
                                        "text-indigo-100"
                            )}>
                                {analysis.classification.attention.headline}
                            </h4>
                        )}

                        <p className="text-xs text-slate-300 leading-relaxed font-medium opacity-90">
                            {analysis.classification.status.reason}
                        </p>

                        {analysis.classification.attention.owner && (
                            <div className="mt-4 pt-3 border-t border-slate-700/30 flex items-center justify-between">
                                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Recommended Owner</span>
                                <Badge variant="secondary" className="text-[10px] h-5 bg-slate-800 text-cyan-400 border border-slate-700">
                                    {analysis.classification.attention.owner.replace('_', ' ')}
                                </Badge>
                            </div>
                        )}
                    </div>
                )}

                {/* MISSION COMPLETE SUCCESS CARD */}
                {isComplete && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
                            <PartyPopper className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest">
                            Mission Success
                        </h4>
                        <p className="text-xs font-medium text-emerald-200/80 leading-relaxed">
                            All logistical stages have been closed. No further AI monitoring is required.
                        </p>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
