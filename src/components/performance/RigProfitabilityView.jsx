import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, Loader2, Search,
  Trophy, Wrench, Clock, PoundSterling,
  ChevronDown, ChevronRight, Briefcase, ArrowRight, AlertCircle,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => (n > 0 ? '+' : '') + Number(n || 0).toFixed(1) + '%';

/**
 * RigProfitabilityView — shows each rig's earned vs cost with margin %.
 * Expandable rows show per-job breakdown (including jobs with £0 earned so
 * no rigged job goes missing). A "no cost data" flag warns when a rig's cost
 * is £0 (margin may be overstated because no rate-card cost was recorded).
 */
export default function RigProfitabilityView({ dateRange, onSelectJob }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['rig-profitability', dateRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRigProfitability', dateRange);
      return res.data || res;
    },
  });

  const rigs = useMemo(() => {
    if (!data?.rigs) return [];
    let result = data.rigs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => (r.rig_name || '').toLowerCase().includes(q));
    }
    return result;
  }, [data, search]);

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!data?.rigs || data.rigs.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No rigs found</p>
        <p className="text-xs text-slate-400 mt-1">Rigs are identified by the <span className="font-semibold">is_rig</span> flag (synced from Asset Panda). Assign rigs to jobs to see profitability.</p>
      </div>
    );
  }

  const totals = data.totals || {};
  const activeRigs = rigs.filter(r => r.earned > 0 || r.jobs_count > 0);
  const rigsMissingCost = rigs.filter(r => r.earned > 0 && !r.has_cost_data);

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard icon={PoundSterling} label="Total Earned" value={fmt(totals.total_earned)} gradient="stat-gradient-brand" />
        <KPICard icon={Wrench} label="Total Cost" value={fmt(totals.total_cost)} gradient="stat-gradient-rose" />
        <KPICard icon={TrendingUp} label="Total Margin" value={fmt(totals.total_margin)} gradient="stat-gradient-emerald" />
        <KPICard icon={Trophy} label="Active Rigs" value={activeRigs.length} gradient="stat-gradient-amber" />
      </div>

      {/* Missing-cost warning */}
      {rigsMissingCost.length > 0 && (
        <div className="hub-glass rounded-2xl p-3 flex items-start gap-2.5 bg-amber-50 border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-800">{rigsMissingCost.length} rig{rigsMissingCost.length !== 1 ? 's' : ''} showing £0 cost</p>
            <p className="text-[11px] text-amber-700">Margin is overstated — link a rate card with a cost price on these rigs so cost is captured: {rigsMissingCost.slice(0, 3).map(r => r.rig_name).join(', ')}{rigsMissingCost.length > 3 ? '…' : ''}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rigs…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
        />
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2.5">
        {rigs.map((rig, i) => {
          const isProfit = rig.margin >= 0;
          const isOpen = expanded.has(rig.rig_id);
          const hasJobs = rig.job_breakdown && rig.job_breakdown.length > 0;
          return (
            <div key={rig.rig_id} className="hub-glass rounded-2xl overflow-hidden relative">
              {i === 0 && rig.earned > 0 && (
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-bl-lg flex items-center gap-1 z-10">
                  <Trophy className="w-2.5 h-2.5" /> TOP
                </div>
              )}
              <button
                onClick={() => hasJobs && toggle(rig.rig_id)}
                className="w-full p-3.5 text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    {hasJobs && (isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />)}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{rig.rig_name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{rig.rig_type} · {rig.jobs_count} job{rig.jobs_count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {fmtPct(rig.margin_pct)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="px-1.5 py-1.5 rounded-lg bg-emerald-50">
                    <p className="text-[9px] text-emerald-600 uppercase font-semibold">Earned</p>
                    <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(rig.earned)}</p>
                  </div>
                  <div className="px-1.5 py-1.5 rounded-lg bg-rose-50">
                    <p className="text-[9px] text-rose-600 uppercase font-semibold">Cost</p>
                    <p className={`text-xs font-bold tabular-nums ${rig.has_cost_data ? 'text-rose-600' : 'text-slate-400'}`}>{rig.has_cost_data ? fmt(rig.cost) : '—'}</p>
                  </div>
                  <div className={`px-1.5 py-1.5 rounded-lg ${isProfit ? 'bg-slate-50' : 'bg-rose-50'}`}>
                    <p className="text-[9px] text-slate-400 uppercase font-semibold">Margin</p>
                    <p className={`text-xs font-bold tabular-nums ${isProfit ? 'text-slate-700' : 'text-rose-600'}`}>{fmt(rig.margin)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {rig.operating_hours}h</span>
                  <span className={`inline-flex items-center gap-1 ${rig.maintenance_status === 'overdue' ? 'text-rose-500' : rig.maintenance_status === 'due_soon' ? 'text-amber-500' : ''}`}>
                    ● {rig.maintenance_status}
                  </span>
                </div>
              </button>
              {isOpen && hasJobs && (
                <div className="px-3.5 pb-3 space-y-1 border-t border-slate-100 pt-2">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Job Breakdown</p>
                  {rig.job_breakdown.map((jb, j) => (
                    <button
                      key={j}
                      onClick={() => onSelectJob?.(jb.job_id)}
                      className="w-full flex items-center justify-between gap-2 text-xs py-1 hover:bg-emerald-50/50 rounded-lg px-1.5 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600 truncate">{jb.job_name}</span>
                        {jb.job_reference && <span className="text-[9px] text-slate-400">({jb.job_reference})</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="font-semibold text-slate-700 tabular-nums">{fmt(jb.earned)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hub-glass rounded-2xl overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-2.5 font-semibold">Rank</th>
                <th className="text-left px-3 py-2.5 font-semibold">Rig</th>
                <th className="text-center px-3 py-2.5 font-semibold">Type</th>
                <th className="text-right px-3 py-2.5 font-semibold">Jobs</th>
                <th className="text-right px-3 py-2.5 font-semibold">Hours</th>
                <th className="text-right px-3 py-2.5 font-semibold">Earned</th>
                <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
                <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
                <th className="text-right px-3 py-2.5 font-semibold">Margin %</th>
                <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rigs.map((rig, i) => {
                const isProfit = rig.margin >= 0;
                const isOpen = expanded.has(rig.rig_id);
                const hasJobs = rig.job_breakdown && rig.job_breakdown.length > 0;
                return (
                  <React.Fragment key={rig.rig_id}>
                    <tr
                      onClick={() => hasJobs && toggle(rig.rig_id)}
                      className={`hover:bg-emerald-50/30 transition ${hasJobs ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        {i === 0 && rig.earned > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                            <Trophy className="w-3 h-3" /> {i + 1}
                          </span>
                        ) : (
                          <span className="text-slate-400 tabular-nums">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {hasJobs && (isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />)}
                          <span className="font-semibold text-slate-800">{rig.rig_name}</span>
                          {!rig.has_cost_data && rig.earned > 0 && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded-full" title="No rate-card cost recorded — margin overstated">no cost</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5 text-slate-500 uppercase text-[10px]">{rig.rig_type}</td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{rig.jobs_count}</td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{rig.operating_hours}h</td>
                      <td className="text-right px-3 py-2.5 font-semibold text-emerald-700 tabular-nums">{fmt(rig.earned)}</td>
                      <td className={`text-right px-3 py-2.5 tabular-nums ${rig.has_cost_data ? 'text-rose-600' : 'text-slate-300'}`}>{rig.has_cost_data ? fmt(rig.cost) : '—'}</td>
                      <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${isProfit ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(rig.margin)}</td>
                      <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(rig.margin_pct)}</td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rig.maintenance_status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                          rig.maintenance_status === 'due_soon' ? 'bg-amber-100 text-amber-700' :
                          rig.maintenance_status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {rig.maintenance_status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && hasJobs && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Job Breakdown — click to open job</p>
                            {rig.job_breakdown.map((jb, j) => (
                              <button
                                key={j}
                                onClick={() => onSelectJob?.(jb.job_id)}
                                className="w-full flex items-center justify-between gap-2 text-xs py-1 hover:bg-emerald-50/50 rounded-lg px-1.5 transition group"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="w-3 h-3 text-slate-400" />
                                  <span className="text-slate-600">{jb.job_name}</span>
                                  {jb.job_reference && <span className="text-[9px] text-slate-400">({jb.job_reference})</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-slate-700 tabular-nums">{fmt(jb.earned)}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#2E5A1A] transition" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
              <tr className="font-bold text-slate-800">
                <td colSpan={5} className="px-3 py-2.5">Portfolio Total ({rigs.length} rigs)</td>
                <td className="text-right px-3 py-2.5 text-emerald-700 tabular-nums">{fmt(totals.total_earned)}</td>
                <td className="text-right px-3 py-2.5 text-rose-600 tabular-nums">{fmt(totals.total_cost)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totals.total_margin)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
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