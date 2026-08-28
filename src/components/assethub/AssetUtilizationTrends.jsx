import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Activity, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { format, subDays } from 'date-fns';

/**
 * Shows a 30-day utilization trend per rig/vehicle — what percentage of days
 * each asset was assigned to a job vs idle in the yard. Helps identify
 * underutilized assets for reallocation or sale.
 */
export default function AssetUtilizationTrends() {
  const { data: assets = [], isLoading: al } = useQuery({
    queryKey: ['site-assets-util'],
    queryFn: () => base44.entities.SiteAsset.filter({ is_active: true }, 'name', 200),
  });

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString().slice(0, 10);

  const { data: assignments = [], isLoading: rl } = useQuery({
    queryKey: ['asset-assignments-30d', thirtyDaysAgo],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ assigned_date: { $gte: thirtyDaysAgo } }, '-assigned_date', 500),
  });

  const isLoading = al || rl;

  const { chartData, summary } = useMemo(() => {
    // Build per-day utilization for each asset
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      return format(d, 'yyyy-MM-dd');
    });

    const assetDayMap = {}; // asset_id -> Set of days assigned
    assignments.forEach(a => {
      if (!a.asset_id || !a.assigned_date) return;
      if (!assetDayMap[a.asset_id]) assetDayMap[a.asset_id] = new Set();
      assetDayMap[a.asset_id].add(a.assigned_date.slice(0, 10));
    });

    // Top 5 most utilized assets for the chart
    const assetUtil = assets.map(a => {
      const assignedDays = assetDayMap[a.id]?.size || 0;
      return {
        id: a.id,
        name: a.name,
        type: a.asset_type,
        utilizationPct: Math.round((assignedDays / 30) * 100),
        assignedDays,
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);

    // Build chart data: for each day, how many assets were on-site
    const chart = days.map(day => {
      let onSite = 0;
      assets.forEach(a => {
        if (assetDayMap[a.id]?.has(day)) onSite++;
      });
      return {
        date: format(new Date(day), 'dd MMM'),
        onSite,
        idle: assets.length - onSite,
      };
    });

    const avgUtil = assets.length > 0
      ? Math.round(assetUtil.reduce((s, a) => s + a.utilizationPct, 0) / assets.length)
      : 0;
    const idle = assetUtil.filter(a => a.utilizationPct < 20).length;

    return {
      chartData: chart,
      summary: { avgUtil, idleAssets: idle, totalAssets: assets.length, topUtilized: assetUtil.slice(0, 5) },
    };
  }, [assets, assignments]);

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Utilization Trends (30 Days)</h3>
            <p className="text-xs text-slate-500">On-site vs idle per day</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900 tabular-nums">{summary.avgUtil}%</p>
            <p className="text-[10px] text-slate-500">Avg utilisation</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-600 tabular-nums">{summary.idleAssets}</p>
            <p className="text-[10px] text-slate-500">Under-utilized</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="onSite" stroke="#06b6d4" strokeWidth={2} dot={false} name="On-site" />
          <Line type="monotone" dataKey="idle" stroke="#cbd5e1" strokeWidth={2} dot={false} name="Idle" />
        </LineChart>
      </ResponsiveContainer>

      {summary.topUtilized.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-2">Top Utilised Assets</p>
          <div className="space-y-1.5">
            {summary.topUtilized.map(a => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-700 truncate">
                  <Wrench className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  {a.name}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${a.utilizationPct > 60 ? 'bg-emerald-500' : a.utilizationPct > 30 ? 'bg-amber-500' : 'bg-rose-400'}`}
                      style={{ width: `${a.utilizationPct}%` }}
                    />
                  </div>
                  <span className="font-bold text-slate-600 tabular-nums w-8 text-right">{a.utilizationPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}