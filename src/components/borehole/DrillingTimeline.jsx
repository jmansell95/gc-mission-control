import React, { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/StateViews';

const RIG_LINE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#64748b'];

/**
 * DrillingTimeline — day-by-day drilling progress chart showing daily metres
 * (area fill) and cumulative depth (line). Works for any job type since it
 * relies on dates and depths from borehole_progress logs, not strata.
 *
 * Props:
 *  - boreholes: [[ref, logs], ...] — grouped borehole array from BoreholeDrillDown
 */
export default function DrillingTimeline({ boreholes = [] }) {
  const { chartData, hasData, rigNames } = useMemo(() => {
    // Collect per-day per-rig metres from borehole_progress logs.
    // Each borehole's max depth is attributed to its earliest log date.
    const dayMap = {};
    const rigSet = new Set();

    boreholes.forEach(([, logs]) => {
      const progressLogs = logs
        .filter(l => l.log_type === 'borehole_progress' && l.date && l.depth_to != null)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      if (progressLogs.length === 0) return;

      // The final depth is the max depth_to; attribute it to the first drilling date
      const finalDepth = Math.max(...progressLogs.map(l => l.depth_to));
      const firstDate = progressLogs[0].date;
      const rigName = progressLogs[0].device_name || 'Unassigned';
      rigSet.add(rigName);

      if (!dayMap[firstDate]) dayMap[firstDate] = { date: firstDate, metres: 0, rigs: {} };
      dayMap[firstDate].metres += finalDepth;
      dayMap[firstDate].rigs[rigName] = (dayMap[firstDate].rigs[rigName] || 0) + finalDepth;
    });

    const sortedDates = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // Build cumulative depth
    let cumulative = 0;
    const chartData = sortedDates.map(d => {
      cumulative += d.metres;
      const entry = {
        date: d.date.slice(5), // MM-DD for compact axis
        fullDate: d.date,
        metres: Math.round(d.metres * 10) / 10,
        cumulative: Math.round(cumulative * 10) / 10,
      };
      // Add per-rig metres as separate keys for stacked area
      Object.entries(d.rigs).forEach(([rig, m]) => {
        entry[rig] = Math.round(m * 10) / 10;
      });
      return entry;
    });

    return { chartData, hasData: chartData.length > 0, rigNames: [...rigSet] };
  }, [boreholes]);

  if (!hasData) {
    return (
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-blue-700" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Drilling Progress Timeline</h3>
        </div>
        <EmptyState
          icon={CalendarDays}
          title="No timeline data"
          message="Drilling timeline appears once borehole progress logs with dates and depths are available."
        />
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-blue-700" />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">Drilling Progress Timeline</h3>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {chartData.length} day{chartData.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="metresGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'm/day', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'cumulative', angle: 90, position: 'insideRight', fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(v, name) => [`${v}m`, name === 'metres' ? 'Daily Metres' : name === 'cumulative' ? 'Cumulative' : name]}
            labelFormatter={(label) => {
              const entry = chartData.find(d => d.date === label);
              return entry ? entry.fullDate : label;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area yAxisId="left" type="monotone" dataKey="metres" stroke="#10b981" fill="url(#metresGradient)" strokeWidth={2} name="Daily Metres" />
          <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#2E5A1A" strokeWidth={2.5} dot={{ r: 3, fill: '#2E5A1A' }} name="Cumulative Depth" />
        </ComposedChart>
      </ResponsiveContainer>
      {rigNames.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-2 justify-center">
          {rigNames.map((rig, i) => (
            <span key={rig} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RIG_LINE_COLORS[i % RIG_LINE_COLORS.length] }} />
              {rig}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}