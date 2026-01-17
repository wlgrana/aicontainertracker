
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
// import ReactMarkdown from 'react-markdown'; 
// If not available, I'll just use simple text rendering or dangerouslySetInnerHTML if I parse it manually?
// I'll stick to simple whitespace-pre-wrap for reliability without adding dependencies.

export default async function FixReportPage() {
    const filePath = path.join(process.cwd(), 'docs/incident_reports/2026-01-16_fix_import_quality.md');
    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        content = "# Error\nCould not load report.";
    }

    return (
        <div className="min-h-screen bg-slate-50 p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link href="/import-history" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back to Import History
                </Link>

                <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-10">
                    <article className="prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                            {content}
                        </pre>
                    </article>
                </div>
            </div>
        </div>
    );
}
