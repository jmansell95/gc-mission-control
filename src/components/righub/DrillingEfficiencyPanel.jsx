import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Loader2, Gauge, Drill, AlertTriangle, Activity } from 'lucide-react';

export default function DrillingEfficiencyPanel({ assets }) {
  const [selectedRig, setSelectedRig] = useState(null);

  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs-for-drilling-efficiency'],
    queryFn: () => base44.entities.Job.filter({ status: 'in_progress' }, '-created_date', 100),
  });

  const { data: rigStats, isLoading: statsLoading } = useQuery({
    queryKey: ['drilling-efficiency-stats', jobs.map(j => j.id).join(',')],
    queryFn: async () => {
      const results = [];
      for (const job of jobs) {
        try {
          const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id });
          const fin = res.data || res;
          if (fin?.rig_profitability) {
            for (const rig of fin.rig_profitability) {
              results.push({
                job_id: job.id,
                job_name: fin.job_name || job.name,
                rig_name: rig.rig_name,
                rig_type: rig.rig_type,
                method: rig.method,
                working_days: rig.working_days,
                metres_drilled: rig.metres_drilled,
                day_rate: rig.day_rate,
                day_cost: rig.day_cost || 0,
                total_cost: rig.total_cost,
                meterage_revenue: rig.meterage_revenue,
                profit: rig.profit,
                cost_per_metre: rig.metres_drilled > 0 ? Math.round((rig.total_cost / rig.metres_drilled) * 100) / 100 : 0,
                revenue_per_metre: rig.metres_drilled > 0 ? Math.round((rig.meterage_revenue / rig.metres_drilled) * 100) / 100 : 0,
                profit_per_metre: rig.metres_drilled > 0 ? Math.round((rig.profit / rig.metres_drilled) * 100) / 100 : 0,
                metres_per_day: rig.working_days > 0 ? Math.round((rig.metres_drilled / rig.working_days) * 100) / 100 : 0,
              });
            }
          }
        } catch (_) {}
      }
      return results;
    },
    enabled: jobs.length > 0,
  });

  const rigAggregation = useMemo(() => {
    if (!rigStats) return [];
    const byRig = {};
    for (const r of rigStats) {
      const key = r.rig_name;
      if (!byRig[key]) {
        byRig[key] = { rig_name: r.rig_name, rig_type: r.rig_type, method: r.method, jobs: [], total_metres: 0, total_cost: 0, total_revenue: 0, total_profit: 0, total_days: 0 };
      }
      byRig[key].jobs.push(r);
      byRig[key].total_metres += r.metres_drilled || 0;
      byRig[key].total_cost += r.total_cost || 0;
      byRig[key].total_revenue += r.meterage_revenue || 0;
      byRig[key].total_profit += r.profit || 0;
      byRig[key].total_days += r.working_days || 0;
    }
    return Object.values(byRig).map((r) => ({
      ...r,
      avg_metres_per_day: r.total_days > 0 ? Math.round((r.total_metres / r.total_days) * 100) / 100 : 0,
      cost_per_metre: r.total_metres > 0 ? Math.round((r.total_cost / r.total_metres) * 100) / 100 : 0,
      revenue_per_metre: r.total_metres > 0 ? Math.round((r.total_revenue / r.total_metres) * 100) / 100 : 0,
      profit_per_metre: r.total_metres > 0 ? Math.round((r.total_profit / r.total_metres) * 100) / 100 : 0,
      margin_pct: r.total_revenue > 0 ? Math.round((r.total_profit / r.total_revenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.total_metres - a.total_metres);
  }, [rigStats]);

  const isLoading = jobsLoading || statsLoading;
  const totalMetres = rigAggregation.reduce((s, r) => s + r.total_metres, 0);
  const totalProfit = rigAggregation.reduce((s, r) => s + r.total_profit, 0);
  const avgMetresPerDay = rigAggregation.length > 0 ? Math.round((rigAggregation.reduce((s, r) => s + r.avg_metres_per_day, 0) / rigAggregation.length) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-gradient-brand rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20">
          <Drill className="w-5 h-5 text-white/80 mb-1.5" />
          <p className="text-2xl font-bold tabular-nums">{rigAggregation.length}</p>
          <p className="text-[11px] text-white/85 font-medium">Active Rigs</p>
        </div>
        <div className="stat-gradient-emerald rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20">
          <TrendingUp className="w-5 h-5 text-white/80 mb-1.5" />
          <p className="text-2xl font-bold tabular-nums">{totalMetres.toLocaleString('en-GB')}m</p>
          <p className="text-[11px] text-white/85 font-medium">Total Metres Drilled</p>
        </div>
        <div className="stat-gradient-blue rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20">
          <Gauge className="w-5 h-5 text-white/80 mb-1.5" />
          <p className="text-2xl font-bold tabular-nums">{avgMetresPerDay}m</p>
          <p className="text-[11px] text-white/85 font-medium">Avg m / Day</p>
        </div>
        <div className="stat-gradient-amber rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20">
          <Activity className="w-5 h-5 text-white/80 mb-1.5" />
          <p className="text-2xl font-bold tabular-nums">£{totalProfit.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-white/85 font-medium">Total Rig Profit</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin mb-3" />
          <p className="text-sm text-slate-500">Calculating drilling efficiency across all active jobs...</p>
        </div>
      ) : rigAggregation.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Drill className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No drilling data available</p>
          <p className="text-xs text-slate-400 mt-1">Add rigs to active jobs and log borehole progress to see efficiency analytics.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#2E5A1A]" /> Rig Efficiency Comparison</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Aggregated across all active jobs — click a rig for per-job breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Rig</th>
                  <th className="py-2.5 px-3 font-semibold">Method</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Metres</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Days</th>
                  <th className="py-2.5 px-3 font-semibold text-right">m / Day</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cost / m</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rev / m</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Profit / m</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margin</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rigAggregation.map(r => {
                  const isProfitable = r.total_profit > 0;
                  const isLowMargin = r.margin_pct < 15 && r.total_revenue > 0;
                  return (
                    <tr key={r.rig_name} onClick={() => setSelectedRig(r)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{r.rig_name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.method === 'rotary' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'}`}>{r.method || 'cp'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-700">{r.total_metres.toLocaleString('en-GB')}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{r.total_days}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <span className={r.avg_metres_per_day > 10 ? 'text-emerald-600 font-medium' : 'text-slate-500'}>{r.avg_metres_per_day}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">£{r.cost_per_metre}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">£{r.revenue_per_metre}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${r.profit_per_metre > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>£{r.profit_per_metre}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isLowMargin ? 'bg-amber-50 text-amber-600' : isProfitable ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {isLowMargin && <AlertTriangle className="w-3 h-3" />}
                          {r.margin_pct}%
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>£{r.total_profit.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-rig drill-down */}
      {selectedRig && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedRig(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3 rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                  <Drill className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedRig.rig_name}</h3>
                  <p className="text-[11px] text-slate-400">Per-job drilling breakdown</p>
                </div>
              </div>
              <button onClick={() => setSelectedRig(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {selectedRig.jobs.map((j, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-sm font-bold text-slate-800 mb-2">{j.job_name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-[10px] uppercase text-slate-400">Metres</p><p className="font-bold text-slate-700">{j.metres_drilled}m</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Days</p><p className="font-bold text-slate-700">{j.working_days}</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">m / Day</p><p className="font-bold text-slate-700">{j.metres_per_day}m</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Cost</p><p className="font-bold text-slate-600">£{j.total_cost.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Revenue</p><p className="font-bold text-slate-600">£{j.meterage_revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Profit</p><p className={`font-bold ${j.profit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>£{j.profit.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}