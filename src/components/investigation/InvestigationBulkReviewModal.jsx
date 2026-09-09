import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle2, XCircle, Loader2, Briefcase, MessageSquare } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Simplified bulk review modal — replaces the inline bulk review bar.
 * Pick a job, see the pending count, then approve or query all pending
 * logs in that job at once.
 */
export default function InvestigationBulkReviewModal({ open, onClose, logs = [], jobs = [], onDone }) {
  const { toast } = useToast();
  const [jobId, setJobId] = useState('all');
  const [processing, setProcessing] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [queryNote, setQueryNote] = useState('');

  const jobsWithPending = useMemo(() => {
    const ids = new Set(logs.filter(l => (l.manager_review_status || 'pending') === 'pending').map(l => l.job_id));
    return jobs.filter(j => ids.has(j.id));
  }, [logs, jobs]);

  const pendingInJob = useMemo(() => {
    if (jobId === 'all') return [];
    return logs.filter(l => l.job_id === jobId && (l.manager_review_status || 'pending') === 'pending');
  }, [logs, jobId]);

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => m[j.id] = j); return m; }, [jobs]);

  if (!open) return null;

  const handleApprove = async () => {
    if (pendingInJob.length === 0) return;
    if (!confirm(`Approve all ${pendingInJob.length} pending log${pendingInJob.length === 1 ? '' : 's'} for ${jobMap[jobId]?.name}?`)) return;
    setProcessing(true);
    try {
      const updates = pendingInJob.map(l => ({ id: l.id, manager_review_status: 'approved', manager_reviewed_at: new Date().toISOString() }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${pendingInJob.length} logs approved` });
      onDone?.(); onClose();
    } catch (err) {
      toast({ title: 'Failed to approve', description: err.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const handleQuery = async () => {
    if (!queryNote.trim()) { toast({ title: 'Please enter a query note', variant: 'destructive' }); return; }
    if (pendingInJob.length === 0) return;
    setProcessing(true);
    try {
      const updates = pendingInJob.map(l => ({ id: l.id, manager_review_status: 'queried', manager_review_note: queryNote, manager_reviewed_at: new Date().toISOString() }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${pendingInJob.length} logs queried` });
      setShowQuery(false); setQueryNote('');
      onDone?.(); onClose();
    } catch (err) {
      toast({ title: 'Failed to query', description: err.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">Bulk Review by Job</h2>
            <p className="text-xs text-slate-500">Approve or query every pending log in a job.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="text-xs font-semibold text-slate-700 mb-1 block">Job</label>
        <select value={jobId} onChange={e => setJobId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-3 focus:outline-none focus:border-amber-600">
          <option value="all">Select a job…</option>
          {jobsWithPending.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>

        {jobId !== 'all' && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-slate-500">Pending logs:</span>
            <span className="font-bold text-amber-700 tabular-nums">{pendingInJob.length}</span>
          </div>
        )}

        {showQuery && (
          <div className="mb-3">
            <textarea value={queryNote} onChange={e => setQueryNote(e.target.value)}
              placeholder="e.g. Missing groundwater strike depth — please add and resubmit"
              rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" autoFocus />
          </div>
        )}

        <div className="flex items-center gap-2">
          {showQuery ? (
            <>
              <button onClick={() => { setShowQuery(false); setQueryNote(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition">Cancel</button>
              <button onClick={handleQuery} disabled={processing || !queryNote.trim() || pendingInJob.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} Send Query
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowQuery(true)} disabled={jobId === 'all' || pendingInJob.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <MessageSquare className="w-4 h-4" /> Query All
              </button>
              <button onClick={handleApprove} disabled={jobId === 'all' || pendingInJob.length === 0 || processing}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve All
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}