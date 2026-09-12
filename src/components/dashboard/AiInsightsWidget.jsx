import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, Lightbulb, CheckSquare, Printer } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';

export default function AiInsightsWidget() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const weekStart = startOfWeek(new Date());
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-all'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: async () => (await base44.entities.RotaAssignment.list()).filter(r => r.week_start === weekStartStr)
  });

  const generate = useCallback(async () => {
    if (!staff.length && !jobs.length) return;
    setLoading(true);
    setError(null);
    try {
      const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todays = rotas.filter(r => r.assigned_date === todayStr);

      const totalMeterage = rotas.reduce((sum, r) => sum + (Number(r.meterage) || 0), 0);
      const jobsWithRotas = [...new Set(rotas.map(r => r.job_id))];
      const unassignedActive = activeJobs.filter(j => !jobsWithRotas.includes(j.id));
      const underutilised = staff.filter(s => s.is_active !== false && rotas.filter(r => r.staff_id === s.id).length < 2);
      const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;

      const today = new Date();
      const exp = (d) => { if (!d) return null; return Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000); };
      const vehicleAlerts = vehicles.filter(v => {
        const m = exp(v.mot_expiry), s = exp(v.service_due_date);
        return (m !== null && m <= 30) || (s !== null && s <= 30);
      });

      const context = [
        `Week starting ${weekStartStr}.`,
        `${activeJobs.length} active jobs of ${jobs.length} total.`,
        `Today: ${todays.length} assignments covering ${new Set(todays.map(r => r.staff_id)).size} staff.`,
        `Total meterage logged this week: ${totalMeterage}m.`,
        `Jobs with no rota assignments this week: ${unassignedActive.length} (${unassignedActive.map(j => j.name).join(', ') || 'none'}).`,
        `Staff underutilised (<2 shifts): ${underutilised.length} (${underutilised.map(s => s.name).join(', ') || 'none'}).`,
        `Pending unapproved timesheets: ${pendingTimesheets}.`,
        `Vehicles with maintenance/MOT due within 30 days: ${vehicleAlerts.length} (${vehicleAlerts.map(v => v.name).join(', ') || 'none'}).`,
      ].join(' ');

      const prompt = `You are an operations assistant for a UK groundworks & drilling company. Based on this week's data, give 4-6 concise, actionable steps the operations manager should take THIS WEEK to improve operations. Focus on concrete actions: reassigning staff, approving timesheets, scheduling maintenance, reviewing over-budget jobs, filling rota gaps. Be specific and reference actual job/staff names from the data. Data: ${context} Return JSON with "summary" (one punchy sentence, under 20 words) and "steps" (array of action items, each under 18 words, starting with a verb).`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setInsights(res);
    } catch (e) {
      setError(e.message || 'Failed to generate insights');
    }
    setLoading(false);
  }, [staff, jobs, vehicles, timesheets, rotas, weekStartStr]);

  useEffect(() => {
    if (staff.length > 0 && jobs.length > 0 && !insights && !loading && !error) {
      generate();
    }
  }, [staff, jobs, generate]); // eslint-disable-line

  const hasInsights = insights && (insights.steps?.length || insights.summary);

  const handlePrint = () => {
    if (!hasInsights) return;
    const steps = (insights?.steps || []).map((s, i) =>
      `<li><span class="num">${i + 1}</span><span>${s.replace(/</g, '&lt;')}</span></li>`
    ).join('');
    const summary = insights?.summary ? `<p class="summary">${insights.summary.replace(/</g, '&lt;')}</p>` : '';
    const html = `<!DOCTYPE html><html><head><title>Weekly Insights — ${format(weekStart, 'dd MMM yyyy')}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#111;max-width:700px}h1{font-size:22px;margin:0 0 4px}.sub{color:#666;font-size:12px;margin-bottom:16px}.summary{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px;font-size:14px;font-weight:600;color:#065f46;margin-bottom:18px}ol{list-style:none;padding:0;margin:0}li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:1.5}.num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#047857;color:#fff;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;color:#999;font-size:10px}@media print{body{margin:10mm}}</style></head><body>
<h1>Weekly Insights</h1><p class="sub">Week of ${format(weekStart, 'dd MMMM yyyy')} · GC Mission Control</p>${summary}<ol>${steps}</ol><div class="foot">Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}</div></body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100/70 flex items-center gap-2 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 leading-tight">AI Weekly Insights</h2>
          <p className="text-xs text-slate-500">Week of {format(weekStart, 'dd MMM yyyy')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button onClick={handlePrint} disabled={!hasInsights}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-xs font-medium disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={generate} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading && !insights && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> Analysing this week's data…
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-200/70 rounded animate-pulse" style={{ width: `${85 - i * 12}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900 text-sm">Couldn't generate insights</p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}

        {hasInsights && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {insights.summary && (
              <div className="rounded-xl p-4 mb-4 bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">This Week's Summary</p>
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed">{insights.summary}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 flex items-center gap-2 border-b border-slate-100">
                <CheckSquare className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-semibold text-slate-700">Action Items</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold ml-auto">
                  {(insights.steps || []).length} steps
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {(insights.steps || []).map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-emerald-50/30 transition">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{step}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}