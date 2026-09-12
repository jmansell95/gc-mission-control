import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HardHat, TrendingUp, Ruler, Compass, Calendar } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';

export default function StaffPerformanceCard({ staffId }) {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['staff-perf-logs', staffId],
    queryFn: () => base44.entities.InvestigationLog.filter({ staff_id: staffId }, '-created_date', 200),
    enabled: !!staffId,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['staff-perf-ts', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-created_date', 50),
    enabled: !!staffId,
  });

  if (logsLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="h-6 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Aggregate this week's performance
  const thisWeekLogs = logs.filter(l => l.date && l.date >= weekStart);
  const totalMetrage = thisWeekLogs.reduce((s, l) => {
    if (l.depth_to != null && l.depth_from != null) return s + (l.depth_to - l.depth_from);
    return s;
  }, 0);
  // Boreholes worked on this week
  const thisWeekBoreholes = new Set(thisWeekLogs.map(l => l.borehole_ref).filter(Boolean)).size;

  // All-time totals
  const allTimeMetrage = logs.reduce((s, l) => {
    if (l.depth_to != null && l.depth_from != null) return s + (l.depth_to - l.depth_from);
    return s;
  }, 0);

  // Days worked this week (from summary timesheets)
  const thisWeekDays = timesheets.filter(t => t.week_start === weekStart && t.weekly_total_minutes).length;
  const weekMinutes = timesheets
    .filter(t => t.week_start === weekStart)
    .reduce((s, t) => s + (t.weekly_total_minutes || 0), 0);
  const weekHours = Math.round(weekMinutes / 60);

  // Boreholes worked on
  const boreholes = new Set(logs.map(l => l.borehole_ref).filter(Boolean));

  const stats = [
    { label: 'This Week Metres', value: `${totalMetrage.toFixed(1)}m`, icon: Ruler, grad: 'stat-gradient-emerald' },
    { label: 'Boreholes This Week', value: thisWeekBoreholes, icon: Compass, grad: 'stat-gradient-blue' },
    { label: 'Hours This Week', value: `${weekHours}h`, icon: Calendar, grad: 'stat-gradient-amber' },
    { label: 'All-Time Metres', value: `${allTimeMetrage.toFixed(0)}m`, icon: TrendingUp, grad: 'stat-gradient-violet' },
  ];

  return (
    <div className="hub-glass rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <HardHat className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">My Performance</h2>
          <p className="text-[11px] text-slate-500">Week of {format(new Date(weekStart + 'T00:00:00'), 'dd MMM yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => {
          const SIcon = s.icon;
          return (
            <div key={s.label} className={`${s.grad} rounded-xl p-3.5 text-white shadow-sm`}>
              <SIcon className="w-4 h-4 text-white/85 mb-1.5" />
              <p className="text-xl font-bold tabular-nums drop-shadow-sm">{s.value}</p>
              <p className="text-[10px] text-white/85 font-medium">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick summary row */}
      <div className="flex items-center gap-4 text-sm pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs">Boreholes touched:</span>
          <span className="font-semibold text-slate-700 tabular-nums">{boreholes.size}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs">Days this week:</span>
          <span className="font-semibold text-slate-700 tabular-nums">{thisWeekDays}</span>
        </div>
      </div>
    </div>
  );
}