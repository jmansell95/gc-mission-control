import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Clock, CheckCircle2, XCircle, PenLine, Eraser, Loader2, ShieldCheck, AlertCircle, Car,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SignaturePad from '@/components/staff/SignaturePad';
import { format } from 'date-fns';

/**
 * EarlyLeaveApprovalCard — shows pending early-leave requests for this job
 * and lets a manager approve (with signature) or reject each one.
 *
 * Lives in the Schedule & Crew tab of the job detail page.
 * Only visible to admins/managers.
 */
export default function EarlyLeaveApprovalCard({ job, rotas, allStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);
  const [signatures, setSignatures] = useState({});

  const pendingRequests = rotas.filter(
    r => r.job_id === job?.id && r.early_leave_status === 'pending'
  );

  const recentDecisions = rotas.filter(
    r => r.job_id === job?.id && (r.early_leave_status === 'approved' || r.early_leave_status === 'rejected')
  ).slice(0, 5);

  if (pendingRequests.length === 0 && recentDecisions.length === 0) return null;

  const handleApprove = async (rotaId) => {
    const sig = signatures[rotaId];
    if (!sig) {
      toast({ title: 'Signature required', description: 'Please draw your signature to approve', variant: 'destructive' });
      return;
    }
    setProcessing(rotaId);
    try {
      await base44.functions.invoke('approveEarlyLeave', {
        body: JSON.stringify({
          assignmentId: rotaId,
          decision: 'approved',
          signatureDataUrl: sig,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['job-rotas'] });
      toast({ title: 'Approved', description: 'Early-leave request approved with signature' });
      setSignatures(prev => { const n = { ...prev }; delete n[rotaId]; return n; });
    } catch (err) {
      toast({ title: 'Error', description: err.message || 'Failed to approve', variant: 'destructive' });
    }
    setProcessing(null);
  };

  const handleReject = async (rotaId) => {
    setProcessing(rotaId);
    try {
      await base44.functions.invoke('approveEarlyLeave', {
        body: JSON.stringify({
          assignmentId: rotaId,
          decision: 'rejected',
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['job-rotas'] });
      toast({ title: 'Rejected', description: 'Early-leave request rejected' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  return (
    <div className="space-y-3">
      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="hub-glass rounded-3xl overflow-hidden animate-slide-up">
          <div className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Clock className="w-[18px] h-[18px]" />
            </span>
            <div className="flex-1">
              <h3 className="text-hub-section text-slate-900">Early-Leave Approvals</h3>
              <p className="text-hub-caption text-slate-500">{pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''} awaiting your sign-off</p>
            </div>
          </div>
          <div className="px-4 sm:px-5 pb-4 space-y-3">
            {pendingRequests.map(rota => {
              const member = allStaff.find(s => s.id === rota.staff_id);
              const dateStr = rota.assigned_date ? format(new Date(rota.assigned_date + 'T00:00:00'), 'EEE dd MMM') : '';
              const isTravel = rota.early_leave_reason?.toLowerCase().includes('travel');
              return (
                <div key={rota.id} className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isTravel ? 'bg-blue-100' : 'bg-amber-100'}`}>
                      {isTravel ? <Car className="w-4 h-4 text-blue-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{member?.name || 'Unknown staff'}</p>
                      <p className="text-xs text-slate-500">{dateStr} · Leaving at {rota.left_site_at ? format(new Date(rota.left_site_at), 'HH:mm') : '—'}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                          {rota.early_leave_reason || 'Early finish'}
                        </span>
                      </div>
                      {rota.early_leave_note && (
                        <p className="text-xs text-slate-600 mt-1.5 bg-white/60 rounded-lg px-2.5 py-1.5 border border-slate-100">
                          "{rota.early_leave_note}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Signature pad */}
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                      <PenLine className="w-3 h-3" /> Manager signature to approve
                    </label>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <SignaturePad onChange={(dataUrl) => setSignatures(prev => ({ ...prev, [rota.id]: dataUrl }))} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(rota.id)}
                      disabled={processing === rota.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(rota.id)}
                      disabled={processing === rota.id || !signatures[rota.id]}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-[#244715] disabled:opacity-50 transition"
                    >
                      {processing === rota.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {processing === rota.id ? 'Processing…' : 'Approve & Sign'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent decisions */}
      {recentDecisions.length > 0 && (
        <div className="hub-glass rounded-3xl overflow-hidden">
          <div className="px-4 sm:px-5 pt-3 pb-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recent Decisions</h4>
          </div>
          <div className="px-4 sm:px-5 pb-3 space-y-1.5">
            {recentDecisions.map(rota => {
              const member = allStaff.find(s => s.id === rota.staff_id);
              const approved = rota.early_leave_status === 'approved';
              return (
                <div key={rota.id} className="flex items-center gap-2 text-xs py-1">
                  {approved ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-slate-700">{member?.name || 'Unknown'}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{rota.early_leave_reason || 'Early finish'}</span>
                  <span className="text-slate-300 ml-auto">
                    {rota.early_leave_approved_at ? format(new Date(rota.early_leave_approved_at), 'dd MMM HH:mm') : ''}
                  </span>
                  {approved && rota.early_leave_approved_by && (
                    <span className="text-emerald-600 font-medium">by {rota.early_leave_approved_by}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}