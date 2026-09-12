import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * AutopilotToastBanner — renders autonomous-agent decisions as subtle
 * bottom-anchored toast banners. Each has an 'Autopilot' badge, a one-line
 * summary, and a 'Review' action that navigates to the Autopilot Control
 * panel. Never a modal — never blocks the UI.
 */
export default function AutopilotToastBanner({ toasts, onDismiss }) {
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 pointer-events-none sm:w-96">
      {toasts.map(t => {
        const isException = t.action === 'update' && t.summary?.toLowerCase().includes('exception');
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 p-3 flex items-start gap-2.5 animate-slide-up"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isException ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              {isException
                ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  <Bot className="w-2.5 h-2.5" /> Autopilot
                </span>
                <span className="text-xs text-slate-400 truncate">{t.actor}</span>
              </div>
              <p className="text-sm text-slate-700 font-medium mt-1 leading-snug">{t.summary}</p>
              <button
                onClick={() => { onDismiss(t.id); navigate('/admin?tab=autopilot'); }}
                className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
              >
                Review <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}