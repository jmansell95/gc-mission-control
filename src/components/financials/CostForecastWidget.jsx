import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Loader2, Gauge, Calendar, PoundSterling } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * CostForecastWidget — projects the final cost of a job based on the
 * current daily burn rate and remaining days. Uses calculateJobFinancials
 * for the current cost, then extrapolates.
 *
 * Props: job — the job record
 */
export default function CostForecastWidget({ job }) {
  const { data: fin, isLoading } = useQuery({
    queryKey: ['job-financials-forecast', job?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id });
      return res.data || res;
    },
    enabled: !!job?.id,
  });

  if (isLoading || !fin?.summary) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <p className="text-xs">No financial data</p>}
      </div>
    );
  }

  const s = fin.summary;
  const costNet = Number(s.total_cost_net) || 0;
  const revenueNet = Number(s.total_revenue_net) || 0;
  const budget = Number(job.budget_amount) || 0;

  // Calculate projection
  const today = new Date();
  const start = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const end = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  let projectedCost = costNet;
  let dailyBurn = 0;
  let remainingDays = 0;
  let elapsedDays = 0;
  let totalDays = 0;
  let progressPct = 0;

  if (start && end) {
    totalDays = Math.max(1, Math.round((end - start) / 86400000));
    elapsedDays = Math.max(1, Math.min(totalDays, Math.round((today - start) / 86400000)));
    remainingDays = Math.max(0, Math.round((end - today) / 86400000));
    dailyBurn = costNet / elapsedDays;
    projectedCost = costNet + (dailyBurn * remainingDays);
    progressPct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  }

  const projectedVariance = budget > 0 ? budget - projectedCost : 0;
  const projectedOverrun = budget > 0 && projectedCost > budget;
  const overrunPct = projectedOverrun ? Math.round(((projectedCost - budget) / budget) * 100) : 0;
  const projectedMargin = revenueNet > 0 ? Math.round(((revenueNet - projectedCost) / revenueNet) * 100) : 0;
  const currentMargin = revenueNet > 0 ? Math.round(((revenueNet - costNet) / revenueNet) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {totalDays > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Job progress
            </span>
            <span className="text-xs font-bold text-slate-700">{progressPct}% · Day {elapsedDays} of {totalDays}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Cost tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Current Cost</p>
          <p className="text-sm font-bold text-slate-900">{fmt(costNet)}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${projectedOverrun ? 'bg-rose-50' : 'bg-amber-50'}`}>
          <p className={`text-[10px] uppercase tracking-wide ${projectedOverrun ? 'text-rose-400' : 'text-amber-400'}`}>Projected Final</p>
          <p className={`text-sm font-bold ${projectedOverrun ? 'text-rose-700' : 'text-amber-700'}`}>{fmt(projectedCost)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Budget</p>
          <p className="text-sm font-bold text-slate-900">{fmt(budget)}</p>
        </div>
      </div>

      {/* Daily burn rate */}
      {dailyBurn > 0 && (
        <div className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Burn rate:</span>
          <span className="font-bold text-slate-700">{fmt(dailyBurn)}/day</span>
          {remainingDays > 0 && <span className="text-slate-400">· {remainingDays} days remaining</span>}
        </div>
      )}

      {/* Forecast vs budget */}
      {budget > 0 && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${
          projectedOverrun ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          {projectedOverrun ? <TrendingDown className="w-4 h-4 text-rose-600" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
          <div className="flex-1">
            <p className={`text-sm font-bold ${projectedOverrun ? 'text-rose-700' : 'text-emerald-700'}`}>
              {projectedOverrun ? `${overrunPct}% over budget at completion` : `${fmt(Math.abs(projectedVariance))} under budget`}
            </p>
            <p className="text-[11px] text-slate-500">
              {projectedOverrun
                ? `Projected to exceed budget by ${fmt(projectedCost - budget)}`
                : 'On track to finish within budget'}
            </p>
          </div>
        </div>
      )}

      {/* Margin forecast */}
      {revenueNet > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-slate-400">Current margin:</span>
            <span className={`font-bold ${currentMargin >= 15 ? 'text-emerald-600' : currentMargin >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
              {currentMargin}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">→ Projected:</span>
            <span className={`font-bold ${projectedMargin >= 15 ? 'text-emerald-600' : projectedMargin >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
              {projectedMargin}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}