import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Mountain, ArrowDownToLine, TestTube, Calculator, Boxes, Package, Gauge, Clock, CalendarDays, TrendingUp, CheckCircle2, Loader2, CircleDashed } from 'lucide-react';
import { strataColors, strataConfig } from '@/components/investigation/shared';

/**
 * BoreholeSummaryPanel — site-wide summary panel for the Borehole Data tab.
 *
 * Aggregates across all boreholes to show: total boreholes, total depth,
 * avg drilling rate, strata distribution donut (recharts), and a
 * depth-per-borehole bar chart. Uses the brand insight-card styling.
 */
export default function BoreholeSummaryPanel({ boreholes, totals }) {
  // Strata distribution data for the donut chart
  const strataData = useMemo(() => {
    const byType = {};
    boreholes.forEach(([, logs]) => {
      logs.forEach(l => {
        if (l.strata_descriptor && l.log_type !== 'core_inspection') {
          const thickness = (l.depth_from != null && l.depth_to != null) ? (l.depth_to - l.depth_from) : 0;
          byType[l.strata_descriptor] = (byType[l.strata_descriptor] || 0) + Math.max(0, thickness);
        }
      });
    });
    return Object.entries(byType)
      .map(([key, value]) => ({
        name: strataConfig[key]?.label || key,
        value: Math.round(value * 10) / 10,
        color: strataColors[key] || strataColors.other,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [boreholes]);

  // Depth per borehole for the bar chart
  const depthData = useMemo(() => {
    return boreholes.map(([ref, logs]) => {
      const depths = logs.map(l => l.depth_to).filter(d => d != null);
      return { ref, depth: depths.length ? Math.max(...depths) : 0 };
    }).filter(d => d.depth > 0).sort((a, b) => a.ref.localeCompare(b.ref)).slice(0, 15);
  }, [boreholes]);

  const hasStrata = strataData.length > 0;
  const hasDepthChart = depthData.length > 0;

  // Borehole completion status counts (from LOCA_STAT on borehole_progress logs)
  const statusCounts = useMemo(() => {
    const counts = { complete: 0, in_progress: 0, unchecked: 0 };
    boreholes.forEach(([, logs]) => {
      const progressLog = logs.find(l => l.log_type === 'borehole_progress' && l.borehole_status);
      if (progressLog) counts[progressLog.borehole_status] = (counts[progressLog.borehole_status] || 0) + 1;
      else counts.unchecked++;
    });
    return counts;
  }, [boreholes]);

  return (
    <div className="space-y-4">
      {/* KPI ribbon */}
      <div className="hero-gradient rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Mountain className="w-5 h-5" />
          <h2 className="text-lg font-bold">Borehole Data Summary</h2>
          <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">{boreholes.length} boreholes</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile icon={Mountain} label="Boreholes" value={boreholes.length} />
          <KpiTile icon={ArrowDownToLine} label="Total Depth" value={`${totals.totalMeters}m`} />
          <KpiTile icon={TestTube} label="Samples" value={totals.totalSamples} />
          <KpiTile icon={Calculator} label="SPTs" value={totals.totalSPTs} />
          <KpiTile icon={Boxes} label="Core Runs" value={totals.totalCores} />
          <KpiTile icon={Clock} label="Drill Time" value={`${totals.totalDrillingHours}h`} />
        </div>
        {/* Borehole status strip */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <KpiTile icon={CheckCircle2} label="Completed" value={statusCounts.complete} />
          <KpiTile icon={Loader2} label="In Progress" value={statusCounts.in_progress} />
          <KpiTile icon={CircleDashed} label="Unchecked" value={statusCounts.unchecked} />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strata distribution donut */}
        {hasStrata && (
          <div className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Mountain className="w-4 h-4 text-amber-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Strata Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={strataData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {strataData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v, n) => [`${v}m`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {strataData.slice(0, 6).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.name} <span className="text-slate-400">{s.value}m</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Depth per borehole bar chart */}
        {hasDepthChart && (
          <div className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-blue-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Depth per Borehole</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={depthData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="ref" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" angle={-30} textAnchor="end" height={50} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'm', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [`${v}m`, 'Depth']} />
                <Bar dataKey="depth" fill="#2E5A1A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totals.avgRecovery != null && (
          <MiniStat icon={Gauge} label="Avg Recovery" value={`${totals.avgRecovery}%`} color="text-fuchsia-700" />
        )}
        {totals.totalDrillingHours > 0 && (
          <MiniStat icon={Clock} label="Drilling Time" value={`${totals.totalDrillingHours}h`} color="text-blue-700" />
        )}
        {totals.totalDrillingDays > 0 && (
          <MiniStat icon={CalendarDays} label="Drill Days" value={totals.totalDrillingDays} color="text-cyan-700" />
        )}
        {totals.avgDrillRate != null && (
          <MiniStat icon={TrendingUp} label="Avg Rate" value={`${totals.avgDrillRate}m/h`} color="text-emerald-700" />
        )}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <p className="text-[10px] uppercase font-medium text-white/70 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className="insight-card rounded-xl px-3 py-3 text-center">
      <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">{label}</p>
    </div>
  );
}