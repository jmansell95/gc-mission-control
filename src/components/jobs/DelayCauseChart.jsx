import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DELAY_LABELS = {
  ground_conditions: 'Ground Conditions', utility_clash: 'Utility Clash', weather: 'Weather',
  mechanical_failure: 'Mechanical Failure', access_issue: 'Access Issue', client_request: 'Client Request',
  third_party: 'Third Party', other: 'Other',
};

const CAUSE_COLORS = {
  ground_conditions: '#8B5CF6', utility_clash: '#F59E0B', weather: '#3B82F6',
  mechanical_failure: '#EF4444', access_issue: '#EC4899', client_request: '#10B981',
  third_party: '#6366F1', other: '#94A3B8',
};

// Donut chart showing the distribution of delay causes. Only renders when
// there are 2+ distinct causes — otherwise a single-cause summary badge is
// shown instead to avoid a meaningless full-circle chart.
export default function DelayCauseChart({ logs }) {
  const causeCounts = {};
  logs.forEach(l => {
    const t = l.delay_type || 'other';
    causeCounts[t] = (causeCounts[t] || 0) + 1;
  });
  const data = Object.entries(causeCounts).map(([key, count]) => ({
    name: DELAY_LABELS[key] || key, key, count, color: CAUSE_COLORS[key] || '#94A3B8',
  })).sort((a, b) => b.count - a.count);

  if (data.length === 0) return null;
  if (data.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: `${data[0].color}15` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: data[0].color }} />
        <span className="text-xs font-semibold text-slate-700">{data[0].name}</span>
        <span className="text-xs text-slate-400">· {data[0].count} delay{data[0].count !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-24 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '6px 8px' }}
              formatter={(value, name) => [`${value} delay${value !== 1 ? 's' : ''}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
        {data.map(d => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-[11px] text-slate-600 font-medium">{d.name}</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}