import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, XCircle, Loader2, MessageSquare, Briefcase } from 'lucide-react';

/**
 * Per-job bulk review control for the Investigation Hub.
 * A job selector plus 'Approve all pending' and 'Query all pending' actions
 * that operate on every pending log within the selected job, with a
 * confirmation step and a toast result.
 */
export default function InvestigationBulkReview({ logs = [], jobs = [], onDone }) {
  const { toast } = useToast();
  const [jobId, setJobId] = useState('all');
  const [processing, setProcessing] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [queryNote, setQueryNote] = useState('');

  // Jobs that have at least one pending log
  const jobsWithPending = useMemo(() => {
    const ids = new Set(logs.filter(l => (l.manager_review_status || 'pending') === 'pending').map(l => l.job_id));
    return jobs.filter(j => ids.has(j.id));
  }, [logs, jobs]);

  const pendingInJob = useMemo(() => {
    if (jobId === 'all') return [];
    return logs.filter(l => l.job_id === jobId && (l.manager_review_status || 'pending') === 'pending');
  }, [logs, jobId]);

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => { m[j.id] = j; }); return m; }, [jobs]);

  const handleApprove = async () => {
    if (pendingInJob.length === 0) return;
    if (!confirm(`Approve all ${pendingInJob.length} pending log${pendingInJob.length === 1 ? '' : 's'} for ${jobMap[jobId]?.name || 'this job'}?`)) return;
    setProcessing(true);
    try {
      const updates = pendingInJob.map(l => ({
        id: l.id, manager_review_status: 'approved', manager_reviewed_at: new Date().toISOString(),
      }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${pendingInJob.length} logs approved` });
      onDone?.();
    } catch (err) {
      toast({ title: 'Failed to approve logs', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleQuery = async () => {
    if (!queryNote.trim()) { toast({ title: 'Please enter a query note', variant: 'destructive' }); return; }
    if (pendingInJob.length === 0) return;
    setProcessing(true);
    try {
      const updates = pendingInJob.map(l => ({
        id: l.id, manager_review_status: 'queried', manager_review_note: queryNote, manager_reviewed_at: new Date().toISOString(),
      }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${pendingInJob.length} logs queried` });
      setShowQuery(false); setQueryNote('');
      onDone?.();
    } catch (err) {
      toast({ title: 'Failed to query logs', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="insight-card rounded-2xl p-3 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Bulk Review by Job</h3>
            <p className="text-xs text-slate-500">Approve or query every pending log in a job at once.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={jobId} onChange={e => setJobId(e.target.value)}
            className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-600 min-w-0 flex-1 sm:flex-none">
            <option value="all">Select a job…</option>
            {jobsWithPending.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
            {jobId !== 'all' ? `${pendingInJob.length} pending` : '—'}
          </span>
          <button onClick={() => setShowQuery(true)} disabled={jobId === 'all' || pendingInJob.length === 0 || processing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            <MessageSquare className="w-3.5 h-3.5" /> Query All
          </button>
          <button onClick={handleApprove} disabled={jobId === 'all' || pendingInJob.length === 0 || processing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve All
          </button>
        </div>
      </div>

      {showQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Query {pendingInJob.length} Pending Logs</h2>
                <p className="text-xs text-slate-500">{jobMap[jobId]?.name} — the crew will see your note</p>
              </div>
            </div>
            <textarea value={queryNote} onChange={e => setQueryNote(e.target.value)}
              placeholder="e.g. Missing groundwater strike depth — please add and resubmit"
              rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" autoFocus />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => { setShowQuery(false); setQueryNote(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={handleQuery} disabled={processing || !queryNote.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} Send Query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';