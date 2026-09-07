import React, { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, Mountain, ChevronRight, TrendingUp, Cog } from 'lucide-react';
import { format } from 'date-fns';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import { computeRigEarnings } from '@/utils/rigEarnings';
import { setInvestigationHubDeepLink } from '@/utils/investigationDeepLink';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

/**
 * LiveDrillingRevenueWidget — hero tile showing today's drilling revenue
 * and meterage, aggregated from KeyLogBook InvestigationLog entries × rate
 * cards. Deep-links to the Investigation Hub scoped to today's logs.
 */
export default function LiveDrillingRevenueWidget({ onNavigate }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const queryClient = useQueryClient();

  // Auto-refresh every 4 minutes
  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['rev-bento-logs'] });
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [queryClient]);

  const { data: todayLogs = [], isLoading } = useQuery({
    queryKey: ['rev-bento-logs', 'today'],
    queryFn: async () => {
      const filter = { source: { $in: ['ags_import', 'keylogbook_remarks'] } };
      const logs = await base44.entities.InvestigationLog.filter(filter, '-created_date', 500);
      return logs.filter((l) => l.date === todayStr);
    },
  });

  const { data: sorItems = [] } = useQuery({
    queryKey: ['rev-bento-sor'],
    queryFn: () => base44.entities.InvestigationSOR.list('-created_date', 500),
    staleTime: 60000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['rev-bento-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const liveToday = useMemo(
    () => computeRigEarnings({ logs: todayLogs, sorItems, job: null }),
    [todayLogs, sorItems]
  );

  const handleClick = () => {
    setInvestigationHubDeepLink({ dateFilter: 'today' });
    if (onNavigate) onNavigate('investigation');
    else navigate('/admin');
  };

  const totalRevenue = liveToday.totals.earnings;
  const totalMetres = liveToday.totals.metres;
  const totalBoreholes = liveToday.totals.boreholes;
  const activeRigs = liveToday.totals.rigs;
  const topRigs = liveToday.perRig.slice(0, 4);

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 min-h-[280px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-md">
            <PoundSterling className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Live Drilling Revenue</h3>
        </div>
        <WidgetLoadingState rows={4} />
      </div>
    );
  }

  return (
    <div
      className="insight-card rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <PoundSterling className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Live Drilling Revenue</h3>
              <p className="text-[11px] text-white/70">Today · {format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {totalMetres === 0 && totalRevenue === 0 ? (
          <WidgetEmptyState icon={Mountain} title="No drilling today" message="No KeyLogBook logs synced for today yet." />
        ) : (
          <>
            {/* Big revenue number */}
            <div className="mb-4">
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold text-emerald-600 tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
                <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
              </div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1.5">Earned Today</p>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Mountain className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{totalMetres.toFixed(1)}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">metres drilled</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Cog className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{totalBoreholes}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">boreholes</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{activeRigs}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">active rigs</p>
              </div>
            </div>

            {/* Top rigs by revenue */}
            {topRigs.length > 0 && (
              <div className="space-y-0.5 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Top rigs today</p>
                {topRigs.map((r, i) => (
                  <div key={r.key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <Cog className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{r.name}</p>
                      <p className="text-[10px] text-slate-400">{r.boreholeCount} holes · {r.totalMetres.toFixed(1)}m</p>
                    </div>
                    <p className="text-xs font-bold text-emerald-600 tabular-nums flex-shrink-0">
                      {r.hasRate ? fmtGBP(r.earnings) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}