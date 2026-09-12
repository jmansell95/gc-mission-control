import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * CVRCashFlowChart — area chart plotting monthly cash flow application values
 * over the project timeline. Uses recharts AreaChart with emerald fill.
 */
export default function CVRCashFlowChart({ cashFlow }) {
  const chartData = useMemo(() => {
    if (!cashFlow || cashFlow.length === 0) return [];
    return cashFlow
      .filter(cf => cf.month_date)
      .map(cf => ({
        date: cf.month_date,
        label: new Date(cf.month_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        amount: cf.amount || cf.app_value || 0,
        description: cf.description || '',
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [cashFlow]);

  if (chartData.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">No cash flow data yet</p>
        <p className="text-xs text-slate-400 mt-1">Cash flow forecast will appear here when the CVR includes a Cash flow sheet</p>
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Cash Flow Forecast</h3>
          <p className="text-[11px] text-slate-400">{chartData.length} months · {fmt(total)} total forecast</p>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-semibold">Monthly</span>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E5A1A" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8DC63F" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={(value) => [fmt(value), 'Amount']}
              labelStyle={{ fontWeight: 600, color: '#1e293b' }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#2E5A1A"
              strokeWidth={2.5}
              fill="url(#cashFlowGradient)"
              dot={{ fill: '#2E5A1A', r: 3 }}
              activeDot={{ r: 5, fill: '#2E5A1A' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}