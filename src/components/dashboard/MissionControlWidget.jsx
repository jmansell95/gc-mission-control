import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radar, TrendingUp, AlertTriangle, Activity, PoundSterling, Gauge, Zap, FileDown } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * MissionControlWidget — the executive command center.
 * Shows real-time burn rate, system health, and key operational gauges
 * in a single high-density panel designed for rapid decision-making.
 */
export default function MissionControlWidget({ onNavigate }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['mc-jobs'], queryFn: () => base44.entities.Job.list('-updated_date', 200) });
  const { data: invoices = [] } = useQuery({ queryKey: ['mc-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 50) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['mc-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 50) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['mc-safety'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });

  const metrics = useMemo(() => {
    const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
    const totalBudget = activeJobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const totalActualCost = activeJobs.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0);
    const burnRate = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;

    const pendingInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
    const totalInvoiceValue = invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

    const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
    const openSafety = safetyReports.length;
    const criticalSafety = safetyReports.filter(r => r.severity === 'critical' || r.severity === 'high').length;

    return { activeJobs: activeJobs.length, totalJobs: jobs.length, burnRate, pendingInvoices, overdueInvoices, totalInvoiceValue, pendingTs, openSafety, criticalSafety };
  }, [jobs, invoices, timesheets, safetyReports]);

  const systemHealth = useMemo(() => {
    const issues = [];
    if (metrics.overdueInvoices > 0) issues.push({ label: `${metrics.overdueInvoices} overdue invoice${metrics.overdueInvoices > 1 ? 's' : ''}`, severity: 'high' });
    if (metrics.criticalSafety > 0) issues.push({ label: `${metrics.criticalSafety} critical safety item${metrics.criticalSafety > 1 ? 's' : ''}`, severity: 'high' });
    if (metrics.pendingTs > 5) issues.push({ label: `${metrics.pendingTs} timesheets awaiting approval`, severity: 'medium' });
    if (metrics.burnRate > 80) issues.push({ label: `Burn rate at ${metrics.burnRate}%`, severity: 'medium' });
    return { status: issues.filter(i => i.severity === 'high').length > 0 ? 'critical' : issues.length > 0 ? 'warning' : 'healthy', issues };
  }, [metrics]);

  const healthColor = systemHealth.status === 'healthy' ? 'emerald' : systemHealth.status === 'warning' ? 'amber' : 'rose';
  const healthLabel = systemHealth.status === 'healthy' ? 'All Systems Operational' : systemHealth.status === 'warning' ? 'Minor Issues Detected' : 'Critical Attention Required';

  const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

  return (
    <WidgetShell icon={Radar} title="Mission Control Center" subtitle="Executive command view — real-time operational health">
      <div className="space-y-4">
        {/* System Health Banner */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${healthColor === 'emerald' ? 'bg-emerald-50' : healthColor === 'amber' ? 'bg-amber-50' : 'bg-rose-50'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${healthColor === 'emerald' ? 'bg-emerald-500' : healthColor === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}>
            {systemHealth.status === 'healthy' ? <Activity className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${healthColor === 'emerald' ? 'text-emerald-900' : healthColor === 'amber' ? 'text-amber-900' : 'text-rose-900'}`}>{healthLabel}</p>
            {systemHealth.issues.length > 0 && (
              <p className={`text-xs mt-0.5 ${healthColor === 'emerald' ? 'text-emerald-700' : healthColor === 'amber' ? 'text-amber-700' : 'text-rose-700'}`}>
                {systemHealth.issues.map(i => i.label).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Key Gauges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Burn Rate */}
          <div className="hub-glass rounded-xl p-3 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Burn Rate</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${metrics.burnRate > 80 ? 'text-rose-600' : metrics.burnRate > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{metrics.burnRate}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Budget consumed</p>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${metrics.burnRate > 80 ? 'bg-rose-500' : metrics.burnRate > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(metrics.burnRate, 100)}%` }} />
            </div>
          </div>

          {/* Active Jobs */}
          <div className="hub-glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Active Jobs</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{metrics.activeJobs}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">of {metrics.totalJobs} total</p>
          </div>

          {/* Outstanding Revenue */}
          <div className="hub-glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <PoundSterling className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Outstanding</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{gbp(metrics.totalInvoiceValue)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{metrics.pendingInvoices} pending · {metrics.overdueInvoices} overdue</p>
          </div>

          {/* Safety Status */}
          <div className="hub-glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-500">Open Safety</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${metrics.criticalSafety > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{metrics.openSafety}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{metrics.criticalSafety > 0 ? `${metrics.criticalSafety} critical` : 'No critical items'}</p>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate?.('jobs')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
            <Activity className="w-3.5 h-3.5" /> View Jobs
          </button>
          <button onClick={() => onNavigate?.('billing')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
            <PoundSterling className="w-3.5 h-3.5" /> Billing Hub
          </button>
          <button onClick={() => onNavigate?.('safety-hub')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
            <AlertTriangle className="w-3.5 h-3.5" /> Safety Hub
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}