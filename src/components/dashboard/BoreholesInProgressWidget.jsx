import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mountain, CheckCircle2, CircleDashed, ArrowRight } from 'lucide-react';
import { setInvestigationHubDeepLink } from '@/utils/investigationDeepLink';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';

/**
 * Boreholes in Progress — Command Centre dashboard widget.
 * Shows live counts of in-progress, unchecked, and completed boreholes
 * across active drilling jobs. Clicking the widget drills through to the
 * Investigation Hub pre-filtered to in-progress holes.
 *
 * Self-contained: fetches its own data (borehole_progress logs with a
 * borehole_status) so the CommandCentreGrid can drag/resize/hide it
 * without any data plumbing from the parent page.
 */
export default function BoreholesInProgressWidget({ onNavigate }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['boreholes-in-progress-widget'],
    queryFn: () => base44.entities.InvestigationLog.filter({
      log_type: 'borehole_progress',
      source: 'ags_import',
    }, '-created_date', 500),
  });

  // Deduplicate by borehole_ref — only one borehole_progress log per hole
  // carries the status. If multiple exist (re-imports), the latest wins.
  const boreholes = React.useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!l.borehole_ref) return;
      map[l.borehole_ref] = l; // last one wins (sorted -created_date)
    });
    return Object.values(map);
  }, [logs]);

  const counts = React.useMemo(() => {
    let inProgress = 0, unchecked = 0, complete = 0, noStatus = 0;
    boreholes.forEach(b => {
      const s = b.borehole_status;
      if (s === 'in_progress') inProgress++;
      else if (s === 'unchecked') unchecked++;
      else if (s === 'complete') complete++;
      else noStatus++;
    });
    return { inProgress, unchecked, complete, noStatus, total: boreholes.length };
  }, [boreholes]);

  const handleClick = () => {
    setInvestigationHubDeepLink({ boreholeStatus: 'in_progress' });
    onNavigate?.('investigation');
  };

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-4 h-full">
        <WidgetLoadingState rows={3} />
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <div className="insight-card rounded-2xl p-4 h-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Mountain className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Boreholes</h3>
        </div>
        <WidgetEmptyState icon={Mountain} title="No borehole data" message="No borehole data synced yet." />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="insight-card rounded-2xl p-4 h-full w-full text-left hover:shadow-lg transition group"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition">
          <Mountain className="w-4 h-4 text-amber-700" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Boreholes in Progress</h3>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition ml-auto" />
      </div>

      {/* Main in-progress number */}
      <div className="flex items-end gap-1.5 mb-3">
        <span className="text-3xl font-bold text-amber-600 tabular-nums leading-none">{counts.inProgress}</span>
        <span className="text-xs text-slate-500 font-medium mb-0.5">in progress</span>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatChip
          icon={CircleDashed}
          value={counts.unchecked}
          label="Unchecked"
          color="slate"
        />
        <StatChip
          icon={CheckCircle2}
          value={counts.complete}
          label="Completed"
          color="emerald"
        />
        <StatChip
          icon={Mountain}
          value={counts.total}
          label="Total"
          color="blue"
        />
      </div>
    </button>
  );
}

const CHIP_COLORS = {
  slate: 'bg-slate-50 text-slate-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
};

function StatChip({ icon: Icon, value, label, color }) {
  return (
    <div className={`rounded-lg px-2 py-2 ${CHIP_COLORS[color] || CHIP_COLORS.slate}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 opacity-70" />
        <span className="text-base font-bold tabular-nums leading-none">{value}</span>
      </div>
      <p className="text-[10px] font-medium opacity-80 leading-tight">{label}</p>
    </div>
  );
}