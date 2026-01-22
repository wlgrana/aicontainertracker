'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Database, TrendingUp } from 'lucide-react';

interface HeaderMapping {
    id: string;
    excelHeader: string;
    canonicalField: string;
    confidence: number;
    timesUsed: number;
    createdAt: string;
    lastUsedAt: string;
}

export default function DictionaryPage() {
    const [mappings, setMappings] = useState<HeaderMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/dictionary');
            const data = await response.json();
            setMappings(data.mappings || []);
        } catch (error) {
            console.error('Error fetching mappings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMappings();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this mapping?')) return;

        setDeleting(id);
        try {
            const response = await fetch('/api/dictionary', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                setMappings(mappings.filter(m => m.id !== id));
            } else {
                alert('Failed to delete mapping');
            }
        } catch (error) {
            console.error('Error deleting mapping:', error);
            alert('Error deleting mapping');
        } finally {
            setDeleting(null);
        }
    };

    const stats = {
        total: mappings.length,
        highConfidence: mappings.filter(m => m.confidence >= 0.95).length,
        mostUsed: mappings.length > 0 ? Math.max(...mappings.map(m => m.timesUsed)) : 0,
        avgConfidence: mappings.length > 0
            ? (mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length).toFixed(2)
            : '0.00'
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                                <Database className="w-8 h-8 text-blue-600" />
                                Header Mapping Dictionary
                            </h1>
                            <p className="text-slate-600 mt-2">
                                Learned mappings from successful imports • Reduces AI costs on repeat imports
                            </p>
                        </div>
                        <button
                            onClick={fetchMappings}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Mappings</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
                            </div>
                            <Database className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">High Confidence</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{stats.highConfidence}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Most Used</p>
                                <p className="text-2xl font-bold text-purple-600 mt-1">{stats.mostUsed}x</p>
                            </div>
                            <RefreshCw className="w-8 h-8 text-purple-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Avg Confidence</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.avgConfidence}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Mappings Table */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Excel Header
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Canonical Field
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Confidence
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Times Used
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Last Used
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Loading mappings...
                                        </td>
                                    </tr>
                                ) : mappings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            No mappings found. Import a file to start learning!
                                        </td>
                                    </tr>
                                ) : (
                                    mappings.map((mapping) => (
                                        <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-slate-900">
                                                    {mapping.excelHeader}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-slate-700 font-mono">
                                                    {mapping.canonicalField}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mapping.confidence >= 0.95
                                                        ? 'bg-green-100 text-green-800'
                                                        : mapping.confidence >= 0.9
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {(mapping.confidence * 100).toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-slate-700">
                                                    {mapping.timesUsed}x
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {new Date(mapping.lastUsedAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleDelete(mapping.id)}
                                                    disabled={deleting === mapping.id}
                                                    className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                                                    title="Delete mapping"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">How Dictionary Learning Works</h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span><strong>First Import:</strong> AI analyzes all headers and saves high-confidence mappings (≥90%)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span><strong>Subsequent Imports:</strong> Known headers are instantly mapped from dictionary (zero AI cost)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span><strong>Mixed Imports:</strong> Dictionary handles known headers, AI only analyzes new ones</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span><strong>Priority:</strong> Mappings with higher usage counts are prioritized when conflicts occur</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
