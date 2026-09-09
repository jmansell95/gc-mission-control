import React, { useState, useMemo } from 'react';
import {
  Loader2, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  Calendar, AlertTriangle, CheckCircle2, Activity, PoundSterling, Clock,
  Briefcase,
} from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

// Project Health Dashboard — per-job health score combining schedule
// progress, compliance status and financials into one executive health badge.
// Rebuilt at the Job level (Jobs ARE the projects in this app).
// Each job gets a health badge (green/amber/red) based on:
//   • Schedule — is the job on time or slipping?
//   • Compliance — any expired equipment or staff quals?
//   • Financials — is margin positive and within budget?
export default function ProjectHealthDashboardWidget({ onNavigate }) {
  const [selectedJobId, setSelectedJobId] = useState(null);

  const { data: assets = [] } = useQuery({
    queryKey: ['assets-all-health'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-staff-all-health'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();

  const jobs = allFin?.jobs || [];
  const finMap = allFin?.finMap || {};

  // Only show active jobs (in_progress, planning, decommissioning)
  const activeJobs = useMemo(
    () => jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled'),
    [jobs]
  );

  const effectiveJobId = selectedJobId || activeJobs[0]?.id || null;
  const job = activeJobs.find(j => j.id === effectiveJobId);

  // ── Health calculations for the selected job ──
  const health = useMemo(() => {
    if (!job) return null;

    const fin = finMap[job.id] || {};
    const totalRevenue = fin?.summary?.total_revenue_net || fin?.earned || fin?.revenue || 0;
    const totalCost = fin?.summary?.total_cost || fin?.cost || 0;
    const totalInvoiced = fin?.invoiced || 0;
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const unbilled = Math.max(0, totalRevenue - totalInvoiced);

    // Schedule — compare planned end vs today
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = j => j.end_date && j.end_date < today && j.status !== 'completed';
    const overdue = isOverdue(job);

    // Compliance — check all assets (division-scoped filtering happens at query level)
    const expiredAssets = assets.filter(a => a.compliance_status === 'expired');
    const expiringAssets = assets.filter(a => a.compliance_status === 'expiring');

    // Staff compliance
    const todayStr = today;
    const expiredStaffCompliance = complianceItems.filter(c =>
      c.category === 'staff' && c.expiry_date && c.expiry_date < todayStr
    );

    // Risk flags
    const risks = [];
    if (overdue) risks.push({ type: 'schedule', label: 'Past planned end date', severity: 'amber' });
    if (expiredAssets.length > 0) risks.push({ type: 'compliance', label: `${expiredAssets.length} asset(s) with expired compliance`, severity: 'red' });
    if (margin < 0) risks.push({ type: 'financial', label: `Negative margin (${margin.toFixed(1)}%)`, severity: 'red' });
    if (unbilled > 10000) risks.push({ type: 'financial', label: `High unbilled revenue (${fmtGbp(unbilled)})`, severity: 'amber' });
    if (expiringAssets.length > 0) risks.push({ type: 'compliance', label: `${expiringAssets.length} asset(s) expiring soon`, severity: 'amber' });
    if (expiredStaffCompliance.length > 0) risks.push({ type: 'compliance', label: `${expiredStaffCompliance.length} staff cert(s) expired`, severity: 'amber' });

    // Overall health score
    const hasRed = risks.some(r => r.severity === 'red');
    const hasAmber = risks.some(r => r.severity === 'amber');
    const healthStatus = hasRed ? 'at_risk' : hasAmber ? 'warning' : 'healthy';
    const healthScore = Math.max(0, 100 - risks.length * 15 - (hasRed ? 20 : 0));

    return {
      totalRevenue, totalCost, profit, margin, totalInvoiced, unbilled,
      overdue, expiredAssets: expiredAssets.length, expiringAssets: expiringAssets.length,
      expiredStaffCompliance: expiredStaffCompliance.length,
      risks, healthStatus, healthScore,
    };
  }, [job, finMap, assets, complianceItems]);

  if (finLoading) {
    return (
      <WidgetShell title="Job Health" icon={Activity}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      </WidgetShell>
    );
  }

  if (!activeJobs.length) {
    return (
      <WidgetShell title="Job Health" icon={Activity}>
        <div className="text-center py-8 text-sm text-slate-400">
          No active jobs yet. Health scores appear here once jobs are created and have financial activity.
        </div>
      </WidgetShell>
    );
  }

  const healthConfig = {
    healthy: { label: 'Healthy', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    warning: { label: 'Warning', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: ShieldAlert },
    at_risk: { label: 'At Risk', color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
  };

  const cfg = health ? healthConfig[health.healthStatus] : healthConfig.healthy;
  const HealthIcon = cfg.icon;

  return (
    <WidgetShell title="Job Health" icon={Activity}>
      {/* Job selector */}
      {activeJobs.length > 1 && (
        <div className="mb-3">
          <select
            value={effectiveJobId || ''}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-600 bg-white"
          >
            {activeJobs.map(j => (
              <option key={j.id} value={j.id}>{j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {job && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 truncate">{job.name}</h3>
          </div>
          {job.job_reference && (
            <p className="text-xs text-slate-500 ml-6 font-mono">{job.job_reference}</p>
          )}
        </div>
      )}

      {health && (
        <>
          {/* Health badge */}
          <div className={`flex items-center gap-2.5 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 mb-3`}>
            <HealthIcon className={`w-5 h-5 ${cfg.text} flex-shrink-0`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{health.risks.length} risk flag(s)</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${cfg.text}`}>{health.healthScore}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">score</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Revenue</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.totalRevenue)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Cost</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.totalCost)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Margin</p>
              </div>
              <p className={`text-sm font-bold ${health.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {health.margin.toFixed(1)}%
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Unbilled</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.unbilled)}</p>
            </div>
          </div>

          {/* Compliance row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`rounded-lg p-2.5 border ${health.expiredAssets > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className={`w-3.5 h-3.5 ${health.expiredAssets > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Assets Expired</p>
              </div>
              <p className={`text-sm font-bold ${health.expiredAssets > 0 ? 'text-red-700' : 'text-slate-700'}`}>{health.expiredAssets}</p>
            </div>
            <div className={`rounded-lg p-2.5 border ${health.overdue ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar className={`w-3.5 h-3.5 ${health.overdue ? 'text-amber-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Schedule</p>
              </div>
              <p className={`text-sm font-bold ${health.overdue ? 'text-amber-700' : 'text-emerald-700'}`}>{health.overdue ? 'Overdue' : 'On Track'}</p>
            </div>
          </div>

          {/* Risk flags */}
          {health.risks.length > 0 && (
            <div className="space-y-1.5">
              {health.risks.map((r, i) => {
                const Icon = r.severity === 'red' ? AlertTriangle : ShieldAlert;
                const color = r.severity === 'red' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${color}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{r.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {health.risks.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>No risk flags — job is on track.</span>
            </div>
          )}
        </>
      )}
    </WidgetShell>
  );
}