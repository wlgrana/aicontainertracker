import { ArrowRight, Info } from "lucide-react"
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FieldMappingDetailProps {
    field: string
    mapping: {
        value?: any
        originalValue?: any
        confidence: number
        source?: string
        transformation?: string
        notes?: string
    }
    sourceHeader?: string
}

export function FieldMappingDetail({ field, mapping, sourceHeader }: FieldMappingDetailProps) {
    const isTransformed = mapping.value !== mapping.originalValue
    const lowConfidence = mapping.confidence < 0.85

    return (
        <div className={`p-3 rounded-md border ${lowConfidence ? "bg-yellow-50/50 border-yellow-200" : "bg-slate-50 border-slate-100"}`}>
            <div className="flex items-start justify-between gap-4">

                {/* Mapping Visualization */}
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <span>{sourceHeader || "Unknown Header"}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                            {field}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                        <div className="font-mono text-slate-500 max-w-[150px] truncate" title={String(mapping.originalValue)}>
                            "{String(mapping.originalValue ?? "null")}"
                        </div>
                        {isTransformed && (
                            <>
                                <ArrowRight className="h-3 w-3 text-blue-400" />
                                <div className="font-bold text-slate-900">
                                    {String(mapping.value instanceof Date ? mapping.value.toISOString().split('T')[0] : mapping.value)}
                                </div>
                            </>
                        )}
                        {!isTransformed && (
                            <span className="text-slate-400 text-xs">(Direct Copy)</span>
                        )}
                    </div>
                </div>

                {/* Confidence & Reasoning */}
                <div className="flex flex-col items-end gap-1">
                    <ConfidenceBadge score={mapping.confidence} showLabel={false} />

                    {(mapping.transformation || mapping.source) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 cursor-help hover:text-blue-600 transition-colors">
                                        <Info className="h-3 w-3" />
                                        {mapping.transformation ? "Transformed" : "Mapped"}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[300px] p-3 text-xs space-y-2">
                                    {mapping.source && <p><span className="font-semibold">Source:</span> {mapping.source}</p>}
                                    {mapping.transformation && <p><span className="font-semibold">Logic:</span> {mapping.transformation}</p>}
                                    {mapping.notes && <p className="text-slate-400 italic">"{mapping.notes}"</p>}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
        </div>
    )
}
