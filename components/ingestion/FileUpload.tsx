"use client";

import React, { useState, useCallback } from 'react';
import { Upload, File, X, CheckCircle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FileUploadProps {
    onUploadComplete: (fileId: string) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [forwarder, setForwarder] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setError(null);
        }
    };

    const uploadFile = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('forwarder', forwarder);

        try {
            // Simulated progress
            const interval = setInterval(() => {
                setProgress(prev => (prev >= 90 ? 90 : prev + 10));
            }, 100);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(interval);
            setProgress(100);

            const data = await res.json();
            if (data.success) {
                onUploadComplete(data.fileId);
            } else {
                setError(data.error || "Upload failed");
            }
        } catch (err) {
            setError("Network error");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-[2rem] p-12 transition-all duration-500 group",
                    "flex flex-col items-center justify-center space-y-6",
                    file
                        ? "border-green-500/50 bg-green-500/5 glow-blue"
                        : "border-white/10 bg-white/5 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.01]"
                )}
            >
                {!file ? (
                    <>
                        <div className="p-6 rounded-3xl bg-primary/20 text-primary glow-blue transition-transform group-hover:scale-110 duration-500">
                            <Upload className="w-10 h-10" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-2xl font-black text-white tracking-tight">Broadcast Manifest</p>
                            <p className="text-sm text-slate-400 font-medium">Click to select or drag and drop your .xlsx or .csv files</p>
                        </div>
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                        />
                    </>
                ) : (
                    <div className="flex items-center space-x-6 w-full animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-4 rounded-2xl bg-green-500/20 text-green-400 glow-blue">
                            <File className="w-8 h-8" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-black text-white truncate">{file.name}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB Readiness Check</p>
                        </div>
                        <button
                            onClick={() => setFile(null)}
                            disabled={uploading}
                            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>

            {file && !uploading && !progress && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Forwarder / Source</label>
                        <input
                            type="text"
                            placeholder="Enter Forwarder Name (e.g. Flexport, Kuehne+Nagel)"
                            value={forwarder}
                            onChange={(e) => setForwarder(e.target.value)}
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                        />
                    </div>

                    <button
                        onClick={uploadFile}
                        disabled={!forwarder.trim()}
                        className="w-full py-4 px-8 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary/20 glow-blue active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Initialize Transmission
                    </button>
                </div>
            )}

            {uploading && (
                <div className="space-y-4 px-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Synchronizing...
                        </span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-primary glow-blue transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold text-center glow-blue">
                    {error}
                </div>
            )}
        </div>
    );
}
