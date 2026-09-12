import React, { Fragment, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, ClipboardCheck, CheckCircle2, ChevronRight, Loader2, Clock, Warehouse,
} from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import DailyChecksStep from '@/components/staff/DailyChecksStep';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

/**
 * DepotShiftWizard — a lighter shift flow for Yard/Depot duty assignments.
 *
 * Two steps only:
 *   1. Daily pre-work checks (reuses DailyChecksStep)
 *   2. Clock in / clock out timesheet
 *
 * No site briefing, weather, arrival-on-site or job-task steps — depot staff
 * are already at the yard. The submitted timesheet is tagged chargeable=false
 * so it rolls up as standalone overhead labour, never attributed to a job.
 */
export default function DepotShiftWizard({ open, onClose, assignment, staff }) {
  const [step, setStep] = useState('checks');
  const [saving, setSaving] = useState(false);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && assignment) {
      setStep(assignment.daily_checks_completed ? 'timesheet' : 'checks');
      setClockIn(assignment.start_time || '');
      setClockOut(assignment.end_time || '');
      setNotes(assignment.notes || '');
      setSaving(false);
    }
  }, [open, assignment?.id]);

  if (!open || !assignment) return null;

  const computeWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  };

  const handleConfirmChecks = async () => {
    const el = document.getElementById('daily-checks-complete');
    if (!el || el.value !== '1') return;
    setSaving(true);
    try {
      await base44.entities.RotaAssignment.update(assignment.id, {
        daily_checks_completed: true,
        daily_checks_completed_at: new Date().toISOString(),
      });
      setSaving(false);
      setStep('timesheet');
    } catch (e) {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!clockIn || !clockOut) return;
    setSaving(true);
    try {
      const [ih, im] = clockIn.split(':').map(Number);
      const [oh, om] = clockOut.split(':').map(Number);
      let mins = (oh * 60 + om) - (ih * 60 + im);
      if (mins < 0) mins += 24 * 60; // overnight shift
      const totalHours = Math.round((mins / 60) * 100) / 100;
      const date = assignment.assigned_date;
      const now = new Date().toISOString();
      const clockInIso = new Date(date + 'T' + clockIn + ':00').toISOString();
      const clockOutIso = new Date(date + 'T' + clockOut + ':00').toISOString();

      await base44.entities.Timesheet.create({
        staff_id: assignment.staff_id,
        division_id: assignment.division_id || '',
        date,
        week_start: computeWeekStart(date),
        task_description: 'Depot duty',
        task_type: 'on_site',
        start_time: clockIn,
        end_time: clockOut,
        total_hours: totalHours,
        is_break: false,
        chargeable: false,
        source: 'staff',
        status: 'submitted',
        notes: notes || '',
      });

      await base44.entities.RotaAssignment.update(assignment.id, {
        status: 'completed',
        started_at: clockInIso,
        arrived_on_site_at: clockInIso,
        left_site_at: clockOutIso,
        completed_at: now,
        notes: notes || assignment.notes || '',
      });

      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-approved-month'] });
      setSaving(false);
      onClose();
    } catch (e) {
      console.error('Depot shift submit error:', e);
      setSaving(false);
    }
  };

  const validTimes = clockIn && clockOut;
  const stepLabels = { checks: 'Checks', timesheet: 'Clock In/Out' };
  const stepOrder = ['checks', 'timesheet'];
  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white flex flex-col"
        >
          {/* Top bar */}
          <div className="hero-gradient px-5 py-3.5 text-white flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <Warehouse className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">Yard / Depot Duty</h2>
                <p className="text-white/70 text-xs truncate">
                  {format(new Date(assignment.assigned_date + 'T00:00:00'), 'EEEE dd MMM')}
                </p>
              </div>
            </div>
            <button onClick={onClose} disabled={saving}
              className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="hero-gradient px-5 pb-3 text-white flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {stepOrder.map((s, i) => (
                <Fragment key={s}>
                  <div className={`flex items-center gap-1.5 ${i <= currentStepIndex ? 'text-white' : 'text-white/40'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < currentStepIndex ? 'bg-white text-primary' : i === currentStepIndex ? 'bg-white/25 ring-1 ring-white/40' : 'bg-white/10'}`}>
                      {i < currentStepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="text-[11px] font-medium">{stepLabels[s]}</span>
                  </div>
                  {i < stepOrder.length - 1 && (
                    <div className={`h-0.5 flex-1 rounded-full ${i < currentStepIndex ? 'bg-white' : 'bg-white/20'}`} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {step === 'checks' && (
                  <DailyChecksStep assignment={assignment} job={null} staff={staff} saving={saving} />
                )}
                {step === 'timesheet' && (
                  <div className="space-y-4 px-5 py-5 max-w-md mx-auto">
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                      <Warehouse className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Log your yard/depot hours below. This shift is recorded as non-chargeable
                        overhead — it tracks your day for payroll without generating any job revenue.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Clock in</label>
                        <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)}
                          className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Clock out</label>
                        <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)}
                          className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                      </div>
                    </div>
                    {validTimes && (() => {
                      const [ih, im] = clockIn.split(':').map(Number);
                      const [oh, om] = clockOut.split(':').map(Number);
                      let mins = (oh * 60 + om) - (ih * 60 + im);
                      if (mins < 0) mins += 24 * 60;
                      return (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                          <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                          <p className="text-xs text-primary font-medium">Total: {fmtDur(mins)}</p>
                        </div>
                      );
                    })()}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes (optional)</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                        placeholder="Any notes about today's depot work..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm resize-none" />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-4 flex gap-2.5 flex-shrink-0 safe-area-bottom">
            <button onClick={onClose} disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-base font-semibold touch-manipulation">
              Cancel
            </button>
            {step === 'checks' && (
              <button onClick={handleConfirmChecks} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Confirm Checks Complete'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === 'timesheet' && (
              <button onClick={handleSubmit} disabled={saving || !validTimes}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {saving ? 'Submitting...' : 'Submit Shift'}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}