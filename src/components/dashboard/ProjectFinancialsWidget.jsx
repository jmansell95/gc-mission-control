import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, FileText, Loader2, TrendingUp, Building2, Layers, Mountain, Calculator, Percent, ArrowRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

// Project Financials — rolls up earned, cost, profit, invoiced & unbilled across
// every job linked to a project. Uses the shared calculateJobFinancials engine so
// figures match the job detail Financials tab exactly. Click "Full Breakdown" to
// open the ProjectFinancialsDetail page with per-job drill-down.
export default function ProjectFinancialsWidget({ onNavigate }) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const { data: projects = [], isLoading: projLoading } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['project-fin-invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();
  const jobs = allFin?.jobs || [];
  const finMap = allFin?.finMap || {};

  const jobsByProject = useMemo(() => {
    const map = {};
    jobs.forEach((j) => { if (j.project_id) { (map[j.project_id] ||= []).push(j); } });
    return map;
  }, [jobs]);

  const projectOptions = useMemo(
    () => projects.filter((p) => (jobsByProject[p.id] || []).length > 0),
    [projects, jobsByProject]
  );

  const effectiveProjectId = selectedProjectId || projectOptions[0]?.id || null;
  const project = projects.find((p) => p.id === effectiveProjectId);

  const projectJobs = useMemo(
    () => (jobsByProject[effectiveProjectId] || []),
    [jobsByProject, effectiveProjectId]
  );

  // Roll up revenue, cost, profit from the calculateJobFinancials engine
  const totals = useMemo(() => {
    let revenue = 0, cost = 0, invoiced = 0;
    const projectJobIds = new Set(projectJobs.map((j) => j.id));
    projectJobs.forEach((j) => {
      const fin = finMap[j.id];
      revenue += fin?.summary?.total_revenue_net || 0;
      cost += fin?.summary?.total_cost_net || 0;
    });
    invoices.forEach((inv) => {
      if (inv.status === 'void' || !projectJobIds.has(inv.job_id)) return;
      invoiced += Number(inv.net_total) || 0;
    });
    const profit = revenue - cost;
    const unbilled = Math.max(0, revenue - invoiced);
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    const realizationPct = revenue > 0 ? Math.round((invoiced / revenue) * 100) : 0;
    return { revenue, cost, profit, invoiced, unbilled, marginPct, realizationPct };
  }, [projectJobs, finMap, invoices]);

  const jobRows = projectJobs.map((j) => {
    const fin = finMap[j.id];
    const s = fin?.summary || {};
    const earned = s.total_revenue_net || 0;
    const invoiced = invoices.filter((inv) => inv.job_id === j.id && inv.status !== 'void').reduce((sum, inv) => sum + (Number(inv.net_total) || 0), 0);
    return {
      id: j.id, name: j.name, status: j.status,
      earned,
      cost: s.total_cost_net || 0,
      profit: s.profit || 0,
      marginPct: s.margin_pct || 0,
      invoiced,
      unbilled: Math.max(0, earned - invoiced),
      hasMeterage: (s.meterage_revenue || 0) > 0,
      hasSor: (s.sor_revenue || 0) > 0,
    };
  }).sort((a, b) => b.earned - a.earned);

  const isLoading = projLoading || finLoading;

  return (
    <WidgetShell icon={FolderKanban} title="Project Financials" subtitle="Live roll-up of revenue, cost, profit & invoicing across all jobs in a project">
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : !effectiveProjectId ? (
        <div className="text-center py-8 px-4">
          <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No projects with jobs yet</p>
          <p className="text-xs text-slate-400 mt-1">Link jobs to a project to see a financial roll-up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Project selector + full breakdown link */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <select
              value={effectiveProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary bg-white"
            >
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.reference ? ` (${p.reference})` : ''}</option>
              ))}
            </select>
            {onNavigate && (
              <button onClick={() => onNavigate('billing')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition flex-shrink-0 whitespace-nowrap">
                Full Breakdown <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Headline figures — revenue, cost, profit, margin */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Revenue</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">{fmtGbp(totals.revenue)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Cost</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">{fmtGbp(totals.cost)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Profit</p>
              <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: totals.profit >= 0 ? '#059669' : '#dc2626' }}>{fmtGbp(totals.profit)}</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-violet-600 font-medium uppercase tracking-wide">Margin</p>
              <p className="text-sm font-bold text-violet-700 tabular-nums mt-0.5">{totals.marginPct.toFixed(0)}%</p>
            </div>
          </div>

          {/* Invoicing strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Invoiced</p>
              <p className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">{fmtGbp(totals.invoiced)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Unbilled</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">{fmtGbp(totals.unbilled)}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-primary font-medium uppercase tracking-wide">Realised</p>
              <p className="text-sm font-bold text-primary tabular-nums mt-0.5">{totals.realizationPct}%</p>
            </div>
          </div>

          {/* Realisation bar */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${totals.realizationPct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">{totals.realizationPct}%</span>
          </div>

          {/* Per-job breakdown */}
          {jobRows.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              No jobs linked to {project?.name || 'this project'} yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {jobRows.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{r.name}</span>
                    {r.hasMeterage && (
                      <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded-full font-semibold flex-shrink-0 inline-flex items-center gap-0.5">
                        <Mountain className="w-2.5 h-2.5" /> M
                      </span>
                    )}
                    {r.hasSor && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-semibold flex-shrink-0 inline-flex items-center gap-0.5">
                        <Layers className="w-2.5 h-2.5" /> SOR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 tabular-nums">{fmtGbp(r.earned)}</span>
                    {r.unbilled > 0 && <span className="text-xs font-bold text-amber-700 tabular-nums">{fmtGbp(r.unbilled)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}