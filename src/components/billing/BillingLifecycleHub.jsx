import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ClipboardList, FileSignature, Receipt, ShieldCheck, Send, CheckCircle2,
  Loader2, ArrowRight, AlertCircle, PoundSterling, Sparkles,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';
import { READY_STATUSES } from '@/utils/billingSummary';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STAGES = [
  { id: 'planning', label: 'Job Created', icon: ClipboardList, tone: 'slate' },
  { id: 'contract', label: 'Contract Active', icon: FileSignature, tone: 'blue' },
  { id: 'costs', label: 'Costs Captured', icon: Receipt, tone: 'amber' },
  { id: 'ready', label: 'Billing Ready', icon: ShieldCheck, tone: 'violet' },
  { id: 'invoiced', label: 'Invoice Raised', icon: Send, tone: 'teal' },
  { id: 'paid', label: 'Paid', icon: CheckCircle2, tone: 'emerald' },
];

const toneClasses = {
  slate: 'border-slate-300 bg-slate-50 text-slate-700',
  blue: 'border-blue-300 bg-blue-50 text-blue-700',
  amber: 'border-amber-300 bg-amber-50 text-amber-700',
  violet: 'border-violet-300 bg-violet-50 text-violet-700',
  teal: 'border-teal-300 bg-teal-50 text-teal-700',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700',
};

const toneIcon = {
  slate: 'text-slate-500',
  blue: 'text-blue-500',
  amber: 'text-amber-500',
  violet: 'text-violet-500',
  teal: 'text-teal-500',
  emerald: 'text-emerald-500',
};

