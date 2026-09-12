import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, RefreshCw, CalendarClock, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Predictive Job Completion Forecasting — AI-driven estimates of job completion
 * dates based on progress, crew, and historical data.
 *
 * For each active job, uses InvokeLLM to estimate a realistic completion date
 * and flags jobs at risk of running over.
 */
export default function PredictiveCompletionWidget() {
  const [forecasts, setForecasts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['predictive-completion-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress'] } }, '-start_date', 30),
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['predictive-completion-rotas'],
    queryFn: () => base44.entities.RotaAssignment.filter({ status: { $in: ['assigned', 'started'] } }, '-assigned_date', 100),
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['predictive-completion-milestones'],
    queryFn: () => base44.entities.JobMilestone.filter({ is_completed: false }, '-due_date', 50),
  });

  const generateForecasts = async () => {
    if (jobs.length === 0) { setForecasts([]); return; }
    setLoading(true);
    setError(null);
    try {
      const jobSummaries = jobs.slice(0, 15).map(j => ({
        id: j.id,
        name: j.name,
        status: j.status,
        start_date: j.start_date,
        planned_end_date: j.end_date,
        budget: j.budget_amount,
        actual_cost: j.actual_cost,
        meterage: j.meterage,
        meterage_target: j.meterage_target,
        crew_assigned: rotas.filter(r => r.job_id === j.id).length,
        open_milestones: milestones.filter(m => m.job_id === j.id).length,
      }));

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a project forecasting AI for a geotechnical drilling and groundworks company. For each active job below, estimate a realistic completion date and risk level based on the data provided. Consider crew size, open milestones, budget burn, and meterage progress.

Jobs: ${JSON.stringify(jobSummaries)}

For each job, return:
- job_id: the job id
- predicted_end_date: ISO date string (YYYY-MM-DD) of your estimated completion
- risk_level: "on_track" | "at_risk" | "overdue"
- days_variance: integer (predicted minus planned end date; negative = early, positive = late)
- reason: 1-sentence explanation

Return as JSON object with "forecasts" array.`,
        response_json_schema: {
          type: 'object',
          properties: {
            forecasts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  job_id: { type: 'string' },
                  predicted_end_date: { type: 'string' },
                  risk_level: { type: 'string', enum: ['on_track', 'at_risk', 'overdue'] },
                  days_variance: { type: 'number' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      });

      setForecasts(res?.forecasts || []);
    } catch (e) {
      setError(e.message || 'Failed to generate forecasts');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (jobs.length > 0 && !forecasts && !loading) {
      generateForecasts();
    }
  }, [jobs.length]);

  const riskConfig = {
    on_track: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'On Track' },
    at_risk: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', label: 'At Risk' },
    overdue: { icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', label: 'Overdue' },
  };

  const enrichedForecasts = (forecasts || []).map(f => {
    const job = jobs.find(j => j.id === f.job_id);
    return { ...f, job };
  }).filter(f => f.job);

  const onTrack = enrichedForecasts.filter(f => f.risk_level === 'on_track').length;
  const atRisk = enrichedForecasts.filter(f => f.risk_level === 'at_risk').length;
  const overdue = enrichedForecasts.filter(f => f.risk_level === 'overdue').length;

  return (
    <WidgetShell
      icon={Brain}
      title="Completion Forecast"
      subtitle="AI-predicted job finish dates"
      action={
        <button
          onClick={generateForecasts}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      }
    >
      {loading && !forecasts ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
          <p className="text-sm text-slate-500">Forecasting completion dates…</p>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 bg-rose-50 rounded-lg px-3 py-2.5 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : enrichedForecasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarClock className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No active jobs to forecast</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex gap-2">
            <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-emerald-700 tabular-nums">{onTrack}</p>
              <p className="text-[11px] text-emerald-600 font-medium">On Track</p>
            </div>
            <div className="flex-1 bg-amber-50 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-700 tabular-nums">{atRisk}</p>
              <p className="text-[11px] text-amber-600 font-medium">At Risk</p>
            </div>
            <div className="flex-1 bg-rose-50 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-rose-700 tabular-nums">{overdue}</p>
              <p className="text-[11px] text-rose-600 font-medium">Overdue</p>
            </div>
          </div>

          {/* Forecast list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {enrichedForecasts.slice(0, 8).map((f, i) => {
              const cfg = riskConfig[f.risk_level] || riskConfig.on_track;
              const Icon = cfg.icon;
              const plannedEnd = f.job.end_date ? parseISO(f.job.end_date) : null;
              const predictedEnd = f.predicted_end_date ? parseISO(f.predicted_end_date) : null;
              return (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.job.name}</p>
                      {f.days_variance !== 0 && (
                        <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${f.days_variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {f.days_variance > 0 ? '+' : ''}{f.days_variance}d
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {plannedEnd && <span>Planned: {format(plannedEnd, 'dd MMM')}</span>}
                      {predictedEnd && (
                        <>
                          <span className="text-slate-300">→</span>
                          <span className="font-medium text-slate-700">Predicted: {format(predictedEnd, 'dd MMM')}</span>
                        </>
                      )}
                    </div>
                    {f.reason && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.reason}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}