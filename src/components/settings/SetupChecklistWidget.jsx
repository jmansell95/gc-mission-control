import React from 'react';
import { CheckCircle2, Circle, ChevronRight, ListChecks } from 'lucide-react';

/**
 * Setup & Health Checklist — bento widget for the Settings Command Hub.
 *
 * Shows a progress ring + a list of tappable coverage rows. Each row links
 * to its settings page via onNavigate(id) so admins can work through setup
 * like a guided onboarding checklist.
 *
 * Props:
 *  - checks: [{ id, label, icon, done }]
 *  - onNavigate: (id) => void
 */
export default function SetupChecklistWidget({ checks = [], onNavigate }) {
  const done = checks.filter(c => c.done).length;
  const total = checks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
          <ListChecks className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">Setup & Health</h3>
          <p className="text-[11px] text-slate-500 font-medium">Coverage checklist for this business stream</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-[64px] h-[64px] flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(140 30% 92%)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r={radius} fill="none"
              stroke="url(#setupGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <defs>
              <linearGradient id="setupGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8DC63F" />
                <stop offset="100%" stopColor="#2E5A1A" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-extrabold text-slate-900 tabular-nums">{pct}%</span>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium leading-relaxed">
          <p className="text-slate-700 font-bold text-sm">{done} of {total} complete</p>
          <p className="mt-0.5">Tap an item below to finish setting up your stream.</p>
        </div>
      </div>

      <div className="space-y-0.5">
        {checks.map(c => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onNavigate(c.id)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition hover:bg-slate-50 active:scale-[0.99]"
            >
              {c.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${c.done ? 'text-emerald-500' : 'text-slate-400'}`} />}
                <span className={`text-xs font-semibold truncate ${c.done ? 'text-slate-500' : 'text-slate-800'}`}>{c.label}</span>
              </div>
              {!c.done && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}