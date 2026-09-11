import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { FEATURE_AUDIT, AUDIT_SUMMARY } from '@/utils/powerapps/featureAudit';

const ICONS = {
  LayoutGrid: Layers,
  Calendar: Layers,
  Briefcase: Layers,
  Package: Layers,
  Truck: Layers,
  ShieldCheck: Layers,
  Receipt: Layers,
  Smartphone: Layers,
  Users: Layers,
  ScanLine: Layers,
  FlaskConical: Layers,
  BarChart3: Layers,
  Settings: Layers,
  Workflow: Layers,
  Globe: Layers,
  Building2: Layers,
  Zap: Layers,
  Sparkles: Layers,
};

function VerdictIcon({ verdict, size = 18 }) {
  if (verdict === 'yes') return <CheckCircle2 className="text-emerald-600 flex-shrink-0" style={{ width: size, height: size }} />;
  if (verdict === 'no') return <XCircle className="text-rose-600 flex-shrink-0" style={{ width: size, height: size }} />;
  return <AlertCircle className="text-amber-500 flex-shrink-0" style={{ width: size, height: size }} />;
}

function VerdictBadge({ verdict }) {
  const config = {
    yes: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Yes' },
    no: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'No' },
    partial: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Partial' },
  };
  const c = config[verdict] || config.partial;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      <VerdictIcon verdict={verdict} size={11} />
      {c.label}
    </span>
  );
}

export default function FeatureAuditTable() {
  const [expanded, setExpanded] = useState(() => {
    // All expanded by default for PDF; on screen the user can collapse
    const init = {};
    FEATURE_AUDIT.forEach((_, i) => { init[i] = true; });
    return init;
  });

  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="feature-audit-table">
      {/* Summary header */}
      <div className="rounded-xl px-4 py-3 mb-4 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2E5A1A, #1c4a12)' }}>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Layers className="w-5 h-5" /> Power Apps Feature Compatibility Audit
        </h2>
        <p className="text-xs text-white/70 mt-0.5">
          Every feature in the current app assessed for Power Apps transferability — green tick = yes, red cross = no, amber = partial
        </p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <span className="bg-white/15 rounded-lg px-2.5 py-1">
            <strong>{AUDIT_SUMMARY.totalModules}</strong> modules
          </span>
          <span className="bg-white/15 rounded-lg px-2.5 py-1">
            <strong>{AUDIT_SUMMARY.totalFeatures}</strong> features
          </span>
          <span className="bg-emerald-500/30 rounded-lg px-2.5 py-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> <strong>{AUDIT_SUMMARY.yes}</strong> yes
          </span>
          <span className="bg-amber-500/30 rounded-lg px-2.5 py-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> <strong>{AUDIT_SUMMARY.partial}</strong> partial
          </span>
          <span className="bg-rose-500/30 rounded-lg px-2.5 py-1 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> <strong>{AUDIT_SUMMARY.no}</strong> no
          </span>
        </div>
      </div>

      {/* Summary table — module-level overview */}
      <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-3 py-2 font-bold border-b border-slate-200 w-[40%]">Module</th>
              <th className="text-center px-2 py-2 font-bold border-b border-slate-200 w-[10%]">Verdict</th>
              <th className="text-left px-3 py-2 font-bold border-b border-slate-200 w-[50%]">Summary</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_AUDIT.map((m, i) => (
              <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-50 cursor-pointer`} onClick={() => toggle(i)}>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800">
                  <div className="flex items-center gap-2">
                    {expanded[i] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    {m.module}
                  </div>
                </td>
                <td className="px-2 py-2 border-b border-slate-100 text-center">
                  <VerdictIcon verdict={m.verdict} size={16} />
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-slate-600 text-[11px] leading-snug">{m.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed breakdown — per-module feature lists */}
      <div className="space-y-3">
        {FEATURE_AUDIT.map((m, i) => (
          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden audit-module-block">
            {/* Module header (click to toggle on screen) */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition text-left"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2E5A1A, #4d7c2a)' }}>
                <Layers className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{m.module}</h3>
                <p className="text-[11px] text-slate-500 truncate">{m.summary}</p>
              </div>
              <VerdictBadge verdict={m.verdict} />
              <span className="audit-toggle-icon print:hidden">
                {expanded[i] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </span>
            </button>

            {/* Feature breakdown — always visible in print, toggle on screen */}
            <div className={`audit-features ${expanded[i] ? 'block' : 'hidden'} print:!block`}>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600">
                    <th className="text-left px-3 py-1.5 font-semibold border-b border-slate-100 w-[22%]">Feature</th>
                    <th className="text-center px-1 py-1.5 font-semibold border-b border-slate-100 w-[6%]"></th>
                    <th className="text-left px-2 py-1.5 font-semibold border-b border-slate-100 w-[34%]">Reason</th>
                    <th className="text-left px-2 py-1.5 font-semibold border-b border-slate-100 w-[18%]">Target</th>
                    <th className="text-left px-2 py-1.5 font-semibold border-b border-slate-100 w-[20%]">Approach</th>
                  </tr>
                </thead>
                <tbody>
                  {m.features.map((f, fi) => (
                    <tr key={fi} className={fi % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                      <td className="px-3 py-1.5 border-b border-slate-50 font-medium text-slate-800 align-top">{f.name}</td>
                      <td className="px-1 py-1.5 border-b border-slate-50 text-center align-top">
                        <VerdictIcon verdict={f.verdict} size={14} />
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-50 text-slate-600 leading-snug align-top">{f.reason}</td>
                      <td className="px-2 py-1.5 border-b border-slate-50 text-slate-700 font-medium leading-snug align-top">{f.target}</td>
                      <td className="px-2 py-1.5 border-b border-slate-50 text-slate-500 leading-snug align-top">{f.approach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Print-only styles — force all sections expanded in PDF */}
      <style>{`
        @media print {
          .feature-audit-table .audit-features { display: block !important; }
          .feature-audit-table .audit-toggle-icon { display: none !important; }
          .feature-audit-table .audit-module-block { page-break-inside: avoid; break-inside: avoid; }
          .feature-audit-table table { page-break-inside: avoid; break-inside: avoid; }
          .feature-audit-table tr { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}