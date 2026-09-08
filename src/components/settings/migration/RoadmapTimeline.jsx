import React from 'react';
import { Map, CheckCircle2, ArrowRight } from 'lucide-react';
import { PHASE_TIMELINE, totalWeeks } from '@/utils/powerapps/migrationPhases';

export default function RoadmapTimeline() {
  const total = totalWeeks();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Map className="w-5 h-5 text-[#2E5A1A]" />
        <h3 className="font-bold text-slate-900 text-sm">Migration Roadmap — {total} weeks critical path</h3>
      </div>

      <div className="p-4 space-y-1">
        {PHASE_TIMELINE.map((phase, i) => {
          const isLast = i === PHASE_TIMELINE.length - 1;
          return (
            <div key={phase.n} className="flex gap-3">
              {/* Timeline rail */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {phase.n}
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-0.5" style={{ minHeight: '1.5rem' }} />}
              </div>

              {/* Phase content */}
              <div className="flex-1 pb-4">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-900">{phase.name}</p>
                  <span className="text-xs font-semibold text-[#2E5A1A] bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {phase.weeks} weeks
                  </span>
                </div>
                {phase.deps.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                    <ArrowRight className="w-3 h-3" />
                    Depends on: {phase.deps.map(d => `Phase ${d}`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <p className="text-xs text-slate-600">
          Phases 3 &amp; 4 (Model-Driven + Canvas) run in parallel after Phase 2. Phases 5–7 overlap once their dependencies complete.
          Total elapsed time: <strong>{total} weeks</strong> (~{Math.round(total / 4.33)} months).
        </p>
      </div>
    </div>
  );
}