export default function BillingLifecycleHub({ onSelectJob }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checkingJob, setCheckingJob] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['billing-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: contracts = [] } = useQuery({ queryKey: ['billing-contracts'], queryFn: () => base44.entities.JobBillingContract.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['billing-invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['billing-clients'], queryFn: () => base44.entities.Client.list() });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const contractByJob = useMemo(() => {
    const map = {};
    contracts.forEach((c) => { if (!map[c.job_id] || c.version > (map[c.job_id]?.version || 0)) map[c.job_id] = c; });
    return map;
  }, [contracts]);
  const invoicesByJob = useMemo(() => {
    const map = {};
    invoices.forEach((i) => { if (!map[i.job_id]) map[i.job_id] = []; map[i.job_id].push(i); });
    return map;
  }, [invoices]);

  // Classify each job into a lifecycle stage
  const staged = useMemo(() => {
    const buckets = STAGES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {});
    jobs.forEach((job) => {
      const jobInvoices = invoicesByJob[job.id] || [];
      const hasPaid = jobInvoices.some((i) => i.status === 'paid');
      const hasSent = jobInvoices.some((i) => i.status === 'sent' || i.status === 'paid');
      const hasDraft = jobInvoices.some((i) => i.status === 'draft');

      let stage;
      if (hasPaid) stage = 'paid';
      else if (hasSent) stage = 'invoiced';
      else if (hasDraft && READY_STATUSES.includes(job.status)) stage = 'invoiced';
      else if (READY_STATUSES.includes(job.status)) stage = 'ready';
      else if (contractByJob[job.id]?.status === 'active') stage = 'costs';
      else if (job.status === 'in_progress') stage = 'costs';
      else stage = 'planning';

      buckets[stage].push(job);
    });
    return buckets;
  }, [jobs, invoicesByJob, contractByJob]);

  const totalValue = useMemo(() => {
    return jobs.reduce((sum, j) => {
      const invs = invoicesByJob[j.id] || [];
      const paid = invs.filter((i) => i.status === 'paid').reduce((s, i) => s + (Number(i.total_gross) || 0), 0);
      return sum + paid;
    }, 0);
  }, [jobs, invoicesByJob]);

  const runReadinessCheck = async (job) => {
    setCheckingJob(job.id);
    try {
      const res = await base44.functions.invoke('checkBillingReadiness', { job_id: job.id });
      const blockers = res.data?.blockers || [];
      const blocking = blockers.filter((b) => b.severity === 'blocking');
      if (blocking.length === 0) {
        toast({ title: '✓ Ready to invoice', description: `${job.name} has no billing blockers.` });
      } else {
        toast({
          title: `${blocking.length} blocker${blocking.length === 1 ? '' : 's'} found`,
          description: blocking.map((b) => b.label).join(', '),
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({ title: 'Check failed', description: e?.message, variant: 'destructive' });
    }
    setCheckingJob(null);
  };

  const runAutoInvoice = async () => {
    setAutoRunning(true);
    try {
      const res = await base44.functions.invoke('autoGenerateInvoice', { all_ready: true });
      const n = res.data?.created ?? 0;
      toast({
        title: n > 0 ? `${n} draft invoice${n === 1 ? '' : 's'} created` : 'No new drafts',
        description: n > 0 ? 'Review in the Invoices tab.' : 'Every ready job already has a draft.',
      });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    } catch (e) {
      toast({ title: 'Auto-invoice failed', description: e?.message, variant: 'destructive' });
    }
    setAutoRunning(false);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Sparkles}
        title="Billing Lifecycle"
        description="Track every job from creation through to paid invoice — the full pipeline at a glance."
        actions={
          <button onClick={runAutoInvoice} disabled={autoRunning}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 shadow-sm">
            {autoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Auto-Invoice Ready Jobs
          </button>
        }
      />

      {/* Stage pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          STAGES.map((stage) => {
            const count = staged[stage.id]?.length || 0;
            const Icon = stage.icon;
            return (
              <div key={stage.id} className={`relative rounded-xl border-2 p-4 ${toneClasses[stage.tone]}`}>
                <Icon className={`w-5 h-5 mb-2 ${toneIcon[stage.tone]}`} />
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-xs font-medium opacity-80">{stage.label}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Collected revenue */}
      <div className="hub-glass rounded-2xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl stat-gradient-brand flex items-center justify-center">
          <PoundSterling className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Collected Revenue</p>
          <p className="text-2xl font-bold text-[#2E5A1A] tabular-nums">{fmt(totalValue)}</p>
        </div>
      </div>

      {/* Jobs per stage */}
      <div className="space-y-4">
        {STAGES.map((stage) => {
          const stageJobs = staged[stage.id] || [];
          if (stageJobs.length === 0) return null;
          const Icon = stage.icon;
          return (
            <div key={stage.id} className="hub-glass rounded-2xl overflow-hidden">
              <div className={`flex items-center gap-2 px-5 py-3 border-b border-slate-100 ${toneClasses[stage.tone]}`}>
                <Icon className="w-4 h-4" />
                <h3 className="text-sm font-bold">{stage.label}</h3>
                <span className="ml-auto text-xs font-semibold opacity-70">{stageJobs.length}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {stageJobs.map((job) => {
                  const contract = contractByJob[job.id];
                  const jobInvoices = invoicesByJob[job.id] || [];
                  const client = clientById[job.client_id];
                  return (
                    <div key={job.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition">
                      <button onClick={() => onSelectJob?.(job)} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{job.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          {job.job_reference && <span>{job.job_reference}</span>}
                          {client && <span>· {client.name}</span>}
                          {contract?.status === 'active' && <span className="text-blue-500">· Contract active</span>}
                          {jobInvoices.length > 0 && (
                            <span className="text-teal-500">· {jobInvoices.length} invoice{jobInvoices.length === 1 ? '' : 's'}</span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stage.id === 'ready' && (
                          <button onClick={() => runReadinessCheck(job)} disabled={checkingJob === job.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition disabled:opacity-50">
                            {checkingJob === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Check
                          </button>
                        )}
                        {stage.id === 'ready' && (
                          <button onClick={() => onSelectJob?.(job)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-medium hover:bg-[#1c4a12] transition">
                            <Send className="w-3 h-3" /> Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && staged.planning?.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading billing pipeline…
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          No jobs yet — the billing pipeline will populate as jobs are created.
        </div>
      )}
    </div>
  );
}