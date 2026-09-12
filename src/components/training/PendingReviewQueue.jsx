import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  ClipboardCheck, CheckCircle2, XCircle, Loader2, MapPin, FileText, ExternalLink, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton, EmptyState } from '@/components/StateViews';

/**
 * Manager-facing queue of staff-submitted training documents awaiting review.
 * Documents are ComplianceItems with review_status='pending_review' and category='staff'.
 * Approve → review_status='approved' (counts as valid). Reject → delete the item + notify.
 */
export default function PendingReviewQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['pending-training-reviews'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff', review_status: 'pending_review' }, '-created_date', 200),
  });

  const handleApprove = async (item) => {
    setBusyId(item.id);
    try {
      await base44.entities.ComplianceItem.update(item.id, {
        review_status: 'approved',
        reviewed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['pending-training-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance'] });
      toast({ title: 'Document approved', description: `${item.title} is now valid for ${item.reference_name || 'staff'}.` });
    } catch (e) {
      toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' });
    }
    setBusyId(null);
  };

  const handleReject = async (item) => {
    const reason = prompt(`Reject "${item.title}" for ${item.reference_name || 'this staff member'}?\nReason (shown to staff):`);
    if (reason === null) return;
    setBusyId(item.id);
    try {
      // Reject: delete the item so it's removed from compliance, and notify the staff member
      await base44.entities.ComplianceItem.delete(item.id);
      // Best-effort email notification to the staff member
      try {
        const staff = await base44.entities.Staff.get(item.reference_id);
        if (staff?.email) {
          await base44.integrations.Core.SendEmail({
            to: staff.email,
            subject: `Training document needs attention: ${item.title}`,
            body: `Hi ${staff.name || ''},\n\nYour uploaded training document "${item.title}" was reviewed but couldn't be accepted.${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease re-upload a clear, complete copy via the app's Documents section, or speak to your manager if you have questions.\n\nGC Mission Control`,
          });
        }
      } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ['pending-training-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance'] });
      toast({ title: 'Document rejected', description: `${item.reference_name || 'Staff'} has been notified.` });
    } catch (e) {
      toast({ title: 'Rejection failed', description: e?.message, variant: 'destructive' });
    }
    setBusyId(null);
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  if (allItems.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <EmptyState icon={ClipboardCheck} title="No documents pending review" message="Staff-submitted training documents awaiting manager approval will appear here." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-slate-700">Pending Review</h3>
        <span className="text-xs text-slate-400">· {allItems.length} awaiting</span>
      </div>
      {allItems.map((item) => (
        <div key={item.id} className="hub-glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending Review</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{item.reference_name || 'Staff'}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
              {item.created_date && (
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(item.created_date), 'dd MMM yyyy')}</span>
              )}
              {item.submitter_location && (
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{item.submitter_location}</span>
              )}
              {item.document_url && (
                <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> View document
                </a>
              )}
            </div>
            {item.notes && <p className="text-xs text-slate-500 mt-1.5 italic">"{item.notes}"</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
            <button onClick={() => handleApprove(item)} disabled={busyId === item.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50">
              {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve
            </button>
            <button onClick={() => handleReject(item)} disabled={busyId === item.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}