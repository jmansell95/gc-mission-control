import React, { useMemo } from 'react';
import { CalendarClock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, addMonths, isWithinInterval } from 'date-fns';
import { parseComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

/**
 * ComplianceExpiryForecast — 12-month forward forecast of how many compliance
 * items expire each month. Helps anticipate renewal workload and budget for
 * re-certifications before they become overdue.
 */
export default function ComplianceExpiryForecast({ items }) {
  const forecast = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const m = addMonths(now, i);
      months.push({
        key: format(m, 'yyyy-MM'),
        label: format(m, 'MMM'),
        year: m.getFullYear(),
        count: 0,
        items: [],
      });
    }

    items.forEach((item) => {
      if (!item.expiry_date) return;
      const expDate = parseComplianceDate(item.expiry_date);
      if (!expDate) return;
      const key = format(expDate, 'yyyy-MM');
      const bucket = months.find((m) => m.key === key);
      if (bucket) {
        bucket.count++;
        bucket.items.push(item);
      }
    });

    return months;
  }, [items]);

  const totalExpiring = forecast.reduce((s, m) => s + m.count, 0);
  const peakMonth = forecast.reduce((max, m) => m.count > max.count ? m : max, forecast[0]);
  const alreadyExpired = items.filter((i) => {
    if (!i.expiry_date) return false;
    const d = complianceDaysUntil(i.expiry_date);
    return d !== null && d < 0;
  }).length;

  const barColor = (count) => {
    if (count === 0) return '#e2e8f0';
    if (count >= 5) return '#f43f5e';
    if (count >= 3) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Expiry Velocity — 12 Month Forecast</h3>
          <p className="text-[11px] text-slate-400">How many certifications lapse each month — plan renewals before they bite</p>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-xl font-bold text-amber-600 tabular-nums">{totalExpiring}</p>
          <p className="text-[10px] text-slate-500 font-medium">Expiring (12mo)</p>
        </div>
        <div className="text-center bg-rose-50 rounded-lg py-2">
          <p className="text-xl font-bold text-rose-600 tabular-nums">{alreadyExpired}</p>
          <p className="text-[10px] text-slate-500 font-medium">Already Expired</p>
        </div>
        <div className="text-center bg-blue-50 rounded-lg py-2">
          <p className="text-xl font-bold text-blue-600 tabular-nums">{peakMonth?.count || 0}</p>
          <p className="text-[10px] text-slate-500 font-medium">Peak: {peakMonth?.label || '—'}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={forecast} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v) => [`${v} item${v === 1 ? '' : 's'}`, 'Expiring']}
            labelFormatter={(l, payload) => {
              const m = payload?.[0]?.payload;
              if (!m || m.count === 0) return l;
              return `${l} — ${m.items.map((i) => i.title).join(', ').slice(0, 80)}`;
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {forecast.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.count)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {totalExpiring === 0 && alreadyExpired === 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 mt-3 justify-center">
          <TrendingUp className="w-4 h-4" /> No expiries forecast — all certifications are healthy.
        </div>
      )}
      {alreadyExpired > 0 && (
        <div className="flex items-center gap-2 mt-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <p className="text-xs text-rose-700 font-medium">{alreadyExpired} item{alreadyExpired === 1 ? '' : 's'} already expired — renew immediately to stay compliant.</p>
        </div>
      )}
    </div>
  );
}