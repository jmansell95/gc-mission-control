import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FolderKanban, Loader2, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

// Financial Reconciliation — per-job WIP grid. Shows earned, invoiced,
// unbilled and realization % for every active job in one compact table so
// Finance can spot which jobs need invoicing attention at a glance.
// Rebuilt at the Job level (Jobs ARE the projects in this app — there is no
// separate Project entity).
export default function FinancialReconciliationWidget({ onNavigate }) {
  const { data: invoices = [] } = useQuery({ queryKey: ['recon-invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();

  const jobs = allFin?.jobs || [];
  const finMap = allFin?.finMap || {};

  // Invoiced per job (sum of non-void invoice gross_totals — unified with all financial surfaces)
  const invoicedByJob = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      if (inv.status === 'void') return;
      map[inv.job_id] = (map[inv.job_id] || 0) + (Number(inv.gross_total) || 0);
    });
    return map;
  }, [invoices]);

  // One row per job — earned from financials engine, invoiced from Invoice entity
  const jobRows = useMemo(() => {
    return jobs.map(j => {
      const fin = finMap[j.id] || {};
      const earned = fin?.summary?.total_revenue_net || fin?.earned || fin?.revenue || 0;
      const invoiced = invoicedByJob[j.id] || 0;
      const unbilled = Math.max(0, earned - invoiced);
      const realizationPct = earned > 0 ? Math.round((invoiced / earned) * 100) : 0;
      return {
        id: j.id,
        name: j.name,
        reference: j.job_reference,
        status: j.status,
        earned,
        invoiced,
        unbilled,
        realizationPct,
      };
    }).filter(r => r.earned > 0 || r.invoiced > 0)
      .sort((a, b) => b.unbilled - a.unbilled);
  }, [jobs, finMap, invoicedByJob]);

  const totals = jobRows.reduce((acc, r) => {
    acc.earned += r.earned;
    acc.invoiced += r.invoiced;
    acc.unbilled += r.unbilled;
    return acc;
  }, { earned: 0, invoiced: 0, unbilled: 0 });
  const totalRealizationPct = totals.earned > 0 ? Math.round((totals.invoiced / totals.earned) * 100) : 0;
  const atRiskCount = jobRows.filter(r => r.realizationPct < 50 && r.earned > 0).length;

  const handleRowClick = (jobId) => {
    if (onNavigate) onNavigate('job-detail', { jobId });
  };

  return (
    <WidgetShell icon={FolderKanban} title="Financial Reconciliation" subtitle="Earned vs invoiced per job — WIP gap at a glance">
      {finLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : jobRows.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">
          No jobs with financial activity yet. Earned revenue appears here once jobs have logged work or cost items.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Portfolio summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total Earned</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">{fmtGbp(totals.earned)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Invoiced</p>
              <p className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">{fmtGbp(totals.invoiced)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">WIP Gap</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">{fmtGbp(totals.unbilled)}</p>
            </div>
          </div>

          {/* Realisation + at-risk alert */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${totalRealizationPct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">{totalRealizationPct}%</span>
            {atRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <AlertCircle className="w-3 h-3" /> {atRiskCount} under 50%
              </span>
            )}
          </div>

          {/* Per-job table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-semibold text-slate-400 uppercase tracking-wide py-1.5 px-2">Job</th>
                  <th className="text-right font-semibold text-slate-400 uppercase tracking-wide py-1.5 px-1">Earned</th>
                  <th className="text-right font-semibold text-slate-400 uppercase tracking-wide py-1.5 px-1">Invoiced</th>
                  <th className="text-right font-semibold text-amber-600 uppercase tracking-wide py-1.5 px-2">WIP Gap</th>
                </tr>
              </thead>
              <tbody>
                {jobRows.slice(0, 12).map(r => (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r.id)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition group"
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate max-w-[140px]">{r.name}</p>
                          {r.reference && <p className="text-[10px] text-slate-400">{r.reference}</p>}
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                      </div>
                    </td>
                    <td className="py-2 px-1 text-right text-slate-600 tabular-nums font-medium">{fmtGbp(r.earned)}</td>
                    <td className="py-2 px-1 text-right text-emerald-600 tabular-nums">{fmtGbp(r.invoiced)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`tabular-nums font-bold ${r.unbilled > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{fmtGbp(r.unbilled)}</span>
                      {r.realizationPct < 50 && r.unbilled > 0 && (
                        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" title="Under 50% invoiced" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {jobRows.length > 12 && (
            <p className="text-[10px] text-slate-400 text-center">Showing top 12 by WIP gap · {jobRows.length} jobs total</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}