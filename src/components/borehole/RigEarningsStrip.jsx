import React, { useMemo } from 'react';
import { Cog, Mountain, ArrowDownToLine, PoundSterling } from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import { allocateDepthBands, getSorDepthBands } from '@/utils/geotechBilling';

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
 * RigEarningsStrip — horizontal row of rig tiles showing each rig's borehole
 * count, total metres, and earnings (metres × SOR depth-band rates).
 *
 * Props:
 *  - boreholes: [[ref, logs], ...] — the grouped borehole array from BoreholeDrillDown
 *  - sorItems: InvestigationSOR records for the job (or all — filtered client-side)
 */
export default function RigEarningsStrip({ boreholes = [], sorItems = [] }) {
  const rigData = useMemo(() => {
    const sorDepthBands = getSorDepthBands(sorItems);
    const rigs = {};

    boreholes.forEach(([, logs]) => {
      // Get the rig name from device_name on borehole_progress logs
      const progressLog = logs.find(l => l.log_type === 'borehole_progress');
      const rigName = progressLog?.device_name || 'Unassigned';

      if (!rigs[rigName]) rigs[rigName] = { name: rigName, boreholes: new Set(), totalMetres: 0, depths: [] };

      rigs[rigName].boreholes.add(progressLog?.borehole_ref || logs[0]?.borehole_ref);

      // Sum max depth per borehole
      const depths = logs.map(l => l.depth_to).filter(d => d != null);
      if (depths.length) {
        const maxDepth = Math.max(...depths);
        rigs[rigName].totalMetres += maxDepth;
        rigs[rigName].depths.push(maxDepth);
      }
    });

    // Calculate earnings per rig using SOR depth-band rates
    return Object.values(rigs).map(rig => {
      // Allocate all borehole depths across 10m bands, then match to SOR rates
      let earnings = 0;
      rig.depths.forEach(depth => {
        const bands = allocateDepthBands(depth);
        bands.forEach(band => {
          const sor = sorDepthBands.find(s => s.from === band.from && s.to === band.to);
          if (sor?.price != null) {
            earnings += band.metres * sor.price;
          }
        });
      });
      return {
        name: rig.name,
        boreholeCount: rig.boreholes.size,
        totalMetres: Math.round(rig.totalMetres * 100) / 100,
        earnings: Math.round(earnings * 100) / 100,
        hasRate: earnings > 0,
      };
    }).sort((a, b) => b.earnings - a.earnings);
  }, [boreholes, sorItems]);

  if (rigData.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Cog className="w-4 h-4 text-emerald-700" />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">Rig Earnings</h3>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {rigData.length} rig{rigData.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {rigData.map((rig, i) => {
          const c = RIG_COLORS[i % RIG_COLORS.length];
          return (
            <div key={rig.name} className={`insight-card rounded-xl p-4 ${c.tile}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
                  <Cog className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-slate-800 truncate">{rig.name}</p>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}