import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * WizardBreadcrumb — slim clickable step trail at the top of the wizard modal.
 * Shows Splash → Method → Source → Entry. Clicking a step jumps back to it
 * (only allowed for steps before the current one, and only if it would not
 * discard already-entered data — the parent decides via `canGoTo`).
 *
 * Props:
 *  - steps: [{ id, label }]
 *  - current: active step id
 *  - canGoTo: (stepId) => boolean  — parent decides which steps are reachable
 *  - onJump: (stepId) => void
 */
export default function WizardBreadcrumb({ steps, current, canGoTo, onJump }) {
  const currentIdx = steps.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-1 px-5 py-2.5 border-b border-slate-200/80 bg-slate-50/50 flex-shrink-0 overflow-x-auto no-scrollbar">
      {steps.map((s, i) => {
        const isCurrent = s.id === current;
        const isPast = i < currentIdx;
        const reachable = canGoTo ? canGoTo(s.id) : isPast;
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => reachable && onJump(s.id)}
              disabled={!reachable}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                isCurrent
                  ? 'bg-primary/10 text-primary'
                  : reachable
                    ? 'text-slate-500 hover:bg-white hover:text-slate-700 cursor-pointer'
                    : 'text-slate-300 cursor-default'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                isCurrent ? 'bg-primary text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isPast ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}