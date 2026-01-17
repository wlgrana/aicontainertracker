import { Badge } from "@/components/ui/badge"

interface ConfidenceBadgeProps {
    score: number
    showLabel?: boolean
}

export function ConfidenceBadge({ score, showLabel = true }: ConfidenceBadgeProps) {
    let variant: "default" | "destructive" | "secondary" | "outline" = "default"
    let colorClass = ""
    let label = ""

    if (score >= 0.95) {
        colorClass = "bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
        label = "Verified"
        variant = "outline"
    } else if (score >= 0.85) {
        colorClass = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
        label = "High Confidence"
        variant = "outline"
    } else if (score >= 0.70) {
        colorClass = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"
        label = "Medium Confidence"
        variant = "outline"
    } else {
        colorClass = "bg-red-100 text-red-800 hover:bg-red-200 border-red-200"
        label = "Low Confidence"
        variant = "destructive"
    }

    // Format percentage
    const percentage = Math.round(score * 100)

    return (
        <Badge variant={variant} className={`${colorClass} whitespace-nowrap`}>
            {percentage}%{showLabel && ` · ${label}`}
        </Badge>
    )
}
