import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AzureMigrationPlan() {
  const navigate = useNavigate();
  const [md, setMd] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/Azure-Migration-Plan.md')
      .then(r => r.text())
      .then(setMd)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#FAFAF9]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">Azure Migration Plan</h1>
              <p className="text-xs text-slate-400 truncate">GC Mission Control — off Base44, onto Microsoft Azure</p>
            </div>
          </div>
          <a
            href="/Azure-Migration-Plan.md"
            download="Azure-Migration-Plan.md"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition shadow-md whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download document</span>
            <span className="sm:hidden">Download</span>
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 rounded-md bg-slate-200/70 animate-pulse" style={{ width: `${60 + (i % 4) * 12}%` }} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 sm:p-10">
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:border-b prose-h1:pb-3 prose-h1:border-slate-200 prose-h2:text-xl prose-h2:mt-10 prose-h2:text-[#2E5A1A] prose-h3:text-base prose-h3:mt-6 prose-a:text-[#2E5A1A] prose-strong:text-slate-900 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-table:text-sm prose-th:bg-slate-50 prose-th:font-semibold prose-blockquote:border-l-[#2E5A1A]">
              <ReactMarkdown>{md}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}