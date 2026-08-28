import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, PoundSterling, ArrowRight, Loader2, CheckCircle2, Clock,
  Building2, Calendar, AlertCircle, FileBarChart,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * AfP Pipeline — shows jobs with completed work that haven't been invoiced yet.
 * These are Applications for Payment: work valued but not yet converted to a
 * formal VAT invoice. Managers review this list and raise invoices from it.
 *
 * This is the "Ready to Bill" step of the billing workflow, enriched with
 * AfP context so managers understand the distinction between valuing work
 * (AfP) and raising a tax invoice.
 */
export default function AfPPipelineWidget({ onSelectJob }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['afp-pipeline-jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 100),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['afp-pipeline-invoices'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 200),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['afp-pipeline-clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const invoicedJobIds = useMemo(() => new Set(invoices.map(i => i.job_id).filter(Boolean)), [invoices]);

  const afpJobs = useMemo(() => {
    return jobs
      .filter(j =>
        (j.status === 'decommissioning' || j.status === 'completed') &&
        !invoicedJobIds.has(j.id)
      )
      .map(j => ({
        ...j,
        client_name: clients.find(c => c.id === j.client_id)?.name || '—',
        afp_value: j.client_charge || j.budget_amount || 0,
      }))
      .sort((a, b) => b.afp_value - a.afp_value);
  }, [jobs, invoicedJobIds, clients]);

  const totalAfP = afpJobs.reduce((s, j) => s + j.afp_value, 0);

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <p className="text-sm font-semibold text-slate-500">Loading AfP pipeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileBarChart className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Application for Payment Pipeline</h3>
              <p className="text-[11px] text-slate-500">Completed jobs ready to be invoiced</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total AfP Value</p>
            <p className="text-lg font-extrabold text-blue-600 tabular-nums">{fmt(totalAfP)}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {afpJobs.length === 0 ? (
        <div className="text-center py-10 px-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">All completed jobs are invoiced</p>
          <p className="text-xs text-slate-400 mt-1">No Applications for Payment pending in the pipeline.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
          {afpJobs.map(job => (
            <div key={job.id} className="px-4 sm:px-5 py-3 hover:bg-slate-50/50 transition">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {job.status === 'completed' ? 'COMPLETED' : 'DECOMM.'}
                    </span>
                    <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {job.client_name}
                    </span>
                    {job.location && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[120px] sm:max-w-[200px]">
                        <FileText className="w-3 h-3" /> {job.location}
                      </span>
                    )}
                    {job.end_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {job.end_date}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">AfP Value</p>
                    <p className="text-sm font-extrabold text-blue-600 tabular-nums">{fmt(job.afp_value)}</p>
                  </div>
                  <button
                    onClick={() => onSelectJob?.(job)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#1c4a12] transition flex-shrink-0"
                  >
                    Invoice <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <strong>AfP ≠ Invoice.</strong> An Application for Payment values completed work for client certification.
            Once certified, raise a VAT Invoice from the "Raise & Check" step. The client pays the invoice — not the AfP.
          </p>
        </div>
      </div>
    </div>
  );
}