import React from 'react';
import { ExtractedField } from '@/lib/extractContainerData';

interface FieldValueProps {
    field: ExtractedField | undefined;
    fallbackAction?: {
        label: string;
        onClick: () => void;
    };
    showSource?: boolean;
}

export function FieldValue({ field, fallbackAction, showSource = true }: FieldValueProps) {
    if (!field) {
        // No data available
        if (fallbackAction) {
            return (
                <button
                    className="add-field-link"
                    onClick={fallbackAction.onClick}
                >
                    {fallbackAction.label}
                </button>
            );
        }
        return <span className="no-value">N/A</span>;
    }

    const isInferred = field.source === 'unmapped_raw' || field.source === 'mapped';

    return (
        <div className="field-value-container">
            <span className="field-value">{field.formattedValue}</span>

            {isInferred && showSource && (
                <span
                    className="inferred-badge"
                    title={`Extracted from "${field.originalFieldName}" (${Math.round(field.confidence * 100)}% confidence)`}
                >
                    <span className="ai-icon">🤖</span>
                    <span className="confidence">{Math.round(field.confidence * 100)}%</span>
                </span>
            )}
        </div>
    );
}
