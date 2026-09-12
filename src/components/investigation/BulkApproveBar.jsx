import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react';

/**
 * Sticky action bar for bulk-approving or querying multiple investigation logs.
 * Shows the selection count and provides approve/query buttons. On approve,
 * sets manager_review_status to 'approved' on all selected. On query, prompts
 * for a note and sets status to 'queried'.
 */
export default function BulkApproveBar({ selectedIds, onClear, onDone }) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [queryNote, setQueryNote] = useState('');

  if (selectedIds.length === 0) return null;

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const updates = selectedIds.map(id => ({
        id,
        manager_review_status: 'approved',
        manager_reviewed_at: new Date().toISOString(),
      }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${selectedIds.length} logs approved` });
      onClear?.();
      onDone?.();
    } catch (err) {
      toast({ title: 'Failed to approve logs', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleQuery = async () => {
    if (!queryNote.trim()) {
      toast({ title: 'Please enter a query note', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const updates = selectedIds.map(id => ({
        id,
        manager_review_status: 'queried',
        manager_review_note: queryNote,
        manager_reviewed_at: new Date().toISOString(),
      }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      toast({ title: `${selectedIds.length} logs queried` });
      setShowQuery(false);
      setQueryNote('');
      onClear?.();
      onDone?.();
    } catch (err) {
      toast({ title: 'Failed to query logs', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 shadow-lg px-4 py-3 flex items-center justify-between gap-3 safe-area-bottom">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold">
            {selectedIds.length}
          </span>
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.length} log{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-600 transition ml-1">
            Clear
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuery(true)}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition disabled:opacity-50"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Query</span>
          </button>
          <button
            onClick={handleApprove}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span className="hidden sm:inline">Approve All</span>
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
                <h2 className="text-base font-bold text-slate-900">Query {selectedIds.length} Logs</h2>
                <p className="text-xs text-slate-500">The crew will see your note</p>
              </div>
            </div>
            <textarea
              value={queryNote}
              onChange={e => setQueryNote(e.target.value)}
              placeholder="e.g. Missing groundwater strike depth — please add and resubmit"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => { setShowQuery(false); setQueryNote(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
                Cancel
              </button>
              <button
                onClick={handleQuery}
                disabled={processing || !queryNote.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Send Query
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}