import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  ArrowLeftRight, MapPin, Clock, Check, X, Loader2, Hand, UserCheck, CalendarOff,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

const STATUS_META = {
  offered: { label: 'Open', tint: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  claimed: { label: 'Pending Approval', tint: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Approved', tint: 'bg-blue-50 text-blue-700 ring-blue-200' },
  rejected: { label: 'Rejected', tint: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { label: 'Cancelled', tint: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

/**
 * ShiftSwapBoard — marketplace where crews offer shifts and others claim them.
 * Managers (admin/director) approve or reject claims.
 * Staff can only offer their own assignments and claim swaps in their division.
 */
export default function ShiftSwapBoard({ staff, divisionId, myAssignments = [], isManager = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [offering, setOffering] = useState(null);
  const [offerReason, setOfferReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: swaps = [], isLoading } = useQuery({
    queryKey: ['shift-swaps', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.ShiftSwap.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!divisionId,
    refetchInterval: 30000,
  });

  const handleOffer = async () => {
    if (!offering || submitting) return;
    setSubmitting(true);
    try {
      await base44.entities.ShiftSwap.create({
        offering_staff_id: staff.id,
        offering_staff_name: staff.name,
        assignment_id: offering.id,
        job_id: offering.job_id,
        job_name: offering.jobName || offering.job_name || 'Shift',
        division_id: divisionId,
        assigned_date: offering.assigned_date,
        start_time: offering.start_time,
        location: offering.location,
        reason: offerReason.trim() || undefined,
        status: 'offered',
      });
      toast({ title: 'Shift offered', description: 'Your shift is now on the swap board.' });
      setOffering(null);
      setOfferReason('');
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', divisionId] });
    } catch (e) {
      toast({ title: 'Failed to offer shift', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleClaim = async (swap) => {
    try {
      await base44.functions.invoke('claimShiftSwap', { swap_id: swap.id });
      toast({ title: 'Shift claimed', description: 'Awaiting manager approval — your manager has been notified.' });
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', divisionId] });
    } catch (e) {
      toast({ title: 'Failed to claim', description: e.message, variant: 'destructive' });
    }
  };

  const handleDecision = async (swap, approved, note) => {
    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        status: approved ? 'approved' : 'rejected',
        approved_by: staff.name,
        approved_at: new Date().toISOString(),
        manager_note: note || undefined,
      });
      // If approved, reassign the rota assignment to the claiming staff
      if (approved && swap.assignment_id && swap.claiming_staff_id) {
        await base44.entities.RotaAssignment.update(swap.assignment_id, {
          staff_id: swap.claiming_staff_id,
        });
      }
      toast({ title: approved ? 'Swap approved' : 'Swap rejected', description: approved ? 'The shift has been reassigned.' : 'The claim was declined.' });
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', divisionId] });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (swap) => {
    try {
      await base44.entities.ShiftSwap.update(swap.id, { status: 'cancelled' });
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', divisionId] });
    } catch (e) {
      toast({ title: 'Failed to cancel', description: e.message, variant: 'destructive' });
    }
  };

  const openSwaps = swaps.filter(s => s.status === 'offered' || s.status === 'claimed');
  const mySwapAssignments = myAssignments.filter(a => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return a.assigned_date >= today && !swaps.some(s => s.assignment_id === a.id && s.status !== 'cancelled' && s.status !== 'rejected');
  });

  return (
    <div className="space-y-4">
      {/* Offer a shift */}
      {mySwapAssignments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <CalendarOff className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Offer a Shift</h3>
          </div>
          {!offering ? (
            <div className="space-y-2">
              {mySwapAssignments.slice(0, 5).map(a => (
                <button
                  key={a.id}
                  onClick={() => setOffering(a)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-left active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.jobName || a.job_name || 'Shift'}</p>
                    <p className="text-xs text-slate-400">{format(new Date(a.assigned_date + 'T00:00:00'), 'EEE dd MMM')} {a.start_time && `· ${a.start_time}`}</p>
                  </div>
                  <ArrowLeftRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-sm font-bold text-slate-800">{offering.jobName || 'Shift'}</p>
                <p className="text-xs text-slate-500">{format(new Date(offering.assigned_date + 'T00:00:00'), 'EEE dd MMM')} {offering.start_time && `· ${offering.start_time}`}</p>
              </div>
              <textarea
                value={offerReason}
                onChange={e => setOfferReason(e.target.value)}
                placeholder="Reason (optional)…"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <div className="flex gap-2">
                <button onClick={handleOffer} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold active:scale-95 transition disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Post to Board'}
                </button>
                <button onClick={() => { setOffering(null); setOfferReason(''); }} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Open swaps */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Hand className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Open Shifts</h3>
          <span className="text-xs text-slate-400">({openSwaps.length})</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : openSwaps.length === 0 ? (
          <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
            <p className="text-sm text-slate-400">No shifts on the board right now</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {openSwaps.map(swap => {
              const meta = STATUS_META[swap.status] || STATUS_META.offered;
              const mine = swap.offering_staff_id === staff?.id;
              const claimedByMe = swap.claiming_staff_id === staff?.id;
              const canClaim = swap.status === 'offered' && !mine;
              return (
                <div key={swap.id} className="bg-white border border-slate-200 rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <ProfileAvatar name={swap.offering_staff_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{swap.job_name || 'Shift'}</p>
                      <p className="text-xs text-slate-400">Offered by {swap.offering_staff_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${meta.tint} flex-shrink-0`}>{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarOff className="w-3 h-3" /> {format(new Date(swap.assigned_date + 'T00:00:00'), 'EEE dd MMM')}</span>
                    {swap.start_time && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {swap.start_time}</span>}
                    {swap.location && <span className="inline-flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {swap.location}</span>}
                  </div>
                  {swap.reason && <p className="text-xs text-slate-500 mt-2 italic">"{swap.reason}"</p>}

                  {swap.status === 'claimed' && swap.claiming_staff_name && (
                    <div className="flex items-center gap-2 mt-2.5 p-2 rounded-lg bg-amber-50">
                      <UserCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-800 font-medium">Claimed by {swap.claiming_staff_name} — awaiting approval</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {canClaim && (
                      <button onClick={() => handleClaim(swap)} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition">
                        Claim Shift
                      </button>
                    )}
                    {mine && swap.status === 'offered' && (
                      <button onClick={() => handleCancel(swap)} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">
                        Cancel Offer
                      </button>
                    )}
                    {isManager && swap.status === 'claimed' && (
                      <>
                        <button onClick={() => handleDecision(swap, true)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 transition inline-flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleDecision(swap, false)} className="flex-1 py-2 rounded-xl bg-rose-100 text-rose-600 text-xs font-bold active:scale-95 transition inline-flex items-center justify-center gap-1">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}