import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addDays } from 'date-fns';
import {
  Plane, Receipt, FileText, ArrowLeftRight, MessageSquare, Loader2, Check, X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ShiftSwapBoard from './ShiftSwapBoard';
import StaffMessenger from './StaffMessenger';

/**
 * SelfServiceHub — self-service requests for field staff.
 * Pill-based sub-nav: Requests (holiday/expense/payslip) · Shift Swap · Messages
 */
export default function SelfServiceHub({ staff, divisionId, divisionStaff = [], myAssignments = [], isManager = false, initialTab = 'requests' }) {
  const [subTab, setSubTab] = useState(initialTab);

  const tabs = [
    { key: 'requests', label: 'Requests', icon: FileText },
    { key: 'swap', label: 'Shift Swap', icon: ArrowLeftRight },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-nav pills */}
      <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
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

  const { data: myAbsences = [] } = useQueryAbsences(staff?.id);

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

  const submitExpense = async () => {
    setSubmitting('expense');
    try {
      await base44.entities.StaffRequest.create({
        staff_id: staff.id,
        staff_name: staff.name,
        division_id: divisionId,
        request_type: 'expense',
        subject: 'Expense claim',
        body: `${staff.name} has submitted an expense claim for review.`,
        status: 'pending',
      });
      toast({ title: 'Expense submitted', description: 'The office has been notified.' });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setSubmitting(null);
  };

  const submitPayslip = async () => {
    setSubmitting('payslip');
    try {
      await base44.entities.StaffRequest.create({
        staff_id: staff.id,
        staff_name: staff.name,
        division_id: divisionId,
        request_type: 'payslip',
        subject: 'Payslip request',
        body: `${staff.name} has requested their latest payslip.`,
        status: 'pending',
      });
      toast({ title: 'Payslip requested', description: 'Payroll has been notified.' });
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

      {/* Expense & Payslip quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={submitExpense} disabled={submitting === 'expense'} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-amber-300 hover:shadow-sm transition active:scale-95 disabled:opacity-50">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            {submitting === 'expense' ? <Loader2 className="w-5 h-5 animate-spin text-amber-600" /> : <Receipt className="w-5 h-5 text-amber-600" />}
          </div>
          <span className="text-sm font-bold text-slate-800">Submit Expense</span>
        </button>
        <button onClick={submitPayslip} disabled={submitting === 'payslip'} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-violet-300 hover:shadow-sm transition active:scale-95 disabled:opacity-50">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
            {submitting === 'payslip' ? <Loader2 className="w-5 h-5 animate-spin text-violet-600" /> : <FileText className="w-5 h-5 text-violet-600" />}
          </div>
          <span className="text-sm font-bold text-slate-800">Request Payslip</span>
        </button>
      </div>
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