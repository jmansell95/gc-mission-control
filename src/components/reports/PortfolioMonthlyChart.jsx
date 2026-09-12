import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { CalendarClock, Users, Drill, TrendingUp, AlertCircle } from 'lucide-react';

const fmtMoney = (n) => '£' + Math.round(Number(n) || 0).toLocaleString('en-GB');

export default function PortfolioMonthlyChart({ portfolioMonthly }) {
  if (!portfolioMonthly || portfolioMonthly.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 text-center">
        <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">No remaining months to project</p>
        <p className="text-xs text-slate-400 mt-1">All filtered jobs have ended or have no end date set.</p>
      </div>
    );
  }

  const totalProjected = portfolioMonthly.reduce((s, m) => s + m.projected, 0);
  const hasGapMonths = portfolioMonthly.some(m => m.crew_count === 0);

  return (
    <div className="hub-glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 text-[#2E5A1A] flex items-center justify-center">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Income Projection</h3>
            <p className="text-[10px] text-slate-400">Resource-driven from rota crew + on-site rigs × day rates × working days</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Total Projected</p>
          <p className="text-lg font-extrabold text-[#2E5A1A] tabular-nums">{fmtMoney(totalProjected)}</p>
        </div>
      </div>

      {hasGapMonths && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Some months have no crew scheduled on the rota — income gap flagged in amber below.</span>
        </div>
      )}

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={portfolioMonthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
            tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
          <Tooltip
            formatter={(v) => [fmtMoney(v), 'Projected']}
            labelFormatter={(l) => `Month: ${l}`}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
          />
          <Bar dataKey="projected" radius={[6, 6, 0, 0]}>
            {portfolioMonthly.map((m, i) => (
              <Cell key={i} fill={m.crew_count === 0 ? '#f59e0b' : '#2E5A1A'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-[10px] uppercase">
              <th className="text-left py-1.5 font-semibold">Month</th>
              <th className="text-right py-1.5 font-semibold">Work Days</th>
              <th className="text-center py-1.5 font-semibold"><Users className="w-3 h-3 inline" /></th>
              <th className="text-center py-1.5 font-semibold"><Drill className="w-3 h-3 inline" /></th>
              <th className="text-right py-1.5 font-semibold">Projected Income</th>
            </tr>
          </thead>
          <tbody>
            {portfolioMonthly.map((m, i) => (
              <tr key={i} className={`border-t border-slate-100 ${m.crew_count === 0 ? 'bg-amber-50/50' : ''}`}>
                <td className="py-1.5 font-medium text-slate-700">
                  {m.month}
                  {m.crew_count === 0 && (
                    <span className="ml-1.5 text-[9px] text-amber-600 font-bold">⚠ GAP</span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">{m.working_days}</td>
                <td className="py-1.5 text-center tabular-nums text-slate-600">{m.crew_count || '—'}</td>
                <td className="py-1.5 text-center tabular-nums text-slate-600">{m.rig_count || '—'}</td>
                <td className="py-1.5 text-right tabular-nums font-bold text-[#2E5A1A]">{fmtMoney(m.projected)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#8DC63F] bg-[#8DC63F]/10">
              <td className="py-1.5 font-bold text-[#2E5A1A]">Total</td>
              <td className="py-1.5 text-right font-bold tabular-nums text-[#2E5A1A]">{portfolioMonthly.reduce((s, m) => s + m.working_days, 0)}</td>
              <td className="py-1.5"></td>
              <td className="py-1.5"></td>
              <td className="py-1.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmtMoney(totalProjected)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}