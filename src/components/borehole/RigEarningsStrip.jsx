import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Cog, Mountain, ArrowDownToLine, PoundSterling, ChevronRight, AlertCircle,
} from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import { computeRigEarnings } from '@/utils/rigEarnings';
import RigDrillDownModal from '@/components/borehole/RigDrillDownModal';

const RIG_COLORS = [
  { tile: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', bar: '#10b981', accent: 'text-emerald-700' },
  { tile: 'bg-blue-50', icon: 'bg-blue-100 text-blue-700', bar: '#3b82f6', accent: 'text-blue-700' },
  { tile: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700', bar: '#f59e0b', accent: 'text-amber-700' },
  { tile: 'bg-violet-50', icon: 'bg-violet-100 text-violet-700', bar: '#8b5cf6', accent: 'text-violet-700' },
  { tile: 'bg-rose-50', icon: 'bg-rose-100 text-rose-700', bar: '#f43f5e', accent: 'text-rose-700' },
  { tile: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-700', bar: '#06b6d4', accent: 'text-cyan-700' },
  { tile: 'bg-slate-100', icon: 'bg-slate-200 text-slate-600', bar: '#64748b', accent: 'text-slate-600' },
];

/**
 * RigEarningsStrip — horizontal row of clickable rig tiles showing each rig's
 * borehole count, total metres, and earnings (metres × rate cards). Clicking a
 * tile opens the RigDrillDownModal with the rig's boreholes, activity timeline,
 * and the KeyLogBook logger.
 *
 * Props:
 *  - boreholes: [[ref, logs], ...] — the grouped borehole array from BoreholeDrillDown
 *  - sorItems: InvestigationSOR records for the job
 *  - job: the Job record (for meterage_rate)
 */
export default function RigEarningsStrip({ boreholes = [], sorItems = [], job = null }) {
  const [selectedRig, setSelectedRig] = useState(null);

  // Staff list for logger → Staff resolution in the drill-down modal
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-rig-earnings'],
    queryFn: () => base44.entities.Staff.list(),
    staleTime: 60000,
  });

  // Flatten the grouped boreholes into a single log array (deduped by id)
  const allLogs = useMemo(() => {
    const seen = new Set();
    const out = [];
    boreholes.forEach(([, logs]) => {
      logs.forEach((l) => {
        if (l.id && !seen.has(l.id)) { seen.add(l.id); out.push(l); }
        else if (!l.id) out.push(l);
      });
    });
    return out;
  }, [boreholes]);

  const { perRig, totals } = useMemo(
    () => computeRigEarnings({ logs: allLogs, sorItems, job }),
    [allLogs, sorItems, job]
  );

  if (perRig.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Cog className="w-4 h-4 text-emerald-700" />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">Rig Earnings</h3>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {perRig.length} rig{perRig.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <ArrowDownToLine className="w-3 h-3 text-blue-500" />
            <AnimatedNumber value={totals.metres} format={(v) => `${Math.round(v)}m`} />
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
            <PoundSterling className="w-3 h-3" />
            <AnimatedNumber value={totals.earnings} format={(v) => `£${Math.round(v).toLocaleString('en-GB')}`} />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {perRig.map((rig, i) => {
          const c = RIG_COLORS[i % RIG_COLORS.length];
          return (
            <button
              key={rig.key}
              onClick={() => setSelectedRig(rig)}
              className={`hub-glass rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${c.tile} group`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
                  <Cog className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{rig.name}</p>
                  {rig.isDrillerFallback && (
                    <p className="text-[9px] text-amber-600 font-medium inline-flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> rig not tagged
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <Mountain className="w-3 h-3" /> Boreholes
                  </span>
                  <span className="font-semibold text-slate-700 tabular-nums">{rig.boreholeCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <ArrowDownToLine className="w-3 h-3" /> Metres
                  </span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    <AnimatedNumber value={rig.totalMetres} format={(v) => `${Math.round(v)}m`} />
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <PoundSterling className="w-3 h-3" /> Earned
                  </span>
                  <span className={`font-bold tabular-nums ${c.accent}`}>
                    {rig.hasRate ? (
                      <AnimatedNumber value={rig.earnings} format={(v) => `£${Math.round(v).toLocaleString('en-GB')}`} />
                    ) : (
                      <span className="text-slate-400 text-[10px]">No rate</span>
                    )}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedRig && (
        <RigDrillDownModal
          rigName={selectedRig.name}
          isDrillerFallback={selectedRig.isDrillerFallback}
          logs={selectedRig.logs}
          sorItems={sorItems}
          job={job}
          staffList={staffList}
          boreholeCount={selectedRig.boreholeCount}
          totalMetres={selectedRig.totalMetres}
          earnings={selectedRig.earnings}
          onClose={() => setSelectedRig(null)}
        />
      )}
    </div>
  );
}