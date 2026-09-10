import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge, TrendingUp, Target, Calendar, Drill, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * RevenueVelocityWidget — live meterage drilled vs target with a projected
 * completion date based on current run-rate.
 *
 * Pulls active drilling jobs, sums their meterage vs meterage_target, and
 * calculates the daily run-rate from the last 7 days of InvestigationLog
 * borehole_progress entries.
 */
export default function RevenueVelocityWidget() {
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['velocity-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: 'in_progress' }),
  });

  const drillingJobs = useMemo(
    () => jobs.filter(j => j.drilling_method && j.drilling_method !== 'not_applicable' && j.meterage_target),
    [jobs]
  );

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['velocity-logs'],
    queryFn: () => base44.entities.InvestigationLog.filter(
      { log_type: 'borehole_progress' },
      '-created_date',
      200
    ),
  });

  const { totalDrilled, totalTarget, runRate, projectedDate, progressPct } = useMemo(() => {
    const totalTarget = drillingJobs.reduce((s, j) => s + (j.meterage_target || 0), 0);
    const totalDrilled = drillingJobs.reduce((s, j) => s + (j.meterage || 0), 0);

    // Run rate: sum units_completed from last 7 days of logs
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentMeters = recentLogs
      .filter(l => l.created_date && new Date(l.created_date).getTime() > sevenDaysAgo)
      .reduce((s, l) => s + (l.units_completed || (l.depth_to && l.depth_from ? l.depth_to - l.depth_from : 0)), 0);
    const runRate = recentMeters / 7; // meters per day

    const remaining = totalTarget - totalDrilled;
    const daysToComplete = runRate > 0 ? Math.ceil(remaining / runRate) : null;
    const projectedDate = daysToComplete != null
      ? new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000)
      : null;

    const progressPct = totalTarget > 0 ? Math.min((totalDrilled / totalTarget) * 100, 100) : 0;

    return { totalDrilled, totalTarget, runRate, projectedDate, progressPct };
  }, [drillingJobs, recentLogs]);

  const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

  // Velocity gauge — 0 to 100% progress
  const gaugeColor = progressPct >= 75 ? '#10b981' : progressPct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <WidgetShell
      icon={Gauge}
      title="Revenue Velocity"
      subtitle="Meterage vs target · live run-rate"
      action={
        <button
          onClick={() => navigate('/investigation')}
          className="text-[11px] font-semibold text-[#2E5A1A] hover:underline"
        >
          Details
        </button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : drillingJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6">
          <Drill className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No active drilling jobs with targets</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Circular progress gauge */}
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke={gaugeColor} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(progressPct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{progressPct.toFixed(0)}%</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Complete</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1">
                <Target className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{totalTarget.toLocaleString()}m</p>
              <p className="text-[10px] text-slate-400 font-medium">Target</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{totalDrilled.toLocaleString()}m</p>
              <p className="text-[10px] text-slate-400 font-medium">Drilled</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-1">
                <Gauge className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{runRate.toFixed(1)}m</p>
              <p className="text-[10px] text-slate-400 font-medium">Per Day</p>
            </div>
          </div>

          {/* Projected completion */}
          {projectedDate && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-[#2E5A1A]/5 to-[#8DC63F]/5 border border-[#2E5A1A]/10">
              <Calendar className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Projected Completion</p>
                <p className="text-sm font-bold text-slate-800">
                  {projectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}