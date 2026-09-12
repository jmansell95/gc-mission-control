import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, BarChart3, Users, Layers, UserCheck, UserX, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

const STATUS_COLORS = { planning: '#64748b', in_progress: '#059669', completed: '#0d9488', on_hold: '#d97706' };
const STATUS_LABELS = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold' };

const JOB_TYPE_LABELS = { groundworks: 'Groundworks', cp_drilling: 'CP Drilling', rotary_drilling: 'Rotary Drilling', enabling_works: 'Enabling Works', depot: 'Depot' };
const JOB_TYPE_COLORS = { groundworks: '#059669', cp_drilling: '#f59e0b', rotary_drilling: '#3b82f6', enabling_works: '#a855f7', depot: '#64748b' };

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(226,232,240,0.8)',
  fontSize: 12,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 24px -8px rgba(15,42,31,0.18)',
  padding: '8px 12px'
};

const cardCls = "hub-glass rounded-2xl p-5";

export function JobStatusChart({ jobs }) {
  const statuses = ['planning', 'in_progress', 'completed', 'on_hold'];
  const data = statuses
    .map(s => ({ name: STATUS_LABELS[s], key: s, value: jobs.filter(j => (j.status || 'planning') === s).length }))
    .filter(d => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md"><Activity className="w-4 h-4 text-white" /></div>
        <h2 className="font-bold text-slate-900 tracking-tight">Job Status</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No jobs yet</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {data.map(d => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Jobs</span>
            </div>
          </div>
          <div className="space-y-2 w-full">
            {data.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.key] }}></span>
                  <span className="text-sm text-slate-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function WeeklyAssignmentsChart({ days, rotas }) {
  const data = days.map(dayStr => {
    const d = new Date(dayStr + 'T00:00:00');
    return { day: d.toLocaleDateString('en-GB', { weekday: 'short' }), assignments: rotas.filter(r => r.assigned_date === dayStr).length };
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md"><BarChart3 className="w-4 h-4 text-white" /></div>
        <h2 className="font-bold text-slate-900 tracking-tight">This Week's Shifts</h2>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(16,185,129,0.08)' }} contentStyle={tooltipStyle} />
          <Bar dataKey="assignments" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function StaffUtilizationChart({ staff, rotas, weekDays }) {
  const workingDays = 5;

  const data = staff.map(member => {
    const count = rotas.filter(r => r.staff_id === member.id && weekDays.includes(r.assigned_date)).length;
    const pct = Math.min(100, Math.round((count / workingDays) * 100));
    let level = 'idle';
    if (count > workingDays) level = 'overtime';
    else if (count === workingDays) level = 'full';
    else if (count >= 3) level = 'active';
    else if (count >= 1) level = 'light';
    return { name: member.name, assigned: count, pct, level };
  }).sort((a, b) => b.assigned - a.assigned);

  const assignedCount = data.filter(d => d.assigned > 0).length;
  const idleCount = data.filter(d => d.assigned === 0).length;
  const avgPct = data.length ? Math.round(data.reduce((a, b) => a + b.pct, 0) / data.length) : 0;

  const levelMeta = {
    idle: { label: 'Idle', bar: 'bg-slate-300', chip: 'bg-slate-100 text-slate-500' },
    light: { label: 'Light', bar: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700' },
    active: { label: 'Active', bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
    full: { label: 'Full week', bar: 'bg-emerald-600', chip: 'bg-emerald-600 text-white' },
    overtime: { label: 'Overtime', bar: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700' },
  };

  const summary = [
    { label: 'Total crew', value: data.length, icon: Users, tint: 'bg-emerald-50 text-emerald-700' },
    { label: 'On shift', value: assignedCount, icon: UserCheck, tint: 'bg-blue-50 text-blue-600' },
    { label: 'Idle', value: idleCount, icon: UserX, tint: 'bg-slate-100 text-slate-500' },
    { label: 'Avg utilisation', value: avgPct + '%', icon: Gauge, tint: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md"><Users className="w-4 h-4 text-white" /></div>
        <h2 className="font-bold text-slate-900 tracking-tight">Crew Utilisation</h2>
        <span className="text-xs text-slate-400 ml-1 hidden sm:inline">This week · vs {workingDays}-day work week</span>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No crew yet</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {summary.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-slate-100 p-3 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.tint}`}><Icon className="w-4 h-4" /></div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 leading-none">{s.value}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {data.map((d, i) => {
              const m = levelMeta[d.level];
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-800 font-bold text-xs">{d.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${m.chip}`}>{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${m.bar}`} style={{ width: d.pct + '%' }} />
                      </div>
                      <span className="text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap w-24 text-right">
                        {d.assigned}/{workingDays} days · {d.pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}

export function JobTypeBreakdownChart({ jobs }) {
  const types = ['groundworks', 'cp_drilling', 'rotary_drilling', 'enabling_works', 'depot'];
  const data = types
    .map(t => ({ name: JOB_TYPE_LABELS[t], key: t, value: jobs.filter(j => j.job_type === t).length }))
    .filter(d => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md"><Layers className="w-4 h-4 text-white" /></div>
        <h2 className="font-bold text-slate-900 tracking-tight">Job Type Breakdown</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No jobs yet</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {data.map(d => <Cell key={d.key} fill={JOB_TYPE_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Jobs</span>
            </div>
          </div>
          <div className="space-y-2 w-full">
            {data.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: JOB_TYPE_COLORS[d.key] }}></span>
                  <span className="text-sm text-slate-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}