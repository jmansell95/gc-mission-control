import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Mountain, TrendingUp, Clock, AlertTriangle, CheckCircle2, Loader2, PoundSterling,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { getTotalMetres } from '@/utils/geotechBilling';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const DELAY_LABELS = {
  ground_conditions: 'Ground Conditions', utility_clash: 'Utility Clash', weather: 'Weather',
  mechanical_failure: 'Mechanical', access_issue: 'Access', client_request: 'Client Request',
  third_party: 'Third Party', other: 'Other',
};

export default function SiteActivitySummary({ job, invLogs, canSeeCosts, fin }) {
  // Fetch delay logs for the job
  const { data: delayLogs = [] } = useQuery({
    queryKey: ['job-delay-logs-summary', job.id],
    queryFn: () => base44.entities.JobDelayLog.filter({ job_id: job.id }),
    enabled: !!job.id,
  });

  // Daily metreage data for the chart
  const dailyMetreage = useMemo(() => {
    const byDate = {};
    invLogs.forEach(l => {
      if (!l.date || !l.borehole_ref) return;
      const metres = (l.depth_to || 0) - (l.depth_from || 0);
      if (metres <= 0) return;
      if (!byDate[l.date]) byDate[l.date] = 0;
      byDate[l.date] += metres;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14) // last 14 working days
      .map(([date, metres]) => ({
        date: format(new Date(date + 'T00:00:00'), 'dd MMM'),
        metres: Math.round(metres * 10) / 10,
      }));
  }, [invLogs]);

  // Borehole completion stats
  const boreholeStats = useMemo(() => {
    const byRef = {};
    invLogs.forEach(l => {
      if (!l.borehole_ref) return;
      if (!byRef[l.borehole_ref]) byRef[l.borehole_ref] = { ref: l.borehole_ref, status: 'unchecked' };
      if (l.borehole_status === 'complete') byRef[l.borehole_ref].status = 'complete';
      else if (l.borehole_status === 'in_progress' && byRef[l.borehole_ref].status !== 'complete') byRef[l.borehole_ref].status = 'in_progress';
    });
    const all = Object.values(byRef);
    return {
      total: all.length,
      completed: all.filter(b => b.status === 'complete').length,
      inProgress: all.filter(b => b.status === 'in_progress').length,
      unchecked: all.filter(b => b.status === 'unchecked').length,
    };
  }, [invLogs]);

  // Cost per metre
  const totalMetres = getTotalMetres(invLogs);
  const totalCost = fin?.summary?.total_cost_net || 0;
  const costPerMetre = totalMetres > 0 ? totalCost / totalMetres : 0;

  // Delay summary
  const delaySummary = useMemo(() => {
    const approved = delayLogs.filter(d => d.manager_review_status === 'approved');
    const totalLostHours = approved.reduce((s, d) => s + (Number(d.duration_hours) || 0), 0);
    const byCause = {};
    approved.forEach(d => {
      const cause = d.delay_cause || 'other';
      if (!byCause[cause]) byCause[cause] = { cause, count: 0, hours: 0 };
      byCause[cause].count++;
      byCause[cause].hours += Number(d.duration_hours) || 0;
    });
    return {
      totalDelays: approved.length,
      pendingDelays: delayLogs.filter(d => d.manager_review_status === 'pending').length,
      totalLostHours: Math.round(totalLostHours * 10) / 10,
      topCauses: Object.values(byCause).sort((a, b) => b.hours - a.hours).slice(0, 4),
    };
  }, [delayLogs]);

  const hasData = dailyMetreage.length > 0 || boreholeStats.total > 0 || delaySummary.totalDelays > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-3">
      {/* Stat tiles row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Boreholes completed */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Mountain className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Boreholes</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{boreholeStats.completed}<span className="text-sm text-slate-400">/{boreholeStats.total}</span></p>
          <div className="flex items-center gap-1 mt-1 text-[10px]">
            {boreholeStats.inProgress > 0 && <span className="text-blue-600 font-medium">{boreholeStats.inProgress} active</span>}
            {boreholeStats.unchecked > 0 && <span className="text-slate-400 font-medium">{boreholeStats.unchecked} unchecked</span>}
          </div>
        </div>

        {/* Total drilled */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Drilled</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{totalMetres.toFixed(1)}m</p>
          <p className="text-[10px] text-slate-400 mt-1">{dailyMetreage.length} working days</p>
        </div>

        {/* Cost per metre */}
        {canSeeCosts && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <PoundSterling className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cost / m</span>
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{costPerMetre > 0 ? fmt(costPerMetre) : '—'}</p>
            <p className="text-[10px] text-slate-400 mt-1">{totalCost > 0 ? `${fmt(totalCost)} spent` : ''}</p>
          </div>
        )}

        {/* Lost time */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lost Time</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{delaySummary.totalLostHours}h</p>
          <p className="text-[10px] text-slate-400 mt-1">{delaySummary.totalDelays} approved delays</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily metreage chart */}
        {dailyMetreage.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[#2E5A1A]" />
              <h3 className="text-sm font-semibold text-slate-900">Daily Drilling Progress</h3>
              <span className="ml-auto text-[10px] text-slate-400">Last 14 days</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyMetreage} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${v}m`, 'Drilled']}
                />
                <Bar dataKey="metres" radius={[4, 4, 0, 0]}>
                  {dailyMetreage.map((entry, i) => (
                    <Cell key={i} fill={i === dailyMetreage.length - 1 ? '#2E5A1A' : '#8DC63F'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Delay summary */}
        {delaySummary.totalDelays > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">Delay Summary</h3>
              {delaySummary.pendingDelays > 0 && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                  {delaySummary.pendingDelays} pending review
                </span>
              )}
            </div>
            <div className="space-y-2">
              {delaySummary.topCauses.map(c => (
                <div key={c.cause} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-xs text-slate-700 font-medium flex-1">{DELAY_LABELS[c.cause] || c.cause}</span>
                  <span className="text-xs text-slate-500">{c.count}× · {Math.round(c.hours * 10) / 10}h</span>
                </div>
              ))}
              {delaySummary.topCauses.length === 0 && (
                <p className="text-xs text-slate-400">No approved delays with recorded causes.</p>
              )}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total lost time</span>
              <span className="font-bold text-red-600">{delaySummary.totalLostHours} hours</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}