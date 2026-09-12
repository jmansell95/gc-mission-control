import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, Lock, FileClock, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, FileText, ArrowRightLeft,
  Clock, PoundSterling, Zap,
} from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const READY_STATUSES = ['decommissioning', 'completed'];

/**
 * Pre-billing readiness gate. Scans every job in decommissioning/completed
 * status and checks for data-level blockers that prevent clean invoicing:
 *   • Unconfirmed POA cost items (no agreed price)
 *   • Subcontractor logs not yet finance-approved (pending/verified)
 *   • Timesheets submitted but not manager-approved
 *   • Existing draft invoices (already queued)
 *
 * Shows a traffic-light summary and a per-job blocker breakdown so the
 * billing team knows exactly what to clear before running the auto-invoice
 * engine.
 */
export default function BillingReadinessGate({ onNavigateToJob }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [running, setRunning] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['billing-readiness-jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 500),
  });

  const readyJobs = useMemo(() => jobs.filter((j) => READY_STATUSES.includes(j.status)), [jobs]);

  // Fetch blockers in parallel — only for ready-status jobs
  const { data: poaItems = [] } = useQuery({
    queryKey: ['billing-readiness-poa'],
    queryFn: () => base44.entities.JobCostItem.filter({ is_poa: true }, '-created_date', 500),
    enabled: readyJobs.length > 0,
  });
  const { data: subconLogs = [] } = useQuery({
    queryKey: ['billing-readiness-subcon'],
    queryFn: () => base44.entities.SubcontractorLog.filter({}, '-date', 500),
    enabled: readyJobs.length > 0,
  });
  const { data: timesheets = [] } = useQuery({
    queryKey: ['billing-readiness-ts'],
    queryFn: () => base44.entities.Timesheet.filter({ is_summary: true }, '-date', 500),
    enabled: readyJobs.length > 0,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-readiness-invoices'],
    queryFn: () => base44.entities.Invoice.filter({ status: 'draft' }, '-created_date', 200),
    enabled: readyJobs.length > 0,
  });

  // Compute readiness per job
  const jobAssessments = useMemo(() => {
    const readyJobIds = new Set(readyJobs.map((j) => j.id));
    const poaByJob = {};
    poaItems.forEach((c) => {
      if (!readyJobIds.has(c.job_id)) return;
      if (!c.price_confirmed) {
        if (!poaByJob[c.job_id]) poaByJob[c.job_id] = [];
        poaByJob[c.job_id].push(c);
      }
    });
    const subconByJob = {};
    subconLogs.forEach((l) => {
      if (!readyJobIds.has(l.job_id)) return;
      if (l.status === 'pending' || l.status === 'verified') {
        if (!subconByJob[l.job_id]) subconByJob[l.job_id] = [];
        subconByJob[l.job_id].push(l);
      }
    });
    const tsByJob = {};
    timesheets.forEach((t) => {
      if (!readyJobIds.has(t.job_id)) return;
      if (t.status === 'submitted') {
        if (!tsByJob[t.job_id]) tsByJob[t.job_id] = [];
        tsByJob[t.job_id].push(t);
      }
    });
    const draftInvByJob = {};
    invoices.forEach((i) => {
      if (!readyJobIds.has(i.job_id)) return;
      if (!draftInvByJob[i.job_id]) draftInvByJob[i.job_id] = [];
      draftInvByJob[i.job_id].push(i);
    });

    return readyJobs.map((job) => {
      const blockers = [];
      const poa = poaByJob[job.id] || [];
      const subcon = subconByJob[job.id] || [];
      const ts = tsByJob[job.id] || [];
      const drafts = draftInvByJob[job.id] || [];
      if (poa.length > 0) blockers.push({ type: 'poa', count: poa.length, label: `${poa.length} unconfirmed POA price${poa.length === 1 ? '' : 's'}`, items: poa });
      if (subcon.length > 0) blockers.push({ type: 'subcon', count: subcon.length, label: `${subcon.length} unapproved sub-con log${subcon.length === 1 ? '' : 's'}`, items: subcon });
      if (ts.length > 0) blockers.push({ type: 'timesheet', count: ts.length, label: `${ts.length} unapproved timesheet${ts.length === 1 ? '' : 's'}`, items: ts });
      if (drafts.length > 0) blockers.push({ type: 'draft', count: drafts.length, label: `${drafts.length} draft invoice${drafts.length === 1 ? '' : 's'} already exist`, items: drafts });
      return { job, blockers, isReady: blockers.length === 0 };
    });
  }, [readyJobs, poaItems, subconLogs, timesheets, invoices]);

  const readyCount = jobAssessments.filter((a) => a.isReady).length;
  const blockedCount = jobAssessments.length - readyCount;
  const totalBlockers = jobAssessments.reduce((s, a) => s + a.blockers.length, 0);

  const runAutoInvoice = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('autoGenerateInvoice', { all_ready: true });
      const result = res.data || res;
      toast({
        title: 'Auto-Invoice Engine Complete',
        description: `Checked ${result.checked || 0} jobs · ${result.created || 0} draft invoice${result.created === 1 ? '' : 's'} created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['billing-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      toast({ title: 'Auto-invoice failed', description: e.message, variant: 'destructive' });
    }
    setRunning(false);
  };

  const BLOCKER_META = {
    poa: { icon: PoundSterling, color: 'text-amber-600 bg-amber-50' },
    subcon: { icon: ArrowRightLeft, color: 'text-orange-600 bg-orange-50' },
    timesheet: { icon: Clock, color: 'text-blue-600 bg-blue-50' },
    draft: { icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
  };

  if (isLoading) {
    return (
      <WidgetShell title="Billing Readiness Gate" icon={ShieldCheck}>
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      </WidgetShell>
    );
  }

  if (readyJobs.length === 0) {
    return (
      <WidgetShell title="Billing Readiness Gate" icon={ShieldCheck}>
        <div className="text-center py-6">
          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No jobs in decommissioning or completed status.</p>
          <p className="text-xs text-slate-400 mt-1">Jobs appear here when work finishes and equipment is being collected.</p>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="Billing Readiness Gate" icon={ShieldCheck}
      actions={
        <button onClick={runAutoInvoice} disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {running ? 'Running…' : 'Run Auto-Invoice'}
        </button>
      }
    >
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{readyCount}</p>
          <p className="text-[10px] text-emerald-600 font-medium">Ready to Bill</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-center">
          <ShieldAlert className="w-4 h-4 text-amber-600 mx-auto mb-0.5" />
          <p className="text-xl font-bold text-amber-700 tabular-nums">{blockedCount}</p>
          <p className="text-[10px] text-amber-600 font-medium">Blocked</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
          <AlertTriangle className="w-4 h-4 text-slate-500 mx-auto mb-0.5" />
          <p className="text-xl font-bold text-slate-700 tabular-nums">{totalBlockers}</p>
          <p className="text-[10px] text-slate-500 font-medium">Total Blockers</p>
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
        {jobAssessments.map(({ job, blockers, isReady }) => {
          const isOpen = expanded === job.id;
          return (
            <div key={job.id} className={`rounded-lg border ${isReady ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/30'} overflow-hidden`}>
              <button
                onClick={() => setExpanded(isOpen ? null : job.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-black/[0.02] transition"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                {isReady ? <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{job.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-medium">{job.status}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                  {blockers.map((b, i) => {
                    const BM = BLOCKER_META[b.type];
                    const BIcon = BM.icon;
                    return (
                      <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${BM.color}`}>
                        <BIcon className="w-2.5 h-2.5" />{b.count}
                      </span>
                    );
                  })}
                  {isReady && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="w-2.5 h-2.5" /> READY
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100/60">
                  {blockers.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 py-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>All checks passed — this job is ready for invoicing.</span>
                    </div>
                  ) : (
                    blockers.map((b, i) => {
                      const BM = BLOCKER_META[b.type];
                      const BIcon = BM.icon;
                      return (
                        <div key={i} className="flex items-start gap-2 py-1.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${BM.color}`}>
                            <BIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700">{b.label}</p>
                            {b.type === 'poa' && (
                              <p className="text-[10px] text-slate-500">{b.items.map((c) => c.description).join(', ').slice(0, 120)}</p>
                            )}
                            {b.type === 'subcon' && (
                              <p className="text-[10px] text-slate-500">{b.items.map((l) => `${l.subcontractor_name} (${l.status})`).join(', ').slice(0, 120)}</p>
                            )}
                            {b.type === 'timesheet' && (
                              <p className="text-[10px] text-slate-500">{b.items.length} summary entr{b.items.length === 1 ? 'y' : 'ies'} awaiting manager approval</p>
                            )}
                            {b.type === 'draft' && (
                              <p className="text-[10px] text-slate-500">Draft: {b.items.map((d) => d.invoice_number).join(', ')}</p>
                            )}
                          </div>
                          {onNavigateToJob && (
                            <button onClick={() => onNavigateToJob(job.id)} className="text-[10px] text-blue-600 font-medium hover:underline flex-shrink-0">
                              Fix →
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}