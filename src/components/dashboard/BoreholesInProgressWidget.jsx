import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mountain, CheckCircle2, CircleDashed, ChevronRight, Ruler, Percent } from 'lucide-react';
import { motion } from 'framer-motion';
import { setInvestigationHubDeepLink } from '@/utils/investigationDeepLink';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import WidgetActionFooter from '@/components/dashboard/WidgetActionFooter';

/**
 * Boreholes in Progress — Command Centre dashboard widget.
 * Shows live counts of in-progress, unchecked, and completed boreholes
 * across active drilling jobs, plus completion rate % and average depth.
 * Deep-links to the Investigation Hub pre-filtered to in-progress holes.
 * Quick-action opens the Investigation Hub showing all boreholes.
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

  // New stats: completion rate % + average depth
  const completionRate = counts.total > 0 ? Math.round((counts.complete / counts.total) * 100) : 0;
  const avgDepth = React.useMemo(() => {
    const withDepth = boreholes.filter(b => b.depth_to != null);
    if (withDepth.length === 0) return 0;
    return withDepth.reduce((s, b) => s + (b.depth_to || 0), 0) / withDepth.length;
  }, [boreholes]);

  const handleClick = () => {
    setInvestigationHubDeepLink({ boreholeStatus: 'in_progress' });
    onNavigate?.('investigation');
  };

  const handleViewAll = () => {
    setInvestigationHubDeepLink({ boreholeStatus: 'all' });
    onNavigate?.('investigation');
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3.5 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <Mountain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Boreholes in Progress</h3>
              <p className="text-[11px] text-white/70">Loading…</p>
            </div>
          </div>
        </div>
        <div className="p-4 flex-1">
          <WidgetLoadingState rows={3} />
        </div>
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <div className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3.5 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <Mountain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Boreholes in Progress</h3>
              <p className="text-[11px] text-white/70">No data yet</p>
            </div>
          </div>
        </div>
        <div className="p-4 flex-1">
          <WidgetEmptyState icon={Mountain} title="No borehole data" message="No borehole data synced yet." />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <Mountain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Boreholes in Progress</h3>
              <p className="text-[11px] text-white/70">{counts.inProgress} active · {counts.total} total</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Main in-progress number */}
        <div className="flex items-end gap-1.5 mb-3">
          <span className="text-3xl font-bold text-amber-600 tabular-nums leading-none">
            <AnimatedNumber value={counts.inProgress} />
          </span>
          <span className="text-xs text-slate-500 font-medium mb-0.5">in progress</span>
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatChip icon={CircleDashed} value={counts.unchecked} label="Unchecked" color="slate" />
          <StatChip icon={CheckCircle2} value={counts.complete} label="Completed" color="emerald" />
          <StatChip icon={Mountain} value={counts.total} label="Total" color="blue" />
        </div>

        {/* New stats: completion rate + avg depth */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Percent className="w-3 h-3 text-emerald-600" />
              <span className="text-base font-bold tabular-nums text-emerald-700 leading-none">
                <AnimatedNumber value={completionRate} format={(v) => `${Math.round(v)}%`} />
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">completion rate</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Ruler className="w-3 h-3 text-blue-600" />
              <span className="text-base font-bold tabular-nums text-blue-700 leading-none">
                {avgDepth > 0 ? <AnimatedNumber value={avgDepth} format={(v) => `${v.toFixed(1)}m`} /> : '—'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">avg depth</p>
          </div>
        </div>

        {/* Footer — deep-link + quick-action */}
        <div className="mt-auto">
          <WidgetActionFooter
            deepLinkLabel="In Progress"
            onDeepLink={handleClick}
            quickActionLabel="All Boreholes"
            onQuickAction={handleViewAll}
          />
        </div>
      </div>
    </div>
  );
}

const CHIP_COLORS = {
  slate: 'bg-slate-50 text-slate-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
};

function StatChip({ icon: Icon, value, label, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={`rounded-lg px-2 py-2 ${CHIP_COLORS[color] || CHIP_COLORS.slate}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 opacity-70" />
        <span className="text-base font-bold tabular-nums leading-none">{value}</span>
      </div>
      <p className="text-[10px] font-medium opacity-80 leading-tight">{label}</p>
    </motion.div>
  );
}