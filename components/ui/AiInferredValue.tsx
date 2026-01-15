
import { cn } from "@/lib/utils";
import { Sparkles, Bot } from "lucide-react";

interface AiInferredValueProps {
    value: any;
    originalFieldName: string;
    confidenceScore: number;
    formatType?: 'date' | 'currency' | 'number' | 'text';
    className?: string;
    showIcon?: boolean;
}

export function AiInferredValue({
    value,
    originalFieldName,
    confidenceScore,
    formatType = 'text',
    className,
    showIcon = true
}: AiInferredValueProps) {

    // Simple formatting helper
    const formatValue = (val: any) => {
        if (!val) return "N/A";
        if (formatType === 'currency' && !String(val).startsWith('$')) return `$${val}`;
        // Date formatting could happen here or be passed in pre-formatted
        return val;
    };

    const formattedValue = formatValue(value);

    return (
        <div className={cn("group flex flex-col items-start gap-0.5", className)}>
            <span className="font-medium text-slate-900 group-hover:text-indigo-900 transition-colors">
                {formattedValue}
            </span>

            <div className="relative group/tooltip">
                <div className="inline-flex items-center gap-1.5 bg-indigo-50/50 hover:bg-indigo-100/80 px-1.5 py-0.5 rounded-md cursor-help transition-colors border border-indigo-100/50">
                    {showIcon && <Bot className="h-3 w-3 text-indigo-600" />}
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">AI Inferred</span>
                    <span className="text-[9px] font-medium text-indigo-400">
                        {Math.round(confidenceScore * 100)}%
                    </span>
                </div>

                {/* CSS-only Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] hidden group-hover/tooltip:block z-50">
                    <div className="bg-slate-900 text-slate-50 border border-slate-800 p-3 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1">
                            <p className="font-semibold text-xs flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-indigo-400" />
                                AI Extraction
                            </p>
                            <p className="text-xs text-slate-300">
                                Extracted from unmapped field: <br />
                                <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-200 mt-1 inline-block">
                                    "{originalFieldName}"
                                </code>
                            </p>
                            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 mt-1">
                                {Math.round(confidenceScore * 100)}% confidence match to canonical field.
                            </p>
                        </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                </div>
            </div>
        </div>
    );
}
