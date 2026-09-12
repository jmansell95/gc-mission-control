import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lightbulb, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';

export default function DashboardInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const weekStart = startOfWeek(new Date());
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: async () => (await base44.entities.RotaAssignment.list()).filter(r => r.week_start === weekStartStr)
  });

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todays = rotas.filter(r => r.assigned_date === todayStr);
      const staffUtil = staff.map(s => ({ name: s.name, role: s.job_role, days: rotas.filter(r => r.staff_id === s.id).length }));
      const today = new Date();
      const exp = (d) => { if (!d) return null; return Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000); };
      const vehicleAlerts = vehicles.filter(v => {
        const m = exp(v.mot_expiry), s = exp(v.service_due_date);
        return (m !== null && m <= 30) || (s !== null && s <= 30);
      });
      const context = `Active jobs: ${activeJobs.length} of ${jobs.length} total. Today ${todays.length} assignments covering ${new Set(todays.map(r => r.staff_id)).size} staff. Staff utilisation this week (out of 7 days): ${JSON.stringify(staffUtil)}. Vehicles with maintenance due within 30 days: ${vehicleAlerts.length} of ${vehicles.length}.`;
      const prompt = `You are an operations assistant for a UK groundworks & drilling company. Based on this week's data, give 3-4 concise, actionable insights for the operations manager. Focus on staffing gaps, utilisation, and maintenance risk. Data: ${context} Return JSON with "summary" (one sentence) and "insights" (array of short bullet strings, each under 15 words).`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: { summary: { type: 'string' }, insights: { type: 'array', items: { type: 'string' } } } }
      });
      setInsights(res);
    } catch (e) {
      setError(e.message || 'Failed to generate insights');
    }
    setLoading(false);
  };

  return (
    <div className="hub-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Weekly Insights</h2>
            <p className="text-xs text-slate-500">AI-generated operational summary</p>
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Generating...' : insights ? 'Regenerate' : 'Generate'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!insights && !loading && !error && (
        <p className="text-sm text-slate-500">Click generate for an AI summary of this week's operations, staffing and maintenance.</p>
      )}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (<div key={i} className="h-4 bg-slate-200/70 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />))}
        </div>
      )}
      {insights && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {insights.summary && (
            <p className="text-sm font-medium text-slate-700 mb-3 p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
              {insights.summary}
            </p>
          )}
          <div className="space-y-2">
            {(insights.insights || []).map((tip, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2 text-sm text-slate-600">
                <Lightbulb className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>{tip}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}