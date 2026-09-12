import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, PoundSterling, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

/**
 * Shows all jobs with unbilled work (approved timesheets, cost items, deliveries
 * that are chargeable but not yet invoiced), grouped by client. Gives finance
 * a one-click view of what's ready to invoice.
 */
export default function BillingReadinessReport({ onSelectJob }) {
  const { data: jobs = [], isLoading: jl } = useQuery({
    queryKey: ['jobs-active-billing'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['in_progress', 'decommissioning', 'completed'] } }, 'name', 500),
  });

  const { data: timesheets = [], isLoading: tl } = useQuery({
    queryKey: ['timesheets-approved-unbilled'],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'approved', chargeable: true }, '-date', 500),
  });

  const { data: costItems = [], isLoading: cl } = useQuery({
    queryKey: ['cost-items-unbilled'],
    queryFn: () => base44.entities.JobCostItem.filter({ chargeable: true }, '-created_date', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const isLoading = jl || tl || cl;

  const { byClient, totalUnbilled } = useMemo(() => {
    const invoicedJobIds = new Set(invoices.filter(i => i.status !== 'void').map(i => i.job_id));
    const tsByJob = {};
    const costByJob = {};

    timesheets.forEach(t => {
      if (t.job_id && !invoicedJobIds.has(t.job_id)) {
        tsByJob[t.job_id] = (tsByJob[t.job_id] || 0) + (t.charge_amount || 0);
      }
    });
    costItems.forEach(c => {
      if (c.job_id && !invoicedJobIds.has(c.job_id)) {
        costByJob[c.job_id] = (costByJob[c.job_id] || 0) + (c.total_cost || c.unit_cost || 0);
      }
    });

    const jobMap = {};
    jobs.forEach(j => { jobMap[j.id] = j; });

    const clientMap = {};
    let total = 0;

    Object.keys(tsByJob).forEach(jobId => {
      const job = jobMap[jobId];
      if (!job) return;
      const amount = tsByJob[jobId] + (costByJob[jobId] || 0);
      if (!amount) return;
      total += amount;
      const cid = job.client_id || 'unknown';
      if (!clientMap[cid]) clientMap[cid] = { name: job.client_id ? job.client_id : 'Unknown', jobs: [] };
      clientMap[cid].jobs.push({ job, amount });
    });

    Object.keys(costByJob).forEach(jobId => {
      if (tsByJob[jobId]) return; // already counted
      const job = jobMap[jobId];
      if (!job) return;
      const amount = costByJob[jobId];
      if (!amount) return;
      total += amount;
      const cid = job.client_id || 'unknown';
      if (!clientMap[cid]) clientMap[cid] = { name: 'Unknown', jobs: [] };
      clientMap[cid].jobs.push({ job, amount });
    });

    const clients = Object.entries(clientMap)
      .map(([id, v]) => ({ id, ...v, total: v.jobs.reduce((s, j) => s + j.amount, 0) }))
      .sort((a, b) => b.total - a.total);

    return { byClient: clients, totalUnbilled: total };
  }, [jobs, timesheets, costItems, invoices]);

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">Billing Readiness Report</h3>
            <p className="text-[11px] text-slate-500 truncate">Unbilled chargeable work, grouped by client</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">{gbp(totalUnbilled)}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500">Total unbilled</p>
        </div>
      </div>

      {byClient.length === 0 ? (
        <div className="px-4 sm:px-5 py-8 text-center text-sm text-slate-400">
          <PoundSterling className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No unbilled work — all chargeable items have been invoiced.
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
          {byClient.map(client => (
            <div key={client.id} className="px-4 sm:px-5 py-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-sm font-semibold text-slate-700 truncate">{client.name}</p>
                <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{gbp(client.total)}</p>
              </div>
              <div className="space-y-1">
                {client.jobs.map(({ job, amount }) => (
                  <button
                    key={job.id}
                    onClick={() => onSelectJob?.(job)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition text-left gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900 truncate">{job.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{job.job_reference || 'No ref'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">{gbp(amount)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}