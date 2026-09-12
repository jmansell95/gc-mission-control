import React from 'react';
import { Truck, ChevronRight, Car, ClipboardCheck, PackageCheck, Play } from 'lucide-react';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';

/**
 * StartMyRunHero — prominent hero card for drivers, showing the pre-departure
 * safety sequence (Vehicle Check → Load Check → Start First Stop) before they
 * begin their delivery run. Mirrors the StartMyDayHero pattern used by drillers.
 *
 * Props:
 *  - onStart: () => void  — scrolls to / opens the first delivery of the day
 *  - hasStops: boolean     — whether there are deliveries today (hides hero if none)
 */
export default function StartMyRunHero({ onStart, hasStops = true }) {
  const { vehicleCheckUrl } = useMittiCheckLinks();

  if (!hasStops) return null;

  const steps = [
    { icon: Car, label: 'Vehicle Check', sub: 'Daily walk-round in Mitti' },
    { icon: PackageCheck, label: 'Load Check', sub: 'Confirm load is safe' },
    { icon: Truck, label: 'First Stop', sub: 'Start your delivery run' },
  ];

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Header bar */}
      <button
        onClick={onStart}
        type="button"
        className="w-full text-left bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Start My Run</p>
          <p className="text-[11px] text-white/75 truncate">Complete pre-departure checks before you drive</p>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold">
          <Play className="w-3.5 h-3.5" /> Begin
        </div>
      </button>

      {/* Step sequence */}
      <div className="px-4 py-3 flex items-center gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
                <step.icon className="w-4 h-4 text-primary" strokeWidth={2.5} />
              </div>
              <p className="text-[10px] font-bold text-slate-700 text-center leading-tight truncate w-full">{step.label}</p>
              <p className="text-[9px] text-slate-400 text-center leading-tight truncate w-full hidden sm:block">{step.sub}</p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mitti vehicle check link */}
      {vehicleCheckUrl && (
        <div className="px-4 pb-3">
          <a
            href={vehicleCheckUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-primary/8 text-primary text-sm font-bold active:scale-[0.98] transition touch-manipulation"
          >
            <ClipboardCheck className="w-4 h-4" />
            Open Mitti Vehicle Check
          </a>
        </div>
      )}
    </div>
  );
}