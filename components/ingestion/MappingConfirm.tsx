"use client";

import React, { useState } from 'react';
import { Check, X, Info } from 'lucide-react';

interface MappingConfirmProps {
    proposal: {
        forwarderName: string;
        columnMapping: Record<string, string>;
        confidence: number;
    };
    onConfirm: (mapping: any) => void;
    onCancel: () => void;
}

export default function MappingConfirm({ proposal, onConfirm, onCancel }: MappingConfirmProps) {
    const [mapping, setMapping] = useState(proposal.columnMapping);

    const handleFieldChange = (canonical: string, header: string) => {
        setMapping(prev => ({ ...prev, [canonical]: header }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">Review Column Mapping</h3>
                        <p className="text-sm text-gray-400">Detected: {proposal.forwarderName} (Confidence: {(proposal.confidence * 100).toFixed(0)}%)</p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    <div className="flex items-start space-x-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
                        <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                        <p className="text-xs text-blue-300">
                            Our AI has predicted these mappings based on your headers. Please verify and adjust if needed before processing.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 px-2">
                        <span>CANONICAL FIELD</span>
                        <span>YOUR EXCEL HEADER</span>
                    </div>

                    {Object.entries(mapping).map(([canonical, header]) => (
                        <div key={canonical} className="grid grid-cols-2 gap-4 items-center bg-gray-800/30 p-3 rounded-xl border border-gray-800">
                            <span className="text-sm text-white font-mono">{canonical}</span>
                            <input
                                value={header}
                                onChange={(e) => handleFieldChange(canonical, e.target.value)}
                                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-gray-800 flex space-x-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(mapping)}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                        <Check className="w-5 h-5" />
                        <span>Confirm & Process</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
