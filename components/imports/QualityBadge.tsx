import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface QualityBadgeProps {
    grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
    captureRate?: number;
    className?: string;
}

export function QualityBadge({ grade, captureRate, className }: QualityBadgeProps) {
    const config = {
        EXCELLENT: {
            label: 'Excellent Quality',
            color: 'bg-green-100 text-green-700 border-green-200',
            icon: '✅'
        },
        GOOD: {
            label: 'Good Quality',
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            icon: '🟡'
        },
        NEEDS_IMPROVEMENT: {
            label: 'Needs Improvement',
            color: 'bg-orange-100 text-orange-800 border-orange-200',
            icon: '🟠'
        },
        POOR: {
            label: 'Poor Quality',
            color: 'bg-red-100 text-red-800 border-red-200',
            icon: '🔴'
        }
    };

    const style = config[grade] || config.POOR;
    const rateText = captureRate !== undefined ? ` (${(captureRate * 100).toFixed(0)}%)` : '';

    return (
        <div className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
            style.color,
            className
        )}>
            <span className="mr-1.5">{style.icon}</span>
            {style.label}{rateText}
        </div>
    );
}
