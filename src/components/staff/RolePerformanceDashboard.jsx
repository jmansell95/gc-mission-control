import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek } from 'date-fns';
import { TrendingUp, Target, Award, Info, Gauge } from 'lucide-react';
import { KPI_METRIC_MAP, DEPARTMENT_CONFIG } from '@/utils/kpiMetrics';

/**
 * RolePerformanceDashboard — replaces the drilling-centric StaffPerformanceCard.
 *
 * Fetches the staff member's assigned PerformanceKpiSet (matched by assigned_staff_ids
 * or role_key vs job_title), then computes each metric live from system data and
 * rolls up a weighted incentive score + total bonus earned.
 *
 * If no KPI set is assigned, falls back to a gentle empty state (not drilling metrics).
 */
export default function RolePerformanceDashboard({ staffId, staffName, jobTitle }) {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Fetch all KPI sets
  const { data: kpiSets = [], isLoading: setsLoading } = useQuery({
    queryKey: ['kpi-sets'],
    queryFn: () => base44.entities.PerformanceKpiSet.list('-sort_order', 100),
  });

  // Find the matching set: assigned_staff_ids includes this staff, or role_key matches job_title
  const kpiSet = useMemo(() => {
    const active = kpiSets.filter(s => s.is_active !== false);
    // 1. Direct assignment
    const direct = active.find(s => (s.assigned_staff_ids || []).includes(staffId));
    if (direct) return direct;
    // 2. Role key matches job title (case-insensitive contains)
    if (jobTitle) {
      const title = jobTitle.toLowerCase();
      const byRole = active.find(s => {
        const rk = (s.role_key || '').toLowerCase().replace(/_/g, ' ');
        return rk && title.includes(rk);
      });
      if (byRole) return byRole;
      // Also try set name match
      const byName = active.find(s => {
        const sn = (s.name || '').toLowerCase();
        return sn && title.includes(sn);
      });
      if (byName) return byName;
    }
    // 3. Fall back to the first set for the staff's department (if we can infer it)
    return null;
  }, [kpiSets, staffId, jobTitle]);

  // Fetch raw data for metric computation (only if we have a set)
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ['kpi-ctx', staffId, weekStart],
    queryFn: async () => {
      const [investigationLogs, timesheets, deliveryLogs, safetyReports] = await Promise.all([
        base44.entities.InvestigationLog.filter({ staff_id: staffId }, '-created_date', 200),
        base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-created_date', 50),
        base44.entities.DeliveryLog.list('-created_date', 200),
        base44.entities.SafetyReport.filter({ staff_id: staffId }, '-created_date', 50),
      ]);
      return { investigationLogs, timesheets, deliveryLogs, safetyReports, weekStart, rotaAssignments: [], goodsInReceipts: [], vehicleChecks: [], jobs: [] };
    },
    enabled: !!kpiSet && !!staffId,
  });

  if (setsLoading || ctxLoading) {
    return (
      <div className="insight-card rounded-2xl p-5">
        <div className="h-6 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // No KPI set assigned — gentle empty state, NOT drilling metrics
  if (!kpiSet || !kpiSet.metrics || kpiSet.metrics.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Gauge className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-ui-subheading font-bold text-slate-700">No performance KPIs assigned yet</h3>
        <p className="text-ui-caption text-slate-400 mt-1 max-w-sm mx-auto">
          Your manager hasn't set up role-specific KPIs for your profile yet. Once configured, you'll see your live performance metrics and incentive score here.
        </p>
      </div>
    );
  }

  const dept = DEPARTMENT_CONFIG[kpiSet.department] || DEPARTMENT_CONFIG.field;
  const accent = kpiSet.accent_color || dept.color;

  // Compute each metric
  const computedMetrics = (kpiSet.metrics || []).map(m => {
    const metricDef = KPI_METRIC_MAP[m.key];
    const result = metricDef ? metricDef.compute(staffId, ctx || {}) : { value: 0, display: '—' };
    const pct = m.target > 0 ? Math.min(100, Math.round((result.value / m.target) * 100)) : 0;
    const hitThreshold = pct >= (m.incentive_threshold || 80);
    const earnedBonus = hitThreshold ? (Number(m.bonus_amount) || 0) : 0;
    return { ...m, ...result, pct, hitThreshold, earnedBonus, icon: metricDef?.icon || Target };
  });

  // Weighted incentive score
  const totalWeight = computedMetrics.reduce((s, m) => s + (m.weight || 0), 0);
  const weightedScore = totalWeight > 0
    ? Math.round(computedMetrics.reduce((s, m) => s + (m.pct * (m.weight || 0)), 0) / totalWeight)
    : 0;
  const totalBonus = computedMetrics.reduce((s, m) => s + m.earnedBonus, 0);
  const metricsHit = computedMetrics.filter(m => m.hitThreshold).length;

  return (
    <div className="space-y-4">
      {/* Incentive score hero */}
      <div className="insight-card rounded-2xl p-5" style={{ borderColor: `${accent}30` }}>
        <div className="flex items-center gap-4">
          {/* Score ring */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={accent} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={`${(weightedScore / 100) * 213.6} 213.6`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-ui-kpi font-extrabold text-slate-900 tabular-nums leading-none">{weightedScore}</span>
              <span className="text-ui-micro text-slate-400 font-bold">SCORE</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-ui-heading font-extrabold text-slate-900">{kpiSet.name}</h2>
              <span className="text-ui-micro px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: `${dept.color}15`, color: dept.color }}>{dept.label}</span>
            </div>
            <p className="text-ui-caption text-slate-500">Week of {format(new Date(weekStart + 'T00:00:00'), 'dd MMM yyyy')}</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                <span className="text-ui-body font-bold text-emerald-600">£{totalBonus}</span>
                <span className="text-ui-caption text-slate-400">bonus earned</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-slate-500" />
                <span className="text-ui-body font-bold text-slate-700">{metricsHit}/{computedMetrics.length}</span>
                <span className="text-ui-caption text-slate-400">targets hit</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {computedMetrics.map(m => {
          const MIcon = m.icon;
          return (
            <div key={m.key} className="insight-card rounded-2xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}12` }}>
                  <MIcon className="w-4 h-4" style={{ color: accent }} />
                </div>
                {m.hitThreshold ? (
                  <span className="text-ui-micro font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ Hit</span>
                ) : (
                  <span className="text-ui-micro font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full">{m.pct}%</span>
                )}
              </div>
              <p className="text-ui-kpi font-extrabold text-slate-900 tabular-nums leading-none">{m.display}</p>
              <p className="text-ui-caption text-slate-500 font-semibold mt-1">{m.label}</p>
              <p className="text-ui-micro text-slate-400 mt-0.5">Target: {m.target}{m.unit}</p>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: accent }} />
              </div>
              {m.bonus_amount > 0 && (
                <p className="text-ui-micro text-slate-400 mt-1.5">
                  {m.hitThreshold ? <span className="text-emerald-600 font-bold">+£{m.bonus_amount} earned</span> : `£${m.bonus_amount} at ${m.incentive_threshold}%`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 px-1">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-ui-caption text-slate-400">
          Scores are calculated live from your system activity this week — site logs, timesheets, deliveries and safety checks. Your manager configures which metrics count and the incentive thresholds in Settings.
        </p>
      </div>
    </div>
  );
}