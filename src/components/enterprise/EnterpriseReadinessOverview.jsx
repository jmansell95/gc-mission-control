import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useReadiness, STATE_ACTIVE, STATE_COMING_SOON, STATE_LOCKED } from '@/hooks/useReadiness';
import { FEATURE_REGISTRY, HUB_ORDER } from '@/utils/featureRegistry';
import {
  Zap, Check, Clock, Lock, Grid3x3, Briefcase, Calendar,
  Truck, Boxes, Car, FlaskConical, ShieldCheck, PoundSterling, Users,
} from 'lucide-react';

const HUB_ICONS = {
  dashboard: Grid3x3, overview: Grid3x3, jobs: Briefcase, scheduling: Calendar,
  staff: Users, logistics: Truck, assets: Boxes, fleet: Car,
  investigation: FlaskConical, compliance: ShieldCheck, billing: PoundSterling,
  settings: Grid3x3,
};

// Map feature registry hub IDs to division enabled_hubs IDs
const HUB_ID_MAP = {
  dashboard: 'overview',
  settings: 'settings',
};

const STATE_BADGE = {
  [STATE_ACTIVE]: { label: 'Active', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  [STATE_COMING_SOON]: { label: 'Soon', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  [STATE_LOCKED]: { label: 'Locked', color: 'bg-slate-200 text-slate-500', dot: 'bg-slate-400' },
};

/**
 * Enterprise Readiness Overview — cross-division view showing the global
 * readiness state of each hub plus which divisions have each hub enabled.
 * Shown on the Enterprise Dashboard (no division context).
 */
export default function EnterpriseReadinessOverview() {
  const { permittedDivisions } = useDivision();
  const { states, isLoading } = useReadiness();

  // Only show hubs that are in the HUB_ORDER list and have registry entries
  const hubs = useMemo(() => {
    return HUB_ORDER.filter(h => FEATURE_REGISTRY[h] && HUB_ICONS[h]);
  }, []);

  if (isLoading) {
    return (
      <section className="hub-glass rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Readiness Overview</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  const activeCount = hubs.filter(h => states[h] === STATE_ACTIVE).length;
  const comingSoonCount = hubs.filter(h => states[h] === STATE_COMING_SOON).length;
  const lockedCount = hubs.filter(h => states[h] === STATE_LOCKED).length;

  return (
    <section className="hub-glass rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-extrabold text-slate-900">Readiness Overview</h2>
          <p className="text-xs text-slate-500">Global hub states + per-division enablement</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
          <Check className="w-3 h-3" /> {activeCount} Active
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
          <Clock className="w-3 h-3" /> {comingSoonCount} Soon
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-500">
          <Lock className="w-3 h-3" /> {lockedCount} Locked
        </span>
      </div>

      {/* Hub rows */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto -mx-1 px-1">
        {hubs.map(hubId => {
          const hub = FEATURE_REGISTRY[hubId];
          const Icon = HUB_ICONS[hubId];
          const state = states[hubId] || STATE_ACTIVE;
          const badge = STATE_BADGE[state];
          // Per-division enablement — map registry ID to division's enabled_hubs ID
          const divHubId = HUB_ID_MAP[hubId] || hubId;
          const divEnabled = permittedDivisions.map(d => {
            const hubs = d.enabled_hubs || [];
            const enabled = hubs.length === 0 ? true : hubs.includes(divHubId);
            return { division: d, enabled };
          });
          return (
            <div key={hubId} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{hub.label}</p>
                {/* Per-division dots */}
                <div className="flex items-center gap-1 mt-1">
                  {divEnabled.map(ds => (
                    <div key={ds.division.id}
                      title={ds.division.name + ': ' + (ds.enabled ? 'Enabled' : 'Disabled')}
                      className={'w-2 h-2 rounded-full ' + (ds.enabled ? 'bg-emerald-500' : 'bg-slate-300')}
                    />
                  ))}
                </div>
              </div>
              {/* Global readiness state */}
              <span className={'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ' + badge.color}>
                <span className={'w-1.5 h-1.5 rounded-full ' + badge.dot} />
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Hub enabled in division</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Hub disabled</span>
      </div>
    </section>
  );
}