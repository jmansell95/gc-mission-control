import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  MapPin, Package, Beaker, Gauge, Clock, AlertTriangle, Activity, TrendingUp, PoundSterling, Wrench, Undo2,
} from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const DELAY_LABELS = {
  ground_conditions: 'Ground Conditions', utility_clash: 'Utility Clash', weather: 'Weather',
  mechanical_failure: 'Mechanical', access_issue: 'Access', client_request: 'Client Request',
  third_party: 'Third Party', other: 'Other',
};

// Discipline-aware activity summary for non-drilling jobs (groundworks,
// enabling works, depot). Shows trial pits, installations, grouting,
// standpipe readings, and a daily activity-count chart instead of the
// drilling-specific metreage chart.
export default function GroundworksActivitySummary({ job, invLogs, canSeeCosts, fin }) {
  const { data: delayLogs = [] } = useQuery({
    queryKey: ['job-delay-logs-gw-summary', job.id],
    queryFn: () => base44.entities.JobDelayLog.filter({ job_id: job.id }),
    enabled: !!job.id,
  });

  const isEnabling = job?.job_type === 'enabling_works';

  // Discipline-relevant activity stats
  const stats = useMemo(() => {
    const totalPits = invLogs.filter(l => l.log_type === 'pit_excavation').length;
    const totalInspectionPits = invLogs.filter(l => l.log_type === 'inspection_pit').length;
    const totalInstallations = invLogs.filter(l => l.log_type === 'installation').reduce((s, l) => s + (Number(l.units_completed) || 1), 0);
    const totalGroutLitres = invLogs.filter(l => l.log_type === 'grouting_works').reduce((s, l) => s + (Number(l.grout_volume) || 0), 0);
    const totalStandpipeReadings = invLogs.filter(l => l.log_type === 'standpipe_reading').length;
    const totalSetups = invLogs.filter(l => l.log_type === 'site_setup').length;
    const totalReinstatements = invLogs.filter(l => l.log_type === 'reinstatement').length;
    const uniqueRefs = [...new Set(invLogs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];
    return { totalPits, totalInspectionPits, totalInstallations, totalGroutLitres, totalStandpipeReadings, totalSetups, totalReinstatements, uniqueRefs };
  }, [invLogs]);

  // Daily activity count chart (last 14 working days)
  const dailyActivity = useMemo(() => {
    const byDate = {};
    invLogs.forEach(l => {
      if (!l.date) return;
      if (!byDate[l.date]) byDate[l.date] = 0;
      byDate[l.date]++;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date: format(new Date(date + 'T00:00:00'), 'dd MMM'), count }));
  }, [invLogs]);

  // Delay summary (shared logic with drilling summary)
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

  const totalCost = fin?.summary?.total_cost_net || 0;
  const workingDays = new Set(invLogs.map(l => l.date).filter(Boolean)).size;

  const hasData = invLogs.length > 0 || delaySummary.totalDelays > 0;
  if (!hasData) return null;

  // Pick 4 stat tiles based on discipline
  const tiles = isEnabling ? [
    { icon: Wrench, color: 'text-amber-600', label: 'Site Setups', value: stats.totalSetups },
    { icon: Undo2, color: 'text-emerald-600', label: 'Reinstatements', value: stats.totalReinstatements },
    { icon: Activity, color: 'text-blue-600', label: 'Log Entries', value: invLogs.length },
    { icon: Clock, color: 'text-red-500', label: 'Lost Time', value: `${delaySummary.totalLostHours}h`, sub: `${delaySummary.totalDelays} delays` },
  ] : [
    { icon: MapPin, color: 'text-amber-600', label: 'Trial Pits', value: stats.totalPits, sub: stats.totalInspectionPits > 0 ? `${stats.totalInspectionPits} insp.` : '' },
    { icon: Package, color: 'text-emerald-600', label: 'Installations', value: stats.totalInstallations },
    { icon: Beaker, color: 'text-violet-500', label: 'Grout (L)', value: stats.totalGroutLitres, sub: stats.totalStandpipeReadings > 0 ? `${stats.totalStandpipeReadings} readings` : '' },
    { icon: Clock, color: 'text-red-500', label: 'Lost Time', value: `${delaySummary.totalLostHours}h`, sub: `${delaySummary.totalDelays} delays` },
  ];

  return (
    <div className="space-y-3">
      {/* Stat tiles row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</span>
              </div>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{t.value}</p>
              {t.sub && <p className="text-[10px] text-slate-400 mt-1">{t.sub}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily activity chart */}
        {dailyActivity.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-slate-900">Daily Activity</h3>
              <span className="ml-auto text-[10px] text-slate-400">Last 14 days</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${v} entries`, 'Activity']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dailyActivity.map((_, i) => (
                    <Cell key={i} fill={i === dailyActivity.length - 1 ? '#2E5A1A' : '#8DC63F'} />
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

      {/* Cost summary for non-drilling (cost per day instead of cost per metre) */}
      {canSeeCosts && totalCost > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <PoundSterling className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Cost</p>
            <p className="text-sm font-bold text-slate-900">{fmt(totalCost)}</p>
          </div>
          {workingDays > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cost / Day</p>
              <p className="text-sm font-bold text-slate-900">{fmt(totalCost / workingDays)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}