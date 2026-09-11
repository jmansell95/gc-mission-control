import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addDays } from 'date-fns';
import {
  Plane, FileText, ArrowLeftRight, MessageSquare, Loader2, Check, X, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ShiftSwapBoard from './ShiftSwapBoard';
import StaffMessenger from './StaffMessenger';

/**
 * SelfServiceHub — self-service requests for field staff.
 * Pill-based sub-nav: Requests (holiday/expense/payslip) · Shift Swap · Messages
 */
export default function SelfServiceHub({ staff, divisionId, divisionStaff = [], myAssignments = [], isManager = false, initialTab = 'requests', activeTab: controlledTab, onTabChange }) {
  const [internalTab, setInternalTab] = useState(initialTab);
  const isControlled = controlledTab !== undefined;
  const subTab = isControlled ? controlledTab : internalTab;

  const tabs = [
    { key: 'requests', label: 'Requests', icon: FileText },
    { key: 'swap', label: 'Shift Swap', icon: ArrowLeftRight },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-nav pills — only shown when uncontrolled (e.g. StaffDashboard).
          When used inside FieldCommsButton, the parent sheet provides its own tab bar. */}
      {!isControlled && (
        <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 gap-1">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setInternalTab(t.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {subTab === 'requests' && <RequestsTab staff={staff} divisionId={divisionId} />}
      {subTab === 'swap' && <ShiftSwapBoard staff={staff} divisionId={divisionId} myAssignments={myAssignments} isManager={isManager} />}
      {subTab === 'messages' && <StaffMessenger staff={staff} divisionStaff={divisionStaff} divisionId={divisionId} />}
    </div>
  );
}

function RequestsTab({ staff, divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [holiday, setHoliday] = useState({ start: format(addDays(new Date(), 7), 'yyyy-MM-dd'), end: format(addDays(new Date(), 10), 'yyyy-MM-dd'), reason: 'holiday', notes: '' });
  const [submitting, setSubmitting] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteRequest = async (reqId) => {
    setDeletingId(reqId);
    try {
      await base44.entities.StaffRequest.delete(reqId);
      queryClient.invalidateQueries({ queryKey: ['my-staff-requests', staff?.id] });
      queryClient.invalidateQueries({ queryKey: ['comms-my-requests', staff?.id, divisionId] });
      toast({ title: 'Request deleted', description: 'Your pending request has been removed.' });
      setConfirmDeleteId(null);
    } catch (e) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
    setDeletingId(null);
  };

  const { data: myAbsences = [] } = useQueryAbsences(staff?.id);
  const { data: myStaffRequests = [] } = useQuery({
    queryKey: ['my-staff-requests', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      const all = await base44.entities.StaffRequest.filter({ staff_id: staff.id });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!staff?.id,
  });

  const submitHoliday = async () => {
    if (!holiday.start || !holiday.end || submitting) return;
    if (new Date(holiday.end) < new Date(holiday.start)) {
      toast({ title: 'Invalid dates', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }
    setSubmitting('holiday');
    try {
      await base44.entities.Absence.create({
        staff_id: staff.id,
        staff_name: staff.name,
        division_id: divisionId,
        start_date: holiday.start,
        end_date: holiday.end,
        reason: holiday.reason,
        notes: holiday.notes || undefined,
        status: 'pending',
        source: 'manual',
      });
      toast({ title: 'Holiday requested', description: 'Your manager will review this request.' });
      setHoliday(h => ({ ...h, notes: '' }));
      queryClient.invalidateQueries({ queryKey: ['my-absences', staff?.id] });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setSubmitting(null);
  };

  return (
    <div className="space-y-4">
      {/* Holiday request */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Plane className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Request Holiday</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500">From</span>
            <input type="date" value={holiday.start} onChange={e => setHoliday(h => ({ ...h, start: e.target.value }))} className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-500">To</span>
            <input type="date" value={holiday.end} onChange={e => setHoliday(h => ({ ...h, end: e.target.value }))} className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
        </div>
        <select value={holiday.reason} onChange={e => setHoliday(h => ({ ...h, reason: e.target.value }))} className="w-full mb-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="holiday">Holiday</option>
          <option value="personal">Personal</option>
          <option value="training">Training</option>
          <option value="other">Other</option>
        </select>
        <textarea value={holiday.notes} onChange={e => setHoliday(h => ({ ...h, notes: e.target.value }))} placeholder="Notes (optional)…" rows={2} className="w-full mb-3 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={submitHoliday} disabled={submitting === 'holiday'} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95 transition disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {submitting === 'holiday' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Submit Request
        </button>
      </div>

      {/* My pending requests */}
      {myAbsences.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">My Requests</h3>
          <div className="space-y-2">
            {myAbsences.slice(0, 5).map(a => {
              const statusTint = a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : a.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
              return (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 capitalize">{a.reason}</p>
                    <p className="text-xs text-slate-400">{format(new Date(a.start_date + 'T00:00:00'), 'dd MMM')} — {format(new Date(a.end_date + 'T00:00:00'), 'dd MMM')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusTint}`}>{a.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My office requests — equipment/general (expense/payslip creation removed) */}
      {myStaffRequests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">My Office Requests</h3>
          <div className="space-y-2">
            {myStaffRequests.slice(0, 10).map(r => {
              const statusTint = r.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700' : r.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
              const canDelete = r.status === 'pending';
              const isConfirming = confirmDeleteId === r.id;
              return (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 capitalize">{r.request_type}</p>
                    <p className="text-xs text-slate-400 truncate">{r.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusTint}`}>{r.status.replace('_', ' ')}</span>
                    {canDelete && (
                      isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteRequest(r.id)}
                            disabled={deletingId === r.id}
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold transition active:scale-95 disabled:opacity-50"
                          >
                            {deletingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-bold transition active:scale-95"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center transition active:scale-90 hover:bg-rose-100"
                          aria-label="Delete request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// Small hook to fetch the current user's absences
function useQueryAbsences(staffId) {
  return useQuery({
    queryKey: ['my-absences', staffId],
    queryFn: async () => {
      if (!staffId) return [];
      const all = await base44.entities.Absence.filter({ staff_id: staffId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!staffId,
  });
}