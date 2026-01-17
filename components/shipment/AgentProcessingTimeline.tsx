import { useEffect, useState } from "react"
import { ProcessingStageCard } from "./ProcessingStageCard"
import { AlertCircle, Loader2 } from "lucide-react"

interface AgentProcessingTimelineProps {
    containerId: string
}

export function AgentProcessingTimeline({ containerId }: AgentProcessingTimelineProps) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchLogs() {
            try {
                const res = await fetch(`/api/containers/${containerId}/processing-timeline`)
                if (!res.ok) throw new Error('Failed to fetch processing logs')
                const data = await res.json()
                setLogs(data)
            } catch (err) {
                console.error(err)
                setError('Could not load processing history')
            } finally {
                setLoading(false)
            }
        }

        if (containerId) {
            fetchLogs()
        }
    }, [containerId])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <Loader2 className="h-6 w-6 text-slate-400 animate-spin mr-2" />
                <span className="text-slate-500 text-sm">Loading agent timeline...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-slate-500 text-sm">No agent processing logs available for this record.</p>
                <p className="text-slate-400 text-xs mt-1">This container may have been imported before the timeline feature was enabled.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    🤖 Agent Processing Timeline
                </h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    {logs.length} stages recorded
                </span>
            </div>

            <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                {logs.map((log, index) => {
                    // Calculate duration since previous stage (which is the NEXT item in the array, as logs are descending)
                    const previousStage = logs[index + 1]
                    const durationMs = previousStage
                        ? new Date(log.timestamp).getTime() - new Date(previousStage.timestamp).getTime()
                        : undefined

                    return (
                        <div key={log.id} className="relative">
                            {/* Timeline dot */}
                            <div className={`absolute -left-[21px] top-6 h-3 w-3 rounded-full border-2 border-white
                  ${log.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-red-500'}
              `}></div>

                            <ProcessingStageCard
                                log={log}
                                expanded={index === 0} // Expand the most recent stage by default
                                durationMs={durationMs}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
