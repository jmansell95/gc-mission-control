import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, Users, PoundSterling, Wrench, Trophy,
  Loader2, ArrowRight, Briefcase, Clock, AlertCircle,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => (n > 0 ? '+' : '') + Number(n || 0).toFixed(1) + '%';

/**
 * PerformanceOverviewTab — combined rig + crew intelligence in one view.
 * Shows top-level KPIs, top-3 rigs, top-3 crews, and alerts for rigs
 * needing maintenance. Everything links to the detailed views.
 */
export default function PerformanceOverviewTab({ dateRange, onSelectJob, onGoToTab }) {
  const { data: rigData, isLoading: rigsLoading } = useQuery({
    queryKey: ['rig-profitability', dateRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRigProfitability', dateRange);
      return res.data || res;
    },
  });

  const { data: crewData, isLoading: crewsLoading } = useQuery({
    queryKey: ['crew-earnings', dateRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCrewEarnings', dateRange);
      return res.data || res;
    },
  });

  const { data: pendingPricing = [] } = useQuery({
    queryKey: ['pricing-review-pending-count'],
    queryFn: () => base44.entities.InvestigationLog.filter({ pricing_review_status: 'pending_review' }, '-created_date', 1),
  });

  const isLoading = rigsLoading || crewsLoading;

  const topRigs = useMemo(() => {
    if (!rigData?.rigs) return [];
    return [...rigData.rigs].filter(r => r.earned > 0).sort((a, b) => b.earned - a.earned).slice(0, 3);
  }, [rigData]);

  const topCrews = useMemo(() => {
    if (!crewData?.crews) return [];
    return [...crewData.crews].sort((a, b) => b.total_earned - a.total_earned).slice(0, 3);
  }, [crewData]);

  const maintenanceAlerts = useMemo(() => {
    if (!rigData?.rigs) return [];
    return rigData.rigs.filter(r => r.maintenance_status === 'overdue' || r.maintenance_status === 'due_soon');
  }, [rigData]);

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const rigTotals = rigData?.totals || {};
  const crewTotals = crewData?.totals || {};
  const pendingCount = pendingPricing.length;

  return (
    <div className="space-y-3">
      {/* Combined KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard icon={PoundSterling} label="Total Revenue" value={fmt(rigTotals.total_earned)} gradient="stat-gradient-brand" />
        <KPICard icon={Wrench} label="Rig Costs" value={fmt(rigTotals.total_cost)} gradient="stat-gradient-rose" />
        <KPICard icon={TrendingUp} label="Net Margin" value={fmt(rigTotals.total_margin)} gradient="stat-gradient-emerald" />
        <KPICard icon={Users} label="Active Crews" value={crewTotals.crews_count || 0} gradient="stat-gradient-blue" />
      </div>

      {/* Alerts row */}
      {(maintenanceAlerts.length > 0 || pendingCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {maintenanceAlerts.length > 0 && (
            <button
              onClick={() => onGoToTab?.('rig-profitability')}
              className="hub-glass rounded-2xl p-3 flex items-center gap-3 bg-amber-50 border-amber-200 hover:bg-amber-100/60 transition text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-800">{maintenanceAlerts.length} rig{maintenanceAlerts.length !== 1 ? 's' : ''} need maintenance</p>
                <p className="text-[11px] text-amber-700 truncate">
                  {maintenanceAlerts.slice(0, 2).map(r => r.rig_name).join(', ')}{maintenanceAlerts.length > 2 ? '…' : ''}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
            </button>
          )}
          {pendingCount > 0 && (
            <div className="hub-glass rounded-2xl p-3 flex items-center gap-3 bg-amber-50 border-amber-200">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-800">{pendingCount} log{pendingCount !== 1 ? 's' : ''} awaiting pricing</p>
                <p className="text-[11px] text-amber-700">Review in the Billing hub → AFP Portfolio</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top rigs + Top crews side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Rigs */}
        <div className="hub-glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-[#2E5A1A]/5 to-[#8DC63F]/5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Top Performing Rigs</h3>
                <p className="text-[10px] text-slate-400">By revenue earned</p>
              </div>
            </div>
            <button
              onClick={() => onGoToTab?.('rig-profitability')}
              className="text-[11px] font-semibold text-[#2E5A1A] hover:text-[#5A8C1E] transition inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {topRigs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No rig revenue in this period</p>
            ) : (
              topRigs.map((rig, i) => {
                const isProfit = rig.margin >= 0;
                return (
                  <div key={rig.rig_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50/80 transition">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{rig.rig_name}</p>
                      <p className="text-[10px] text-slate-400">{rig.jobs_count} jobs · {rig.operating_hours}h</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(rig.earned)}</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${isProfit ? 'text-emerald-600' : 'text-rose-500'}`}>{fmtPct(rig.margin_pct)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Crews */}
        <div className="hub-glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Top Earning Crews</h3>
                <p className="text-[10px] text-slate-400">By total revenue generated</p>
              </div>
            </div>
            <button
              onClick={() => onGoToTab?.('crew-earnings')}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {topCrews.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No crew earnings in this period</p>
            ) : (
              topCrews.map((crew, i) => (
                <div key={crew.team_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50/80 transition">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{crew.team_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase">{crew.job_type} · {crew.jobs_count} jobs</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(crew.total_earned)}</p>
                    <p className="text-[10px] text-slate-400">{crew.job_breakdown?.length || 0} jobs</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick links to other hubs */}
      <div className="hub-glass rounded-2xl p-3.5">
        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Quick Links</p>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/billing"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95"
          >
            <PoundSterling className="w-3.5 h-3.5" /> AFP Portfolio
          </a>
          <a
            href="/billing"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95"
          >
            <Briefcase className="w-3.5 h-3.5" /> CVR Export
          </a>
          <a
            href="/assets"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95"
          >
            <Wrench className="w-3.5 h-3.5" /> Rig Assets
          </a>
          <a
            href="/staff"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95"
          >
            <Users className="w-3.5 h-3.5" /> Crews & Staff
          </a>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, gradient }) {
  return (
    <div className="hub-glass rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-[0.08]`} />
      <div className={`relative w-9 h-9 rounded-lg ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="relative text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}