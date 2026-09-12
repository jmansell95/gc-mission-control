import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * Phase 8 — AI: Predictive Insights widget.
 *
 * Uses InvokeLLM to analyse active jobs and generate proactive
 * recommendations — schedule risks, budget alerts, compliance gaps,
 * and efficiency opportunities. Refreshes on demand.
 */
export default function PredictiveInsightsWidget() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['ai-insights-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress', 'decommissioning'] } }, '-created_date', 50),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['ai-insights-timesheets'],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'submitted' }, '-created_date', 20),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['ai-insights-assets'],
    queryFn: () => base44.entities.SiteAsset.filter({ asset_type: 'rig', maintenance_status: { $in: ['due_soon', 'overdue'] } }, '-created_date', 20),
  });

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const context = {
        activeJobs: jobs.length,
        jobsAtRisk: jobs.filter(j => j.status === 'on_hold').length,
        pendingTimesheets: timesheets.length,
        rigsFlagged: assets.length,
        flaggedRigNames: assets.map(a => a.name),
      };

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an operations AI assistant for a geotechnical drilling and groundworks company. Analyse the following operational snapshot and provide 3-5 concise, actionable insights. Focus on risks, opportunities, and recommended actions. Each insight should be 1-2 sentences with a clear recommendation.

Operational snapshot:
- Active jobs: ${context.activeJobs}
- Jobs on hold: ${context.jobsAtRisk}
- Pending timesheet approvals: ${context.pendingTimesheets}
- Rigs flagged for maintenance: ${context.rigsFlagged} (${context.flaggedRigNames.join(', ') || 'none'})

Format as a JSON array of objects with "type" (risk/opportunity/action), "title" (short headline), and "detail" (1-2 sentence recommendation).`,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['risk', 'opportunity', 'action'] },
                  title: { type: 'string' },
                  detail: { type: 'string' },
                },
              },
            },
          },
        },
      });

      setInsights(res?.insights || []);
    } catch (e) {
      setError(e.message || 'Failed to generate insights');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (jobs.length > 0 && !insights && !loading) {
      generateInsights();
    }
  }, [jobs.length]);

  const typeConfig = {
    risk: { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    opportunity: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    action: { icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  };

  return (
    <WidgetShell
      icon={Sparkles}
      title="Predictive Insights"
      subtitle="AI-powered operational recommendations"
      action={
        <button
          onClick={generateInsights}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      }
    >
      {loading && !insights ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
          <p className="text-sm text-slate-500">Analysing operations…</p>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 bg-rose-50 rounded-lg px-3 py-2.5 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : !insights || insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No insights generated yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Click Refresh to analyse</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => {
            const cfg = typeConfig[insight.type] || typeConfig.action;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                <div className={`w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{insight.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}