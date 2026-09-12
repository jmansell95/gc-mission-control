import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PoundSterling, TrendingDown, Calendar, Activity, Replace } from 'lucide-react';
import { safeFormat } from '@/utils/format';
import AssetFinancialLifecycle from '@/components/assethub/AssetFinancialLifecycle';
import DepreciationScheduleTable from '@/components/assetdetail/DepreciationScheduleTable';
import TotalCostOfOwnership from '@/components/assetdetail/TotalCostOfOwnership';
import CostPerHourProfitability from '@/components/assetdetail/CostPerHourProfitability';

const LIFECYCLE_META = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  aging: { label: 'Aging', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  due_for_replacement: { label: 'Due for Replacement', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  disposed: { label: 'Disposed', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function StatCard({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`${gradient} rounded-xl p-3 text-white`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-white/80" />
        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Financial tab — acquisition cost, depreciation chart, current book value,
 * replacement planning, and the full financial lifecycle (revenue vs cost).
 */
export default function AssetFinancialTab({ asset }) {
  const depreciationData = useMemo(() => {
    if (!asset?.acquisition_cost || !asset?.depreciation_years) return [];
    const start = new Date(asset.acquisition_date || asset.created_date);
    const salvage = asset.salvage_value || 0;
    const totalDep = asset.acquisition_cost - salvage;
    const monthlyStep = totalDep / (asset.depreciation_years * 12);
    const data = [];
    for (let i = 0; i <= asset.depreciation_years * 12; i += 3) {
      const date = new Date(start);
      date.setMonth(date.getMonth() + i);
      const bookValue = Math.max(salvage, asset.acquisition_cost - monthlyStep * i);
      data.push({
        date: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        value: Math.round(bookValue),
      });
    }
    return data;
  }, [asset]);

  const gbp = (n) => n != null ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A3—';
  const lcMeta = LIFECYCLE_META[asset?.lifecycle_status] || LIFECYCLE_META.active;

  return (
    <div className="space-y-4">
      {/* Key financial stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={PoundSterling} label="Acquisition Cost" value={gbp(asset?.acquisition_cost)} gradient="stat-gradient-blue" />
        <StatCard icon={TrendingDown} label="Current Book Value" value={gbp(asset?.current_book_value)} gradient="stat-gradient-emerald" />
        <StatCard icon={Replace} label="Replacement Cost" value={gbp(asset?.replacement_cost_estimate)} gradient="stat-gradient-amber" />
        <StatCard icon={Calendar} label="Salvage Value" value={gbp(asset?.salvage_value)} gradient="stat-gradient-slate" />
      </div>

      {/* Lifecycle status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${lcMeta.cls}`}>
          <Activity className="w-3.5 h-3.5" /> {lcMeta.label}
        </span>
        {asset?.acquisition_date && (
          <span className="text-xs text-slate-500">
            Acquired {safeFormat(asset.acquisition_date, 'dd MMM yyyy')}
          </span>
        )}
        {asset?.replacement_date && (
          <span className="text-xs text-slate-500">
            · Replace by {safeFormat(asset.replacement_date, 'dd MMM yyyy')}
          </span>
        )}
      </div>

      {/* Depreciation chart */}
      {depreciationData.length > 0 ? (
        <div className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" /> Depreciation Schedule
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={depreciationData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="depGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E5A1A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2E5A1A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u00A3${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v) => [gbp(v), 'Book Value']}
              />
              <Area type="monotone" dataKey="value" stroke="#2E5A1A" strokeWidth={2.5} fill="url(#depGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="hub-glass rounded-2xl p-4 text-center">
          <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No depreciation data — set acquisition cost and useful life to see the schedule.</p>
        </div>
      )}

      {/* Year-by-year depreciation schedule with inline editor */}
      <DepreciationScheduleTable asset={asset} />

      {/* Total Cost of Ownership */}
      <TotalCostOfOwnership asset={asset} />

      {/* Cost-per-Hour Profitability */}
      <CostPerHourProfitability asset={asset} />

      {/* Full financial lifecycle (revenue vs cost) */}
      <AssetFinancialLifecycle assetId={asset?.id} />
    </div>
  );
}