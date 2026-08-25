import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, Plus, CalendarClock,
  Sparkles, HardHat, Filter, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import DelayLogForm from '@/components/DelayLogForm';
import DelayCauseChart from '@/components/jobs/DelayCauseChart';
import DelayScheduleImpact from '@/components/jobs/DelayScheduleImpact';

const DELAY_LABELS = {
  ground_conditions: 'Ground Conditions', utility_clash: 'Utility Clash', weather: 'Weather',
  mechanical_failure: 'Mechanical Failure', access_issue: 'Access Issue', client_request: 'Client Request',
  third_party: 'Third Party', other: 'Other',
};

const STATUS_STYLE = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

const CAUSE_COLORS = {
  ground_conditions: 'bg-violet-100 text-violet-700', utility_clash: 'bg-amber-100 text-amber-700',
  weather: 'bg-blue-100 text-blue-700', mechanical_failure: 'bg-red-100 text-red-700',
  access_issue: 'bg-pink-100 text-pink-700', client_request: 'bg-emerald-100 text-emerald-700',
  third_party: 'bg-indigo-100 text-indigo-700', other: 'bg-slate-100 text-slate-700',
};

// Fully overhauled Site Delays tab: stat tiles, cause-distribution chart,
// filter pills, chronological timeline, schedule-impact panel, and the
// existing approve/reject + scan-remarks actions.
export default function DelayLogManager({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [causeFilter, setCauseFilter] = useState('all');
  const [showImpact, setShowImpact] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['job-delay-logs', job.id],
    queryFn: () => base44.entities.JobDelayLog.filter({ job_id: job.id }),
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
  });

  const sorted = useMemo(() =>
    [...logs].sort((a, b) => (b.reported_at || '').localeCompare(a.reported_at || '')), [logs]);

  const pending = sorted.filter(l => (l.manager_review_status || 'pending') === 'pending');
  const approved = sorted.filter(l => l.manager_review_status === 'approved');
  const rejected = sorted.filter(l => l.manager_review_status === 'rejected');

  const totalApprovedDays = approved.reduce((s, l) => s + (Number(l.impacted_days) || 0), 0);
  const totalPendingDays = pending.reduce((s, l) => s + (Number(l.impacted_days) || 0), 0);

  // Cause distribution for the chart
  const causeCounts = {};
  logs.forEach(l => {
    const t = l.delay_type || 'other';
    causeCounts[t] = (causeCounts[t] || 0) + 1;
  });
  const activeCauses = Object.keys(causeCounts);

  // Filtered timeline
  const filtered = causeFilter === 'all' ? sorted : sorted.filter(l => l.delay_type === causeFilter);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job-delay-logs', job.id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['rotas-for-job', job.id] });
    queryClient.invalidateQueries({ queryKey: ['job-rotas', job.id] });
  };

  const approve = async (log) => {
    setBusyId(log.id);
    try {
      const res = await base44.functions.invoke('approveDelayLog', { delay_log_id: log.id, action: 'approve' });
      const d = res.data || {};
      toast({
        title: 'Delay approved — rota shifted',
        description: d.shifted ? `${d.shifted} future shift(s) moved by ${d.days} working day(s).` : 'Logged (no day impact).',
      });
      invalidate();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Could not approve', variant: 'destructive' });
    }
    setBusyId(null);
  };

  const reject = async (log) => {
    setBusyId(log.id);
    try {
      await base44.entities.JobDelayLog.update(log.id, {
        manager_review_status: 'rejected',
        manager_reviewed_by: profile?.name || '',
        manager_reviewed_at: new Date().toISOString(),
      });
      toast({ title: 'Delay rejected' });
      invalidate();
    } catch (e) {
      toast({ title: 'Could not reject', variant: 'destructive' });
    }
    setBusyId(null);
  };

  const scanRemarks = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('generateDelayLogFromRemarks', { job_id: job.id, job_name: job.name });
      const d = res.data || res;
      toast({
        title: d.created > 0 ? `${d.created} delay(s) auto-logged` : 'Scan complete',
        description: d.message || `Scanned ${d.scanned || 0} remark(s).`,
      });
      invalidate();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Scan failed', variant: 'destructive' });
    }
    setScanning(false);
  };

  const stats = [
    { label: 'Total Delays', value: logs.length, icon: AlertTriangle, iconColor: 'text-amber-500' },
    { label: 'Pending', value: pending.length, icon: Clock, iconColor: 'text-amber-500' },
    { label: 'Approved', value: approved.length, icon: CheckCircle2, iconColor: 'text-emerald-500' },
    { label: 'Days Added', value: totalApprovedDays, icon: CalendarClock, iconColor: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="insight-card rounded-2xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{s.value}</p>
                <p className="text-[10px] uppercase font-medium text-slate-400 tracking-wide">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cause chart + schedule impact toggle */}
      {logs.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Delay Causes</h3>
            {totalApprovedDays > 0 && (
              <button
                onClick={() => setShowImpact(s => !s)}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition border border-amber-200"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {showImpact ? 'Hide' : 'Show'} Impact
              </button>
            )}
          </div>
          <DelayCauseChart logs={logs} />
        </div>
      )}

      {/* Schedule impact panel (collapsible) */}
      {showImpact && <DelayScheduleImpact job={job} totalApprovedDays={totalApprovedDays} />}

      {/* Filter pills */}
      {activeCauses.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCauseFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              causeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({logs.length})
          </button>
          {activeCauses.map(cause => (
            <button
              key={cause}
              onClick={() => setCauseFilter(cause)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                causeFilter === cause ? 'bg-slate-800 text-white' : `${CAUSE_COLORS[cause] || 'bg-slate-100 text-slate-600'} hover:opacity-80`
              }`}
            >
              {DELAY_LABELS[cause] || cause} ({causeCounts[cause]})
            </button>
          ))}
        </div>
      )}

      {/* Action bar + timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm">Delay Timeline</h3>
            <p className="text-xs text-slate-400">
              {pending.length} pending{totalPendingDays > 0 ? ` · ${totalPendingDays} day(s) pending review` : ''}
              {totalApprovedDays > 0 ? ` · ${totalApprovedDays} day(s) approved` : ''}
            </p>
          </div>
          <button onClick={scanRemarks} disabled={scanning}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition disabled:opacity-50">
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {scanning ? 'Scanning…' : 'Scan remarks'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition">
            <Plus className="w-3.5 h-3.5" /> Log Delay
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {causeFilter === 'all' ? 'No delays logged for this job.' : 'No delays match this filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(log => (
              <DelayRow key={log.id} log={log} onApprove={() => approve(log)} onReject={() => reject(log)} busy={busyId === log.id} />
            ))}
          </div>
        )}
      </div>

      <DelayLogForm
        open={showForm}
        onOpenChange={setShowForm}
        jobId={job.id}
        jobName={job.name}
        staffId={profile?.id || ''}
        staffName={profile?.name || ''}
        onSaved={invalidate}
      />
    </div>
  );
}

function DelayRow({ log, onApprove, onReject, busy }) {
  const st = STATUS_STYLE[log.manager_review_status || 'pending'];
  const impact = [];
  if (Number(log.impacted_days) > 0) impact.push(`${log.impacted_days} day${log.impacted_days !== 1 ? 's' : ''}`);
  if (Number(log.impacted_hours) > 0) impact.push(`${log.impacted_hours}h`);
  const impactStr = impact.join(' + ') || '—';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
            {log.reported_by_role === 'subcontractor' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold inline-flex items-center gap-0.5">
                <HardHat className="w-2.5 h-2.5" /> Sub-con
              </span>
            )}
            <span className="text-xs font-semibold text-slate-800">{DELAY_LABELS[log.delay_type] || log.delay_type}</span>
            {log.rota_adjusted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium inline-flex items-center gap-0.5">
                <CalendarClock className="w-2.5 h-2.5" /> Rota shifted
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">{log.description}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {log.reported_at ? format(new Date(log.reported_at), 'dd MMM yyyy HH:mm') : ''}
            {' · '}by {log.reported_by_role === 'subcontractor' ? (log.subcontractor_name || 'Subcontractor') : (log.staff_name || 'Staff')}
            {' · '}Impact: <b className="text-amber-700">+{impactStr}</b>
          </p>
        </div>
        {(log.manager_review_status || 'pending') === 'pending' && onApprove && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={onApprove} disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Approve
            </button>
            <button onClick={onReject} disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold hover:bg-slate-50 transition disabled:opacity-50">
              <XCircle className="w-3 h-3" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}