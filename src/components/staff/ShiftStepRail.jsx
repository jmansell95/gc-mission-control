import React from 'react';
import { CheckCircle2, MapPin, ShieldCheck, Briefcase, Flag, ClipboardCheck } from 'lucide-react';

// ShiftStepRail — left-pane step list for the tablet layout of ShiftWizard.
// Shows each shift step with its status (done / active / upcoming) and lets
// the user jump back to any completed or current step. Mobile uses the
// compact progress dots instead; this rail is tablet-only.
const STEP_META = {
  checks: { icon: ClipboardCheck, label: 'Daily Checks', desc: 'Pre-work safety checklist' },
  arrive: { icon: MapPin, label: 'Arrive on Site', desc: 'Log travel & confirm arrival' },
  briefing: { icon: ShieldCheck, label: 'Briefing & Induction', desc: 'Sign the daily briefing' },
  working: { icon: Briefcase, label: 'Tasks', desc: 'Log tasks & progress' },
  end_of_shift: { icon: Flag, label: 'Finish Day', desc: 'Travel home & submit timesheet' },
};

export default function ShiftStepRail({ steps, currentStep, currentStepIndex, onJump, previewMode = false }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 border-b border-slate-100">
        <h3 className="text-sm font-extrabold text-slate-900">Shift Steps</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {steps.map((s, i) => {
          const meta = STEP_META[s] || { icon: Briefcase, label: s, desc: '' };
          const Icon = meta.icon;
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          const clickable = (done || active || previewMode) && onJump;
          return (
            <button
              key={s}
              type="button"
              onClick={clickable ? () => onJump(s) : undefined}
              disabled={!clickable}
              className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition ${
                active
                  ? 'bg-emerald-50 border border-emerald-200 shadow-sm'
                  : done
                  ? 'hover:bg-slate-100 border border-transparent'
                  : previewMode
                  ? 'hover:bg-slate-50 border border-transparent opacity-70'
                  : 'opacity-50 cursor-not-allowed border border-transparent'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  done
                    ? 'bg-primary text-white'
                    : active
                    ? 'bg-white border-2 border-primary text-primary'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold leading-tight ${
                    active ? 'text-primary' : done ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {meta.label}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{meta.desc}</p>
              </div>
              {done && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}