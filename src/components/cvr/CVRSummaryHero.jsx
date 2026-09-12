import React from 'react';
import { TrendingUp, TrendingDown, PoundSterling, Target, FileBarChart, Calculator, Calendar } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => {
  const v = Number(n || 0);
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
};

/**
 * CVRSummaryHero — the financial summary hero shown at the top of the CVR
 * dashboard. Large gradient stat tiles for contract value, budget, variations,
 * forecast final value, total cost, and P&L with colour-coded gauge.
 */
export default function CVRSummaryHero({ cvr }) {
  if (!cvr) return null;

  const profitLoss = cvr.profit_loss || 0;
  const isProfit = profitLoss >= 0;
  const profitPct = cvr.profit_pct || 0;
  const isAtRisk = profitPct < 10 && profitPct >= 0;

  return (
    <div className="space-y-3">
      {/* P&L Hero Banner */}
      <div className={`relative rounded-2xl overflow-hidden hub-glass ${isProfit ? 'border-emerald-200' : 'border-rose-200'}`}>
        <div className={`absolute inset-0 ${isProfit ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50' : 'bg-gradient-to-br from-rose-50 via-white to-rose-50/50'}`} />
        <div className="relative p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isProfit ? 'stat-gradient-emerald' : 'stat-gradient-rose'}`}>
              {isProfit ? <TrendingUp className="w-7 h-7 text-white" /> : <TrendingDown className="w-7 h-7 text-white" />}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Profit / Loss</p>
              <p className={`text-3xl font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isProfit ? '+' : ''}{fmt(profitLoss)}
              </p>
              <p className={`text-sm font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmtPct(profitPct)} margin
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold mt-1 ${
              isProfit ? (isAtRisk ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700') : 'bg-rose-100 text-rose-700'
            }`}>
              {isProfit ? (isAtRisk ? 'At Risk' : 'On Track') : 'Loss'}
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatTile
          icon={PoundSterling}
          label="Contract Value"
          value={fmt(cvr.contract_value)}
          gradient="stat-gradient-brand"
        />
        <StatTile
          icon={FileBarChart}
          label="Variations"
          value={fmt(cvr.variations_total)}
          subValue={`${fmt(cvr.contract_value + cvr.variations_total)} forecast`}
          gradient="stat-gradient-blue"
        />
        <StatTile
          icon={Calculator}
          label="Total Cost"
          value={fmt(cvr.total_cost)}
          subValue={`${fmt(cvr.costs_to_date)} to date`}
          gradient="stat-gradient-amber"
        />
        <StatTile
          icon={Target}
          label="Budget"
          value={fmt(cvr.budget)}
          subValue={cvr.budget > 0 ? `${(((cvr.total_cost || 0) / cvr.budget) * 100).toFixed(0)}% used` : '—'}
          gradient="stat-gradient-violet"
        />
      </div>

      {/* Timeline info bar */}
      <div className="hub-glass rounded-2xl p-3 flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">{cvr.project_start || '—'}</span>
          <span className="text-slate-300">→</span>
          <span className="font-medium">{cvr.project_end || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="text-slate-400">Weeks in progress:</span>
          <span className="font-bold text-slate-800 tabular-nums">{cvr.weeks_in_progress || 0}</span>
        </div>
        {cvr.last_updated_at && (
          <div className="flex items-center gap-1.5 text-slate-500 ml-auto">
            <span className="text-slate-400">Updated:</span>
            <span className="font-medium">{new Date(cvr.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {cvr.last_updated_by && <span className="text-slate-300">by {cvr.last_updated_by}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, subValue, gradient }) {
  return (
    <div className="hub-glass rounded-2xl p-3.5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-1.5">
        <div className={`w-9 h-9 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
      {subValue && <p className="text-[10px] text-slate-400 mt-0.5">{subValue}</p>}
    </div>
  );
}