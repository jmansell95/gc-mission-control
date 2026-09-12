import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radar, AlertTriangle, Activity, Gauge, ArrowRight, PoundSterling, ShieldCheck, TrendingUp, CheckCircle2 } from 'lucide-react';
import StateMonitorBar from '@/components/dashboard/StateMonitorBar';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

/**
 * CommandCentreSection — merges the live stat tiles with a clean Mission
 * Control strip. The Mission Control strip now includes the data formerly
 * shown in the Executive Snapshot widget (fleet compliance, project health,
 * revenue) so there's no duplicated information on the dashboard.
 */
export default function CommandCentreSection({ monitors, onNavigate }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['mc-jobs'], queryFn: () => base44.entities.Job.list('-updated_date', 200) });
  const { data: invoices = [] } = useQuery({ queryKey: ['mc-invoices'], queryFn: () => base44.entities.Invoice.list('-issue_date', 200) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['mc-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 50) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['mc-safety'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });
  const { data: siteAssets = [] } = useQuery({ queryKey: ['mc-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: delays = [] } = useQuery({ queryKey: ['mc-delays'], queryFn: () => base44.entities.JobDelayLog.filter({ manager_review_status: 'approved' }) });
  const { isConnected: scConnected } = useMittiStatus();

  const m = useMemo(() => {
    const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
    const totalBudget = activeJobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const totalActualCost = activeJobs.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0);
    const burnRate = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;
    const pendingInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
    // Outstanding = sent + overdue (matches FinancialOverviewWidget on billing page)
    const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const totalInvoiceValue = outstandingInvoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
    const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
    const openSafety = scConnected ? safetyReports.length : 0;
    const criticalSafety = scConnected ? safetyReports.filter(r => r.severity === 'critical' || r.severity === 'high').length : 0;

    // Fleet compliance
    const activeAssets = siteAssets.filter(a => a.is_active !== false);
    const compliantAssets = activeAssets.filter(a => a.compliance_status === 'compliant').length;
    const fleetCompliancePct = activeAssets.length > 0 ? Math.round((compliantAssets / activeAssets.length) * 100) : 0;

    // Project health
    const activeJobIds = new Set(activeJobs.map(j => j.id));
    const jobsWithDelays = new Set(delays.filter(d => activeJobIds.has(d.job_id)).map(d => d.job_id)).size;
    const delayedPct = activeJobs.length > 0 ? Math.round((jobsWithDelays / activeJobs.length) * 100) : 0;
    const projectHealth = delayedPct === 0 ? 'green' : delayedPct < 30 ? 'amber' : 'red';

    // Paid revenue — uses net_total to match FinancialOverviewWidget on billing page
    const paidRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.net_total) || 0), 0);

    const issues = [];
    if (overdueInvoices > 0) issues.push(`${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`);
    if (criticalSafety > 0) issues.push(`${criticalSafety} critical safety item${criticalSafety > 1 ? 's' : ''}`);
    if (pendingTs > 5) issues.push(`${pendingTs} timesheets awaiting approval`);
    if (burnRate > 80) issues.push(`Burn rate at ${burnRate}%`);

    const status = issues.filter((_, i) => i).length > 0 && (overdueInvoices > 0 || criticalSafety > 0) ? 'critical' : issues.length > 0 ? 'warning' : 'healthy';

    return {
      burnRate, pendingInvoices, overdueInvoices, totalInvoiceValue, pendingTs, openSafety, criticalSafety,
      activeJobs: activeJobs.length, totalJobs: jobs.length, issues, status,
      fleetCompliancePct, compliantAssets, totalAssets: activeAssets.length, projectHealth, jobsWithDelays, paidRevenue,
    };
  }, [jobs, invoices, timesheets, safetyReports, siteAssets, delays]);

  const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
  const isHealthy = m.status === 'healthy';
  const isWarning = m.status === 'warning';
  const healthLabel = isHealthy ? 'All Systems Operational' : isWarning ? 'Minor Issues Detected' : 'Critical Attention Required';
  const healthColor = isHealthy ? 'text-emerald-600' : isWarning ? 'text-amber-600' : 'text-rose-600';
  const healthBg = isHealthy ? 'bg-emerald-50' : isWarning ? 'bg-amber-50' : 'bg-rose-50';
  const healthRing = isHealthy ? 'ring-emerald-200' : isWarning ? 'ring-amber-200' : 'ring-rose-200';

  const burnColor = m.burnRate > 80 ? 'bg-rose-500' : m.burnRate > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  const burnText = m.burnRate > 80 ? 'text-rose-600' : m.burnRate > 60 ? 'text-amber-600' : 'text-emerald-600';

  const phMeta = {
    green: { label: 'On Track', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    amber: { label: 'Monitor', color: 'text-amber-600', bg: 'bg-amber-50' },
    red: { label: 'At Risk', color: 'text-rose-600', bg: 'bg-rose-50' },
  };
  const ph = phMeta[m.projectHealth];

  return (
    <div className="mb-4 space-y-2.5">
      {/* Stat tiles */}
      <StateMonitorBar monitors={monitors} onNavigate={onNavigate} />

      {/* Mission Control strip — clean white card with merged exec snapshot data.
          Restructured: system health banner on top (full width), metrics in a
          responsive grid below — 2×2 on mobile, single row on desktop — so
          nothing overlaps or clips on small screens. */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* System health banner — full width, always on top */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2.5">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ring-1 flex-shrink-0 ${healthBg} ${healthRing}`}>
            {isHealthy ? <Activity className={`w-4 h-4 sm:w-5 sm:h-5 ${healthColor}`} /> : <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${healthColor}`} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="text-xs font-bold text-primary uppercase tracking-wide">Mission Control</p>
            </div>
            <p className="text-sm font-bold text-slate-800 truncate">{healthLabel}</p>
            {m.issues.length > 0 && (
              <p className="text-[11px] text-slate-400 truncate">{m.issues.join(' · ')}</p>
            )}
          </div>
        </div>

        {/* Metrics grid — 2 cols on mobile, 4 cols on desktop, separated by a top border */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 px-3 pb-3 sm:px-4 sm:pb-4 pt-2.5 border-t border-slate-100">
          {/* Burn Rate */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Gauge className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className={`text-base sm:text-lg font-bold tabular-nums leading-none ${burnText}`}>{m.burnRate}%</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Burn Rate</p>
              <div className="mt-1 w-14 sm:w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${burnColor}`} style={{ width: `${Math.min(m.burnRate, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Outstanding Revenue */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <PoundSterling className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold tabular-nums text-slate-800 leading-none truncate">{gbp(m.totalInvoiceValue)}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Outstanding</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.pendingInvoices} pending · {m.overdueInvoices} overdue</p>
            </div>
          </div>

          {/* Fleet Compliance */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className={`text-base sm:text-lg font-bold tabular-nums leading-none ${m.fleetCompliancePct < 80 ? 'text-amber-600' : 'text-slate-800'}`}>{m.fleetCompliancePct}%</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Fleet Compliance</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{m.compliantAssets}/{m.totalAssets} assets</p>
            </div>
          </div>

          {/* Project Health */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-lg ${ph.bg} flex items-center justify-center flex-shrink-0`}>
              <TrendingUp className={`w-4 h-4 ${ph.color}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-base sm:text-lg font-bold leading-none ${ph.color}`}>{ph.label}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Project Health</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{m.jobsWithDelays} delayed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}