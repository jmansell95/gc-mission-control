import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Download, FileText, ChevronDown, ChevronRight,
  Check, Copy, ClipboardCheck, Cloud, Database, ShieldCheck,
  Server, Rocket, Package, ListChecks, Printer, Presentation,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import MigrationRoadmap from '@/components/azure/MigrationRoadmap';
import ParityMatrix from '@/components/azure/ParityMatrix';
import { generateA3WallChart } from '@/utils/azureWallChartPdf';

const PHASE_ICONS = {
  0: Package,
  1: Cloud,
  2: Server,
  3: Database,
  4: ShieldCheck,
  5: Server,
  6: Rocket,
  7: ShieldCheck,
};

const STORAGE_KEY = 'gcmc-azure-migration-progress';

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const isBlock = className && className.startsWith('language-');
  const code = String(children).replace(/\n$/, '');

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* clipboard blocked — ignore */ }
  }, [code]);

  if (!isBlock) {
    return <code className={className}>{children}</code>;
  }

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0d1117]">
      <button
        onClick={copy}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/80 text-slate-200 text-[11px] font-semibold hover:bg-slate-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-sm"
      >
        {copied ? <ClipboardCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100 font-mono no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function PhaseSection({ index, title, content, isDone, onToggle, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = PHASE_ICONS[index] || FileText;

  return (
    <div className={`insight-card rounded-2xl overflow-hidden transition-all ${isDone ? 'opacity-90' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50/50 transition"
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
            isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
        >
          {isDone ? <Check className="w-4 h-4" /> : <span className="w-3 h-3 rounded-sm border-2 border-current" />}
        </button>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDone ? 'bg-emerald-100' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]'
        }`}>
          <Icon className={`w-5 h-5 ${isDone ? 'text-emerald-600' : 'text-white'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-base sm:text-lg font-bold tracking-tight truncate ${
            isDone ? 'text-slate-500 line-through' : 'text-slate-900'
          }`}>
            {title}
          </h2>
          {isDone && <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Phase complete</p>}
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-6 pt-1 border-t border-slate-100">
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h3:text-base prose-h3:mt-5 prose-h3:text-[#2E5A1A] prose-h4:text-sm prose-h4:font-semibold prose-h4:text-slate-700 prose-p:text-[15px] prose-p:leading-relaxed prose-li:text-[15px] prose-li:my-0.5 prose-a:text-[#2E5A1A] prose-strong:text-slate-900 prose-blockquote:border-l-[#2E5A1A] prose-blockquote:bg-emerald-50/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-table:text-sm prose-th:bg-slate-50 prose-th:font-semibold prose-th:border prose-th:border-slate-200 prose-td:border prose-td:border-slate-200">
            <ReactMarkdown
              components={{
                code: CodeBlock,
                pre: ({ children }) => <>{children}</>, // let CodeBlock render its own pre
                input: ({ checked, ...props }) => (
                  <span className="inline-flex items-center gap-2">
                    <span className={`inline-flex w-4 h-4 rounded border-2 items-center justify-center ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </span>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AzureMigrationPlan() {
  const [md, setMd] = useState('');
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState({});
  const [view, setView] = useState('presentation');

  // Load progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDone(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }, []);

  const saveProgress = useCallback((next) => {
    setDone(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  }, []);

  // Fetch markdown
  useEffect(() => {
    fetch('/Azure-Migration-Plan.md')
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(setMd)
      .catch(() => setMd(''))
      .finally(() => setLoading(false));
  }, []);

  // Parse phases: split on "## Phase N — Title"
  const { intro, phases } = useMemo(() => {
    if (!md) return { intro: '', phases: [] };
    const lines = md.split('\n');
    const phaseStarts = [];
    lines.forEach((line, i) => {
      if (/^## Phase \d+/.test(line)) phaseStarts.push(i);
    });
    const introText = lines.slice(0, phaseStarts[0] || lines.length).join('\n');
    const parsed = phaseStarts.map((start, idx) => {
      const end = phaseStarts[idx + 1] || lines.length;
      const block = lines.slice(start, end).join('\n');
      const titleMatch = block.match(/^## (Phase \d+ — .+)/m);
      const title = titleMatch ? titleMatch[1] : `Phase ${idx}`;
      const numMatch = title.match(/Phase (\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : idx;
      return { index: num, title, content: block };
    });
    return { intro: introText, phases: parsed };
  }, [md]);

  const completedCount = Object.values(done).filter(Boolean).length;
  const totalCount = phases.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const togglePhase = useCallback((index) => {
    setDone(prev => {
      const next = { ...prev, [index]: !prev[index] };
      saveProgress(next);
      return next;
    });
  }, [saveProgress]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Azure Migration Runbook"
        subtitle="3-Month Plan · UK South · GDPR-Compliant"
        actions={
          <>
            <button
              onClick={() => setView(v => v === 'presentation' ? 'runbook' : v === 'runbook' ? 'parity' : 'presentation')}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
              title={view === 'presentation' ? 'Runbook' : view === 'runbook' ? 'Parity Matrix' : 'Presentation'}
            >
              <Presentation className="w-4 h-4" />
              <span>{view === 'presentation' ? 'Runbook' : view === 'runbook' ? 'Parity Matrix' : 'Presentation'}</span>
            </button>
            <button
              onClick={() => generateA3WallChart()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white text-sm font-semibold hover:from-[#1c4a12] hover:to-[#4d7c2a] transition shadow-md"
              title="Download A3 Wall Chart"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">A3 Wall Chart</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition shadow-md"
              title="Download PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </>
        }
      />

      {/* Progress bar */}
      {!loading && totalCount > 0 && (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
              {completedCount}/{totalCount} phases
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto space-y-4 print-area">
        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-200/70 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Presentation view — exec summary + roadmap */}
            {view === 'presentation' && <MigrationRoadmap />}

            {/* Parity Matrix view — 1:1 mapping verification */}
            {view === 'parity' && <ParityMatrix />}

            {/* Runbook view — detailed phased checklist */}
            {view === 'runbook' && (
            <>
            {/* Intro */}
            {intro && (
              <div className="insight-card rounded-2xl p-5 sm:p-7">
                <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:text-slate-900 prose-h2:text-lg prose-h2:text-[#2E5A1A] prose-p:text-[15px] prose-p:leading-relaxed prose-strong:text-slate-900 prose-blockquote:border-l-[#2E5A1A] prose-blockquote:bg-emerald-50/50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-table:text-sm prose-th:bg-slate-50 prose-th:font-semibold prose-th:border prose-th:border-slate-200 prose-td:border prose-td:border-slate-200">
                  <ReactMarkdown
                    components={{
                      code: CodeBlock,
                      pre: ({ children }) => <>{children}</>,
                    }}
                  >
                    {intro}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Phases */}
            {phases.map((phase, i) => (
              <PhaseSection
                key={phase.index}
                index={phase.index}
                title={phase.title}
                content={phase.content}
                isDone={!!done[phase.index]}
                onToggle={() => togglePhase(phase.index)}
                defaultOpen={i === 0}
              />
            ))}

            {/* Footer note */}
            <div className="insight-card rounded-2xl p-5 flex items-start gap-3 bg-emerald-50/40 border-emerald-200/60">
              <ListChecks className="w-5 h-5 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 leading-relaxed">
                Your progress is saved on this device. Tick each phase as you complete it —
                the bar above tracks your overall migration. Take it one phase at a time.
              </p>
            </div>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}