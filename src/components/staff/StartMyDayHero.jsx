import React from 'react';
import { ShieldCheck, ChevronRight, Car, ClipboardCheck, Play } from 'lucide-react';

/**
 * StartMyDayHero — prominent hero card that kicks off the daily safety flow.
 * Shows the 3-step Mitti safety sequence (Vehicle Check → POWRA → Start Job)
 * so drillers know exactly what they need to do before they can start work.
 *
 * Props:
 *  - isDriller: whether the crew member is a driller (shows plant check step)
 *  - onStart: () => void  — opens the PreWorkSafetyChecklist
 */
export default function StartMyDayHero({ isDriller = false, onStart }) {
  const steps = isDriller
    ? [
        { icon: Car, label: 'Vehicle Check', sub: 'Daily walk-round in Mitti' },
        { icon: ClipboardCheck, label: 'Plant Check', sub: 'Rig & equipment check' },
        { icon: ShieldCheck, label: 'POWRA', sub: 'Point-of-work risk assessment' },
      ]
    : [
        { icon: Car, label: 'Vehicle Check', sub: 'Daily walk-round in Mitti' },
        { icon: ShieldCheck, label: 'POWRA', sub: 'On arrival at site' },
      ];

  return (
    <button
      onClick={onStart}
      type="button"
      className="w-full text-left active:scale-[0.98] transition touch-manipulation"
    >
      <div className="field-card overflow-hidden">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ui-body font-bold text-white leading-tight">Start My Day</p>
            <p className="text-ui-micro text-white/75 truncate">Complete safety checks before you start work</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 text-white text-ui-caption font-bold">
            <Play className="w-3.5 h-3.5" /> Begin
          </div>
        </div>

        {/* Step sequence */}
        <div className="px-4 py-3 flex items-center gap-2">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-primary" strokeWidth={2.5} />
                </div>
                <p className="text-ui-micro font-bold text-slate-700 text-center leading-tight truncate w-full">{step.label}</p>
                <p className="text-ui-micro text-slate-400 text-center leading-tight truncate w-full hidden sm:block">{step.sub}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </button>
  );
}