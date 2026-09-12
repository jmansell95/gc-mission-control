import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FolderKanban, Loader2, TrendingUp, PoundSterling, Calculator, Percent,
  FileText, ChevronDown, ChevronRight, Mountain, Layers, ArrowRightLeft,
  Wallet, Receipt, Building2, Briefcase,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';
import { Skeleton } from '@/components/StateViews';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const STATUS_STYLES = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  decommissioning: 'bg-amber-100 text-amber-700',
  completed: 'bg-primary/15 text-primary',
  on_hold: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-500 line-through',
};
const STATUS_LABELS = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function ProjectFinancialsDetail({ onSelectJob }) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);

  const { data: projects = [], isLoading: projLoading } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['pfd-clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['pfd-invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();

  const jobs = allFin?.jobs || [];
  const finMap = allFin?.finMap || {};
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  // Group jobs by project
  const jobsByProject = useMemo(() => {
    const map = {};
    jobs.forEach((j) => { if (j.project_id) { (map[j.project_id] ||= []).push(j); } });
    return map;
  }, [jobs]);

  // Only show projects that have jobs
  const projectOptions = useMemo(
    () => projects.filter((p) => (jobsByProject[p.id] || []).length > 0),
    [projects, jobsByProject]
  );

  const effectiveProjectId = selectedProjectId || projectOptions[0]?.id || null;
  const project = projects.find((p) => p.id === effectiveProjectId);
  const projectJobs = useMemo(() => jobsByProject[effectiveProjectId] || [], [jobsByProject, effectiveProjectId]);

  // Invoiced per job
  const projectJobIds = useMemo(() => new Set(projectJobs.map((j) => j.id)), [projectJobs]);
  const invoicedByJob = {};
  invoices.forEach((inv) => {
    if (inv.status === 'void' || !projectJobIds.has(inv.job_id)) return;
    invoicedByJob[inv.job_id] = (invoicedByJob[inv.job_id] || 0) + (Number(inv.net_total) || 0);
  });

  // Build per-job rows with full breakdown from calculateJobFinancials
  const jobRows = useMemo(() => projectJobs.map((j) => {
    const fin = finMap[j.id];
    const s = fin?.summary || {};
    const cb = fin?.cost_breakdown || {};
    const dp = fin?.drilling_performance || {};
    const earned = s.total_revenue_net || 0;
    const invoiced = invoicedByJob[j.id] || 0;
    return {
      id: j.id,
      name: j.name,
      status: j.status,
      client: clientById[j.client_id]?.name || '—',
      revenueMethod: s.revenue_method_label || s.revenue_method || '—',
      revenueNet: earned,
      costNet: s.total_cost_net || 0,
      profit: s.profit || 0,
      marginPct: s.margin_pct || 0,
      invoiced,
      unbilled: Math.max(0, earned - invoiced),
      metres: dp.total_metres || 0,
      meterageRevenue: s.meterage_revenue || 0,
      sorRevenue: s.sor_revenue || 0,
      additionalCharges: s.additional_charges || 0,
      subconSell: s.subcon_client_charge_net || 0,
      hireRevenue: s.hire_client_charge_net || 0,
      equipment: cb.equipment_net || 0,
      rigCost: cb.rig_cost || 0,
      crewCost: cb.crew_cost || 0,
      hotelCost: cb.hotel_net || 0,
      dailyCosts: cb.daily_costs_net || 0,
      subconBuy: cb.subcon_purchase_net || 0,
      subconMargin: cb.subcon_margin_net || 0,
      matchedCount: s.matched_count || 0,
      unmatchedCount: s.unmatched_count || 0,
    };
  }), [projectJobs, finMap, invoicedByJob, clientById]);

  // Project-level roll-up
  const totals = useMemo(() => jobRows.reduce((acc, r) => {
    acc.revenue += r.revenueNet;
    acc.cost += r.costNet;
    acc.profit += r.profit;
    acc.invoiced += r.invoiced;
    acc.unbilled += r.unbilled;
    acc.equipment += r.equipment;
    acc.rig += r.rigCost;
    acc.crew += r.crewCost;
    acc.hotel += r.hotelCost;
    acc.dailyCosts += r.dailyCosts;
    acc.subconBuy += r.subconBuy;
    acc.subconSell += r.subconSell;
    acc.meterage += r.meterageRevenue;
    acc.sor += r.sorRevenue;
    acc.additional += r.additionalCharges;
    acc.metres += r.metres;
    return acc;
  }, { revenue: 0, cost: 0, profit: 0, invoiced: 0, unbilled: 0, equipment: 0, rig: 0, crew: 0, hotel: 0, dailyCosts: 0, subconBuy: 0, subconSell: 0, meterage: 0, sor: 0, additional: 0, metres: 0 }), [jobRows]);

  const marginPct = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const realizationPct = totals.revenue > 0 ? Math.round((totals.invoiced / totals.revenue) * 100) : 0;
  const isLoading = projLoading || finLoading;

  if (isLoading) {
    return (
      <div>
        <SettingsSectionHeader icon={FolderKanban} title="Project Financials" description="Full financial breakdown across every job in a project" />
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  if (projectOptions.length === 0) {
    return (
      <div>
        <SettingsSectionHeader icon={FolderKanban} title="Project Financials" description="Full financial breakdown across every job in a project" />
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No projects with jobs yet</p>
          <p className="text-xs mt-1">Link jobs to a project to see a financial roll-up.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        icon={FolderKanban}
        title="Project Financials"
        description="Full financial breakdown across every job in a project — figures match each job's Financials tab exactly"
      />

      {/* Project selector */}
      <div className="hub-glass rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
          <select
            value={effectiveProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary bg-white"
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.reference ? ` (${p.reference})` : ''}</option>
            ))}
          </select>
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
            {jobRows.length} job{jobRows.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Project-level headline figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="hub-glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg stat-gradient-brand flex items-center justify-center"><TrendingUp className="w-4 h-4 text-white" /></div>
            <p className="text-[10px] text-slate-400 uppercase font-medium">Revenue (net)</p>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{fmt(totals.revenue)}</p>
        </div>
        <div className="hub-glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg stat-gradient-amber flex items-center justify-center"><Calculator className="w-4 h-4 text-white" /></div>
            <p className="text-[10px] text-slate-400 uppercase font-medium">Cost (net)</p>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{fmt(totals.cost)}</p>
        </div>
        <div className="hub-glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg stat-gradient-emerald flex items-center justify-center"><PoundSterling className="w-4 h-4 text-white" /></div>
            <p className="text-[10px] text-slate-400 uppercase font-medium">Profit</p>
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: totals.profit >= 0 ? '#059669' : '#dc2626' }}>{fmt(totals.profit)}</p>
        </div>
        <div className="hub-glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg stat-gradient-violet flex items-center justify-center"><Percent className="w-4 h-4 text-white" /></div>
            <p className="text-[10px] text-slate-400 uppercase font-medium">Margin</p>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{marginPct.toFixed(1)}%</p>
        </div>
      </div>

      {/* Revenue & cost breakdown strips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Revenue breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Revenue Breakdown</h3>
          </div>
          <div className="space-y-2">
            {totals.meterage > 0 && <BreakdownRow icon={Mountain} label="Meterage" value={totals.meterage} total={totals.revenue} tone="blue" />}
            {totals.sor > 0 && <BreakdownRow icon={Layers} label="SOR lines" value={totals.sor} total={totals.revenue} tone="emerald" />}
            {totals.additional > 0 && <BreakdownRow icon={Receipt} label="Delivery & task charges" value={totals.additional} total={totals.revenue} tone="amber" />}
            {totals.subconSell > 0 && <BreakdownRow icon={ArrowRightLeft} label="Sub-con sell" value={totals.subconSell} total={totals.revenue} tone="orange" />}
            {totals.hireRevenue > 0 && <BreakdownRow icon={Briefcase} label="Plant hire" value={totals.hireRevenue} total={totals.revenue} tone="violet" />}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">Total Revenue</span>
            <span className="font-bold text-primary tabular-nums">{fmt(totals.revenue)}</span>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-800">Cost Breakdown</h3>
          </div>
          <div className="space-y-2">
            {totals.equipment > 0 && <BreakdownRow icon={Briefcase} label="Equipment" value={totals.equipment} total={totals.cost} tone="slate" />}
            {totals.rig > 0 && <BreakdownRow icon={Mountain} label="Rigs" value={totals.rig} total={totals.cost} tone="amber" />}
            {totals.crew > 0 && <BreakdownRow icon={Wallet} label="Crew" value={totals.crew} total={totals.cost} tone="blue" />}
            {totals.hotel > 0 && <BreakdownRow icon={Building2} label="Accommodation" value={totals.hotel} total={totals.cost} tone="violet" />}
            {totals.dailyCosts > 0 && <BreakdownRow icon={Receipt} label="Daily costs" value={totals.dailyCosts} total={totals.cost} tone="rose" />}
            {totals.subconBuy > 0 && <BreakdownRow icon={ArrowRightLeft} label="Sub-con (buy)" value={totals.subconBuy} total={totals.cost} tone="orange" />}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">Total Cost</span>
            <span className="font-bold text-amber-700 tabular-nums">{fmt(totals.cost)}</span>
          </div>
        </div>
      </div>

      {/* Invoicing status */}
      <div className="hub-glass rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Earned</p>
            <p className="text-lg font-bold text-slate-700 tabular-nums">{fmt(totals.revenue)}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-600 uppercase font-medium">Invoiced</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(totals.invoiced)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-amber-600 uppercase font-medium">Unbilled</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">{fmt(totals.unbilled)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${realizationPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums">{realizationPct}%</span>
        </div>
      </div>

      {/* Per-job breakdown table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Per-Job Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">Click a row to expand the full cost & revenue breakdown</p>
        </div>
        {jobRows.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Briefcase className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            No jobs linked to {project?.name || 'this project'} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Job</th>
                  <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  <th className="text-right px-3 py-2.5 font-medium">Revenue</th>
                  <th className="text-right px-3 py-2.5 font-medium">Cost</th>
                  <th className="text-right px-3 py-2.5 font-medium">Profit</th>
                  <th className="text-right px-3 py-2.5 font-medium">Margin</th>
                  <th className="text-right px-3 py-2.5 font-medium">Invoiced</th>
                  <th className="text-right px-3 py-2.5 font-medium">Unbilled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobRows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr
                      className="hover:bg-primary/5 transition cursor-pointer"
                      onClick={() => setExpandedJob(expandedJob === r.id ? null : r.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedJob === r.id ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <div className="min-w-0">
                            <button onClick={(e) => { e.stopPropagation(); onSelectJob?.({ id: r.id, name: r.name }); }} className="text-left font-medium text-slate-800 hover:text-primary truncate block">
                              {r.name}
                            </button>
                            <p className="text-[10px] text-slate-400">{r.client} · {r.revenueMethod}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-700 tabular-nums">{fmt(r.revenueNet)}</td>
                      <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{fmt(r.costNet)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: r.profit >= 0 ? '#059669' : '#dc2626' }}>{fmt(r.profit)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{r.marginPct.toFixed(1)}%</td>
                      <td className="px-3 py-3 text-right text-emerald-600 tabular-nums">{fmt(r.invoiced)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: r.unbilled > 0 ? '#b45309' : '#94a3b8' }}>{fmt(r.unbilled)}</td>
                    </tr>
                    {expandedJob === r.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Revenue detail */}
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-medium mb-2">Revenue Detail</p>
                              <div className="space-y-1.5">
                                {r.meterageRevenue > 0 && <DetailRow label="Meterage" value={r.meterageRevenue} metres={r.metres} />}
                                {r.sorRevenue > 0 && <DetailRow label="SOR lines" value={r.sorRevenue} sub={`${r.matchedCount} matched`} />}
                                {r.additionalCharges > 0 && <DetailRow label="Delivery & task" value={r.additionalCharges} />}
                                {r.subconSell > 0 && <DetailRow label="Sub-con sell" value={r.subconSell} sub={`buy ${fmt(r.subconBuy)}`} />}
                                {r.hireRevenue > 0 && <DetailRow label="Plant hire" value={r.hireRevenue} />}
                                {r.revenueNet === 0 && <p className="text-xs text-slate-400">No revenue data yet</p>}
                              </div>
                            </div>
                            {/* Cost detail */}
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-medium mb-2">Cost Detail</p>
                              <div className="space-y-1.5">
                                {r.equipment > 0 && <DetailRow label="Equipment" value={r.equipment} />}
                                {r.rigCost > 0 && <DetailRow label="Rigs" value={r.rigCost} />}
                                {r.crewCost > 0 && <DetailRow label="Crew" value={r.crewCost} />}
                                {r.hotelCost > 0 && <DetailRow label="Accommodation" value={r.hotelCost} />}
                                {r.dailyCosts > 0 && <DetailRow label="Daily costs" value={r.dailyCosts} />}
                                {r.subconBuy > 0 && <DetailRow label="Sub-con (buy)" value={r.subconBuy} sub={`margin ${fmt(r.subconMargin)}`} />}
                                {r.costNet === 0 && <p className="text-xs text-slate-400">No cost data yet</p>}
                              </div>
                            </div>
                          </div>
                          {r.unmatchedCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <FileText className="w-3.5 h-3.5" />
                              {r.unmatchedCount} activities with no rate card match — pricing incomplete
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-slate-700" colSpan={2}>Project Total</td>
                  <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{fmt(totals.revenue)}</td>
                  <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{fmt(totals.cost)}</td>
                  <td className="px-3 py-3 text-right tabular-nums" style={{ color: totals.profit >= 0 ? '#059669' : '#dc2626' }}>{fmt(totals.profit)}</td>
                  <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{marginPct.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-right text-emerald-600 tabular-nums">{fmt(totals.invoiced)}</td>
                  <td className="px-3 py-3 text-right text-amber-700 tabular-nums">{fmt(totals.unbilled)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ icon: Icon, label, value, total, tone }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const toneClasses = {
    blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
    orange: 'bg-orange-500', violet: 'bg-violet-500', slate: 'bg-slate-500', rose: 'bg-rose-500',
  };
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-600 flex-1 truncate">{label}</span>
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${toneClasses[tone] || 'bg-slate-500'} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 tabular-nums w-20 text-right">{fmt(value)}</span>
    </div>
  );
}

function DetailRow({ label, value, sub, metres }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="min-w-0">
        <span className="text-slate-600">{label}</span>
        {sub && <span className="text-[10px] text-slate-400 ml-1.5">{sub}</span>}
        {metres > 0 && <span className="text-[10px] text-blue-500 ml-1.5">{metres.toFixed(1)}m</span>}
      </div>
      <span className="font-semibold text-slate-700 tabular-nums flex-shrink-0">{fmt(value)}</span>
    </div>
  );
}