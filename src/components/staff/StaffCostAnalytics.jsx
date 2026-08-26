import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

/**
 * Shows total labour cost per staff member for the current month, based on
 * approved timesheets × their personal day rate. Includes a bar chart of
 * top 10 earners and a summary of total monthly labour spend.
 */
export default function StaffCostAnalytics() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: staff = [], isLoading: sl } = useQuery({
    queryKey: ['staff-active'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: timesheets = [], isLoading: tl } = useQuery({
    queryKey: ['timesheets-approved-month', monthStart],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'approved', date: { $gte: monthStart } }, '-date', 500),
  });

  const { data: rateCards = [], isLoading: rl } = useQuery({
    queryKey: ['rate-cards-personal'],
    queryFn: () => base44.entities.RateCardItem.filter({ category: 'labour', staff_id: { $exists: true } }),
  });

  const isLoading = sl || tl || rl;

  const { chartData, totalCost, depotCost, jobCost, staffWithoutRate } = useMemo(() => {
    const rateMap = {};
    rateCards.forEach(r => {
      if (r.staff_id && r.price) {
        if (!rateMap[r.staff_id] || r.price > rateMap[r.staff_id]) {
          rateMap[r.staff_id] = r.price;
        }
      }
    });

    const hoursByStaff = {};
    timesheets.forEach(t => {
      if (!t.staff_id) return;
      hoursByStaff[t.staff_id] = (hoursByStaff[t.staff_id] || 0) + (t.total_hours || 0);
    });

    const staffMap = {};
    staff.forEach(s => { staffMap[s.id] = s; });

    const data = Object.entries(hoursByStaff).map(([sid, hours]) => {
      const dayRate = rateMap[sid] || 0;
      const cost = (hours / 8) * dayRate;
      return {
        name: staffMap[sid]?.name?.split(' ')[0] || 'Unknown',
        cost: Math.round(cost),
        hours: Math.round(hours),
        hasRate: dayRate > 0,
      };
    }).sort((a, b) => b.cost - a.cost);

    const total = data.reduce((sum, d) => sum + d.cost, 0);
    const noRate = staff.filter(s => !rateMap[s.id] && hoursByStaff[s.id]).length;

    // Depot overhead: cost from non-chargeable (depot duty) timesheets
    const depotCost = timesheets
      .filter(t => t.chargeable === false)
      .reduce((sum, t) => {
        const dayRate = rateMap[t.staff_id] || 0;
        return sum + ((t.total_hours || 0) / 8) * dayRate;
      }, 0);
    const jobCost = Math.max(0, total - depotCost);

    return { chartData: data.slice(0, 10), totalCost: total, depotCost: Math.round(depotCost), jobCost: Math.round(jobCost), staffWithoutRate: noRate };
  }, [staff, timesheets, rateCards]);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Labour Cost Analytics</h3>
            <p className="text-xs text-slate-500">This month · Top earners</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 tabular-nums">{gbp(totalCost)}</p>
          <p className="text-[11px] text-slate-500">Total spend</p>
          {depotCost > 0 && (
            <p className="text-[10px] text-amber-700 mt-0.5">
              <span className="font-semibold">{gbp(depotCost)}</span> depot overhead · <span className="font-semibold">{gbp(jobCost)}</span> job labour
            </p>
          )}
        </div>
      </div>

      {staffWithoutRate > 0 && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {staffWithoutRate} staff worked this month without a day rate — their costs are £0.
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <Users className="w-8 h-8 mb-2" />
          <p className="text-sm">No approved timesheets this month</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(v) => [gbp(v), 'Cost']}
            />
            <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
              {chartData.map((d, i) => (
                <Bar.Cell key={i} fill={d.hasRate ? '#8b5cf6' : '#fbbf24'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}