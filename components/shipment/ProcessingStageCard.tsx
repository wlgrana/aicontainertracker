import { useState } from "react"
import {
    CheckCircle,
    AlertTriangle,
    Clock,
    ChevronDown,
    ChevronUp,
    FileText,
    Bot,
    ShieldCheck,
    Search,
    Package,
    Save,
    AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { FieldMappingDetail } from "./FieldMappingDetail"
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge"

interface ProcessingStageCardProps {
    log: any // Typed as any until Prisma client regeneration
    expanded?: boolean
    durationMs?: number
}

export function ProcessingStageCard({ log, expanded: defaultExpanded = false, durationMs }: ProcessingStageCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)

    const toggleExpand = () => setIsExpanded(!isExpanded)

    // Stage Config
    const STAGE_CONFIG: Record<string, { icon: any, label: string, color: string }> = {
        'ARCHIVIST': { icon: Package, label: "Archivist Capture", color: "text-slate-600" },
        'TRANSLATOR': { icon: Bot, label: "Translator Agent", color: "text-blue-600" },
        'PERSISTENCE': { icon: Save, label: "Database Persistence", color: "text-indigo-600" },
        'AUDITOR': { icon: Search, label: "Auditor Verification", color: "text-purple-600" },
        'IMPROVEMENT_ANALYZER': { icon: Search, label: "Improvement Analysis", color: "text-amber-600" }
    }

    const stage = STAGE_CONFIG[log.stage] || { icon: Bot, label: log.stage, color: "text-gray-600" }
    const StatusIcon = log.status === 'COMPLETED' ? CheckCircle : AlertTriangle
    const statusColor = log.status === 'COMPLETED' ? "text-green-500" : "text-red-500"

    // Discrepancy Renderer
    const renderDiscrepancies = (discrepancies: any) => {
        const wrong = discrepancies.wrong || []
        const lost = discrepancies.lost || []
        const unmapped = discrepancies.unmapped || []

        const totalIssues = wrong.length + lost.length + unmapped.length
        if (totalIssues === 0) return null

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-700 font-medium bg-red-50 border border-red-100 p-3 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{totalIssues} Discrepancies Found</span>
                    <span className="text-xs text-red-500 font-normal ml-auto">
                        ({wrong.length + lost.length} critical, {unmapped.length} info)
                    </span>
                </div>

                <div className="space-y-3">
                    {/* LOST Data (High Severity) */}
                    {lost.map((item: any, i: number) => (
                        <div key={`lost-${i}`} className="bg-red-50 border-l-4 border-l-red-500 p-3 rounded-r text-sm">
                            <h4 className="font-semibold text-red-800 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3" />
                                Data Loss: {item.field}
                            </h4>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-red-500 uppercase font-bold text-[10px]">Raw Value</span>
                                    <div className="font-mono bg-white p-1 rounded border border-red-100 mt-1">
                                        {String(item.rawValue)}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-red-500 uppercase font-bold text-[10px]">Database</span>
                                    <div className="font-mono text-gray-400 italic mt-1">
                                        (Missing/Null)
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* WRONG Data (Medium/High Severity) */}
                    {wrong.map((item: any, i: number) => (
                        <div key={`wrong-${i}`} className="bg-orange-50 border-l-4 border-l-orange-500 p-3 rounded-r text-sm">
                            <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                                <AlertCircle className="h-3 w-3" />
                                Value Mismatch: {item.field}
                            </h4>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-orange-500 uppercase font-bold text-[10px]">Raw Value</span>
                                    <div className="font-mono bg-white p-1 rounded border border-orange-100 mt-1">
                                        {String(item.rawValue)}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-orange-500 uppercase font-bold text-[10px]">Database</span>
                                    <div className="font-mono bg-white p-1 rounded border border-orange-100 mt-1">
                                        {String(item.dbValue)}
                                    </div>
                                </div>
                            </div>
                            {item.correction && (
                                <div className="mt-2 text-xs text-orange-700 bg-orange-100/50 p-2 rounded">
                                    <span className="font-semibold">Suggested Fix:</span> Set {item.correction.column} to "{String(item.correction.value)}"
                                </div>
                            )}
                        </div>
                    ))}

                    {/* UNMAPPED Data (Low Severity) */}
                    {unmapped.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                            <h4 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                                <Search className="h-3 w-3" />
                                Unmapped Fields ({unmapped.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {unmapped.map((u: any, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-white border border-yellow-100 rounded text-xs text-yellow-700" title={`Value: ${u.rawValue}`}>
                                        {u.rawField}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Helper to render stage-specific content
    const renderDetails = () => {
        switch (log.stage) {
            case 'ARCHIVIST':
                return (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-md border border-slate-100 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider">Raw Row ID</p>
                                    <p className="font-mono text-slate-700">{log.output?.rowId || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wider">Note</p>
                                    <p className="text-slate-700">{log.output?.note || "Raw data captured accurately"}</p>
                                </div>
                            </div>
                        </div>
                        {log.output?.originalHeaders && (
                            <div className="text-xs text-slate-400">
                                Headers detected: {log.output.originalHeaders.length}
                            </div>
                        )}
                    </div>
                )

            case 'TRANSLATOR':
                const mappings = log.mappings || {}
                const unmapped = log.unmappedFields || []

                return (
                    <div className="space-y-4">
                        {/* Header Summary */}
                        <div className="flex items-center gap-4 text-sm bg-blue-50/50 p-2 rounded border border-blue-100">
                            <div>
                                <span className="text-slate-500">Confidence:</span>
                                <span className="ml-2 font-bold text-slate-700">{(log.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Dictionary:</span>
                                <span className="ml-2 font-mono text-xs">{log.dictionaryVersion || "Latest"}</span>
                            </div>
                        </div>

                        {/* Mappings List */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Field Mappings</p>
                            {Object.entries(mappings).map(([field, details]: [string, any]) => (
                                <FieldMappingDetail
                                    key={field}
                                    field={field}
                                    mapping={details}
                                    sourceHeader={details.source} // Assuming 'source' is source header name in our mapping struct
                                />
                            ))}
                        </div>

                        {/* Unmapped Warning */}
                        {unmapped.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                <div className="flex items-center gap-2 text-yellow-800 font-medium text-sm mb-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    {unmapped.length} Unmapped Fields Detected
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {unmapped.map((u: any, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-white border border-yellow-100 rounded text-xs text-yellow-700">
                                            {u.sourceHeader || u}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )

            case 'PERSISTENCE':
                return (
                    <div className="text-sm space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Events Generated:</span>
                            <span className="font-medium">{log.output?.eventsGenerated ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Linked Shipment:</span>
                            <span className="font-mono bg-slate-100 px-1 rounded">{log.output?.shipmentLinked || "None"}</span>
                        </div>
                    </div>
                )

            case 'AUDITOR':
                return (
                    <div className="space-y-3 text-sm">
                        {log.discrepancies ? (
                            renderDiscrepancies(log.discrepancies)
                        ) : (
                            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 p-3 rounded">
                                <CheckCircle className="h-4 w-4" />
                                <span>All data verified against raw source. Zero data loss confirmed.</span>
                            </div>
                        )}

                        {log.findings && (
                            <div className="text-xs text-slate-500 grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-slate-100">
                                <p>Capture Rate: <span className="font-medium">{log.findings.captureRate || "N/A"}</span></p>
                                <p>Recommendation: <span className="font-medium">{log.findings.recommendation || "N/A"}</span></p>
                            </div>
                        )}
                    </div>
                )

            default:
                return (
                    <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.output, null, 2)}
                    </pre>
                )
        }
    }

    return (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
            {/* Card Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={toggleExpand}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-slate-100 ${stage.color}`}>
                        <stage.icon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{stage.label}</h3>
                            {log.stage === 'TRANSLATOR' && log.confidence && (
                                <ConfidenceBadge score={log.confidence} showLabel={false} />
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                            <span>{log.status}</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(log.timestamp), 'h:mm:ss a')}</span>
                            {durationMs !== undefined && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400">+{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="p-4 border-t border-slate-100 bg-white animate-in slide-in-from-top-1">
                    {renderDetails()}
                </div>
            )}
        </div>
    )
}
