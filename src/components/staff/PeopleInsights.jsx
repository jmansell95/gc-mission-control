import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';
import {
  Clock, TrendingUp, Users, Briefcase, Gauge, Activity, Award, ChevronUp, ChevronDown,
} from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const gbp = (n) => (n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0');
const hrs = (n) => (n != null ? Number(n).toFixed(1) + 'h' : '0h');

/**
 * PeopleInsights — redesigned performance & productivity dashboard.
 *
 * Period selector (week / month / quarter) drives all metrics:
 *  - KPI tiles: total hours, utilization rate, avg hours/person, overtime hours
 *  - Hours-worked trend line chart
 *  - Earnings per crew (bar chart)
 *  - Crew-vs-crew benchmark bars (hours + utilization)
 *  - Job throughput stat
 */
export default function PeopleInsights() {
  const [period, setPeriod] = useState('month');

  const { dateFrom, dateTo, label } = useMemo(() => {
    const now = new Date();
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(now);
    if (period === 'week') from.setDate(now.getDate() - 7);
    else if (period === 'month') from.setMonth(now.getMonth() - 1);
    else from.setMonth(now.getMonth() - 3);
    from.setHours(0, 0, 0, 0);
    return { dateFrom: from.toISOString(), dateTo: to.toISOString(), label: period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'Last 90 days' };
  }, [period]);

  const { data: staff = [], isLoading: sl } = useQuery({
    queryKey: ['staff-active'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: timesheets = [], isLoading: tl } = useQuery({
    queryKey: ['timesheets-period', dateFrom],
    queryFn: () => base44.entities.Timesheet.filter({ date: { $gte: dateFrom.slice(0, 10) } }, '-date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-active-insights'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['planning', 'active', 'on_hold'] } }, '-created_date', 200),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const isLoading = sl || tl;

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  // Core metrics
  const metrics = useMemo(() => {
    const inPeriod = timesheets.filter((t) => t.date && t.date >= dateFrom.slice(0, 10));
    const totalHours = inPeriod.reduce((sum, t) => sum + (t.total_hours || 0), 0);
    const overtimeHours = inPeriod.reduce((sum, t) => sum + (t.overtime_hours || 0), 0);
    const staffWithHours = new Set(inPeriod.map((t) => t.staff_id).filter(Boolean));
    const activeStaff = staff.length;
    const avgHours = staffWithHours.size > 0 ? totalHours / staffWithHours.size : 0;
    const utilization = activeStaff > 0 ? (staffWithHours.size / activeStaff) * 100 : 0;

    // Hours by day for trend
    const byDay = {};
    inPeriod.forEach((t) => {
      const d = t.date;
      byDay[d] = (byDay[d] || 0) + (t.total_hours || 0);
    });
    const trendData = Object.entries(byDay).sort().map(([d, h]) => ({
      date: d.slice(5),
      hours: Math.round(h * 10) / 10,
    }));

    // Hours by crew (team)
    const byTeam = {};
    inPeriod.forEach((t) => {
      const s = staff.find((st) => st.id === t.staff_id);
      const teamId = s?.team_id || '__unassigned';
      const teamName = teamMap[teamId]?.name || 'Unassigned';
      if (!byTeam[teamId]) byTeam[teamId] = { name: teamName, hours: 0, people: new Set(), jobs: new Set() };
      byTeam[teamId].hours += t.total_hours || 0;
      if (t.staff_id) byTeam[teamId].people.add(t.staff_id);
      if (t.job_id) byTeam[teamId].jobs.add(t.job_id);
    });
    const crewData = Object.values(byTeam).map((c) => ({
      name: c.name,
      hours: Math.round(c.hours),
      people: c.people.size,
      jobs: c.jobs.size,
      util: c.people.size > 0 ? Math.round((c.hours / c.people.size) * 10) / 10 : 0,
    })).sort((a, b) => b.hours - a.hours);

    const jobThroughput = jobs.length;

    return { totalHours, overtimeHours, avgHours, utilization, trendData, crewData, jobThroughput, activeStaff };
  }, [timesheets, staff, dateFrom, teamMap, jobs]);

  const periods = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];

  const kpis = [
    { icon: Clock, label: 'Total Hours', value: hrs(metrics.totalHours), sub: label, color: 'emerald' },
    { icon: Gauge, label: 'Utilization', value: Math.round(metrics.utilization) + '%', sub: `${metrics.activeStaff} active staff`, color: 'blue' },
    { icon: TrendingUp, label: 'Avg Hours/Person', value: hrs(metrics.avgHours), sub: 'Across active crew', color: 'violet' },
    { icon: Activity, label: 'Overtime', value: hrs(metrics.overtimeHours), sub: 'This period', color: 'amber' },
  ];

  const colorMap = {
    emerald: 'stat-gradient-emerald',
    blue: 'stat-gradient-blue',
    violet: 'stat-gradient-violet',
    amber: 'stat-gradient-amber',
  };

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg stat-gradient-brand flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Performance & Productivity</h2>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                period === p.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="hub-glass rounded-2xl p-4 relative overflow-hidden">
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${colorMap[kpi.color]} opacity-10`} />
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl ${colorMap[kpi.color]} flex items-center justify-center mb-2.5`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{kpi.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{kpi.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hours trend + Job throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="hub-glass rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Hours Worked Trend</h3>
          </div>
          {metrics.trendData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Clock className="w-8 h-8 mb-2" />
              <p className="text-sm">No timesheet data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics.trendData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8DC63F" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#2E5A1A" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [hrs(v), 'Hours']} />
                <Line type="monotone" dataKey="hours" stroke="#2E5A1A" strokeWidth={2.5} dot={{ r: 3, fill: '#8DC63F' }} activeDot={{ r: 5 }} fill="url(#hoursGrad)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="hub-glass rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Job Throughput</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full stat-gradient-indigo flex items-center justify-center mb-3 icon-tile-glow">
              <span className="text-3xl font-extrabold text-white tabular-nums">{metrics.jobThroughput}</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">Active Jobs</p>
            <p className="text-xs text-slate-400">In planning or underway</p>
          </div>
        </div>
      </div>

      {/* Crew vs Crew benchmark */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-900">Crew Benchmark — Hours by Crew Type</h3>
        </div>
        {metrics.crewData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Users className="w-8 h-8 mb-2" />
            <p className="text-sm">No crew hours logged this period</p>
          </div>
        ) : (
          <div className="space-y-2">
            {metrics.crewData.map((crew, i) => {
              const maxHours = metrics.crewData[0].hours || 1;
              const pct = (crew.hours / maxHours) * 100;
              return (
                <div key={crew.name} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-400 tabular-nums w-5">{i + 1}</span>
                      <p className="text-sm font-semibold text-slate-700 truncate">{crew.name}</p>
                      <span className="text-[10px] text-slate-400">{crew.people}p · {crew.jobs} jobs</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{hrs(crew.hours)}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">{crew.util}h/person</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, #8DC63F, #2E5A1A)'
                          : 'linear-gradient(90deg, #8DC63F, #5A8C1E)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}