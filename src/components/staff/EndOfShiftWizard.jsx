import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, Car, Ruler, FileText, ClipboardCheck, Send, ChevronRight, AlertTriangle, Coffee, Briefcase, Info, ShieldCheck, Clock, Receipt, Boxes, DoorOpen, Truck, Tablet, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import DailyExpenseStep from './DailyExpenseStep';
import AssetRecoveryStep from './AssetRecoveryStep';
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

const entryMeta = (t) => {
  if (t.is_break) return { Icon: Coffee, bg: 'bg-amber-50/50', iconBg: 'bg-amber-100', label: 'Lunch Break' };
  if (t.linked_delivery_id) return { Icon: Truck, bg: 'bg-cyan-50/50', iconBg: 'bg-cyan-100', label: t.task_description };
  if (t.task_type === 'travel_to') return { Icon: Car, bg: 'bg-blue-50/50', iconBg: 'bg-blue-100', label: 'Travel to Site' };
  if (t.task_type === 'travel_from') return { Icon: Car, bg: 'bg-blue-50/50', iconBg: 'bg-blue-100', label: 'Travel Home' };
  if (/briefing|induction/i.test(t.task_description || '')) return { Icon: ShieldCheck, bg: 'bg-purple-50/50', iconBg: 'bg-purple-100', label: t.task_description };
  return { Icon: Briefcase, bg: 'bg-white', iconBg: 'bg-emerald-100', label: t.task_description };
};

// A step-by-step wizard that flows staff through reviewing their day and
// submitting everything: tasks review → meterage (drillers) → progress notes →
// travel home (last job) → final review & submit.
const REQUIRED_WORK_MINS = 540; // 9 hours on-site (excludes travel)

export default function EndOfShiftWizard({ open, onClose, onSubmit, assignment, job, staffId, isDriller, isLastJob, onEarlyLeave }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [step, setStep] = useState(0);
  const [meterage, setMeterage] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [departSite, setDepartSite] = useState('');
  const [arriveHome, setArriveHome] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [assetReturnData, setAssetReturnData] = useState({ scannedItems: [], scannedAssetIds: [], scannedManifestIds: [] });
  const [confirmations, setConfirmations] = useState({ tasks: false, travel: false, hours: false });

  const isDecommissioning = job?.status === 'decommissioning';

  const { data: todayEntries = [], isLoading } = useQuery({
    queryKey: ['daily-tasks', staffId, today],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today }),
    enabled: !!staffId && open,
  });

  useEffect(() => {
    if (open) {
      setStep(0); setMeterage(''); setProgressNotes(assignment?.progress_notes || '');
      // Default "Left site" to the assignment's left_site_at time if recorded
      let defaultDepart = '';
      if (assignment?.left_site_at) {
        const d = new Date(assignment.left_site_at);
        if (!isNaN(d.getTime())) {
          defaultDepart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      }
      setDepartSite(defaultDepart); setArriveHome(''); setSubmitting(false);
      setExpenses([]);
      setAssetReturnData({ scannedItems: [], scannedAssetIds: [], scannedManifestIds: [] });
      setConfirmations({ tasks: false, travel: false, hours: false });
    }
  }, [open]);

  const steps = [
    ...(isDriller ? [{ key: 'klb', label: 'KeyLogBook' }] : []),
    { key: 'review', label: 'Review' },
    ...(isDriller ? [{ key: 'meterage', label: 'Meterage' }] : []),
    { key: 'notes', label: 'Notes' },
    { key: 'expenses', label: 'Expenses' },
    ...(isDecommissioning ? [{ key: 'assets', label: 'Gear Return' }] : []),
    ...(isLastJob ? [{ key: 'travel', label: 'Travel Home' }] : []),
    { key: 'submit', label: 'Submit' },
  ];

  const entries = todayEntries.filter(t => t.status !== 'deleted' && t.status !== 'rejected' && t.status !== 'merged');
  const sortedEntries = [...entries].sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
  const totalMins = entries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const hasTasks = entries.length > 0;

  // On-site work = everything except travel_to / travel_from
  const isTravel = (t) => t.task_type === 'travel_to' || t.task_type === 'travel_from';
  const onSiteEntries = entries.filter(t => !isTravel(t));
  const onSiteMins = onSiteEntries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const travelEntries = entries.filter(isTravel);
  const travelMinsLogged = travelEntries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);

  const meetsRequiredHours = onSiteMins >= REQUIRED_WORK_MINS;
  const earlyLeaveRecorded = !!(assignment?.early_leave_reason);
  // Allowed to submit short day only if an early-leave reason was recorded
  const shortDayWithoutReason = !meetsRequiredHours && !earlyLeaveRecorded;

  const travelMins = departSite && arriveHome
    ? (() => { const [dh, dm] = departSite.split(':').map(Number); const [ah, am] = arriveHome.split(':').map(Number); const m = (ah * 60 + am) - (dh * 60 + dm); return m > 0 ? m : 0; })()
    : 0;
  const invalidTravel = departSite && arriveHome && travelMins === 0;

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    // Save any logged expenses as DailyCost records
    if (expenses.length > 0 && job?.id && staffId) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const monday = format(new Date(today), 'yyyy-MM-dd');
      const wsDate = new Date(monday);
      const day = wsDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      wsDate.setDate(wsDate.getDate() + diff);
      const weekStart = format(wsDate, 'yyyy-MM-dd');
      try {
        await base44.entities.DailyCost.bulkCreate(expenses.map(e => ({
          job_id: job.id,
          assignment_id: assignment?.id || '',
          staff_id: staffId,
          date: today,
          week_start: weekStart,
          category: e.category,
          description: e.description,
          amount_net: e.amount_net,
          amount_vat: e.amount_vat,
          amount_gross: e.amount_gross,
          vat_rate: e.vat_rate || 0,
          receipt_url: e.receipt_url || '',
          preset_id: e.preset_id || '',
          supplier_name: e.supplier_name || '',
          gl_code: e.gl_code || '',
          status: 'submitted',
        })));
      } catch (e) { console.error('Expense save failed:', e); }
    }
    onSubmit({
      meterage: isDriller ? (parseFloat(meterage) || 0) : undefined,
      progressNotes: progressNotes.trim(),
      travelHome: isLastJob ? { departSite: departSite || null, arriveHome: arriveHome || null } : null,
      assetReturn: isDecommissioning && assetReturnData.scannedItems.length > 0 ? {
        scannedAssetIds: assetReturnData.scannedAssetIds || [],
        scannedManifestIds: assetReturnData.scannedManifestIds || [],
        notes: '',
      } : null,
    });
  };

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const canAdvance = () => {
    if (currentStep.key === 'review') return hasTasks;
    if (currentStep.key === 'travel') return !invalidTravel;
    return true;
  };

  const allConfirmationsChecked = confirmations.tasks && confirmations.travel && confirmations.hours;
  // Final submit button is locked unless all confirmations are checked AND
  // either the 9-hour requirement is met or an early-leave reason is recorded.
  const canSubmit = allConfirmationsChecked && !shortDayWithoutReason;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white flex flex-col"
          onClick={onClose}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full h-full overflow-hidden flex flex-col">

            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">End of Shift</h2>
                    <p className="text-emerald-100 text-xs">{job?.name || 'Shift completion'}</p>
                  </div>
                </div>
                <button onClick={onClose} disabled={submitting} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {steps.map((s, i) => (
                  <div key={s.key} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-white' : 'bg-white/25'}`} />
                ))}
              </div>
              <p className="text-[11px] text-emerald-100 mt-2">Step {step + 1} of {steps.length} — {currentStep.label}</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Pre-step: KeyLogBook reminder (drillers only) */}
              {currentStep.key === 'klb' && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] p-5 text-white">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                        <Tablet className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-base font-bold leading-tight">Have you logged in KeyLogBook today?</p>
                        <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
                          Your daily activities need to be logged on KeyLogBook before you close off your shift. All data is sent back to the office automatically and links to your rates — no manual entry needed here.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-white/70 flex-shrink-0" />
                      <p className="text-xs text-white/80">Once you've finished logging on your tablet, tap Continue below to review your shift.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>KeyLogBook activities auto-price via the rate card keyword matcher — financial figures flow into your AFP automatically.</span>
                  </div>
                </div>
              )}

              {/* Step 1: Review Tasks */}
              {currentStep.key === 'review' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-slate-700">Review everything you've logged today:</p>
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                  ) : sortedEntries.length === 0 ? (
                    <div className="text-center py-8 bg-amber-50 rounded-xl border border-amber-100">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-amber-900">No tasks logged yet</p>
                      <p className="text-xs text-amber-700 mt-1">Close this and add your daily tasks first.</p>
                    </div>
                  ) : (
                    <>
                      {/* Hours summary cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-xl border p-3.5 ${meetsRequiredHours ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">On-site work</p>
                          </div>
                          <p className={`text-xl font-bold tabular-nums ${meetsRequiredHours ? 'text-emerald-700' : 'text-slate-700'}`}>{fmtDur(onSiteMins)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Excludes travel time</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Car className="w-3.5 h-3.5 text-slate-400" />
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Travel</p>
                          </div>
                          <p className="text-xl font-bold text-slate-700 tabular-nums">{fmtDur(travelMinsLogged)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{travelEntries.length} leg{travelEntries.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* 9-hour requirement banner */}
                      {shortDayWithoutReason ? (
                        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-red-900">On-site work is under 9 hours ({fmtDur(onSiteMins)})</p>
                            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                              You haven't recorded an early leave reason. Go back and use the <strong>Leave Site Early</strong> button on your job card to record why you left early, or add the missing tasks.
                            </p>
                          </div>
                        </div>
                      ) : !meetsRequiredHours && earlyLeaveRecorded ? (
                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                          <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-amber-900">Short day — early leave recorded</p>
                            <p className="text-xs text-amber-700 mt-0.5">Reason: {assignment?.early_leave_reason}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <p className="text-xs text-emerald-800 font-medium">9-hour on-site requirement met ✓</p>
                        </div>
                      )}

                      {/* Task list */}
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        {sortedEntries.map(t => {
                          const meta = entryMeta(t);
                          const mins = Number(t.task_duration_minutes) || 0;
                          const travelBadge = isTravel(t);
                          const deliveryBadge = !!t.linked_delivery_id;
                          return (
                            <div key={t.id} className={`px-3.5 py-3 flex items-center gap-3 ${meta.bg}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                                <meta.Icon className="w-4 h-4 text-slate-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-slate-900 truncate flex items-center gap-1.5">
                                  {meta.label}
                                  {travelBadge && <span className="text-[9px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold uppercase">Travel</span>}
                                  {deliveryBadge && <span className="text-[9px] px-1 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold uppercase">Delivery</span>}
                                </p>
                                <p className="text-xs text-slate-400">{t.start_time}–{t.end_time}{t.meterage ? ` · ${t.meterage}m` : ''}</p>
                              </div>
                              <span className="text-sm font-bold text-slate-700 tabular-nums">{fmtDur(mins)}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-3">
                        <span className="text-sm font-medium text-slate-600">Total logged (incl. travel)</span>
                        <span className="text-lg font-bold text-slate-800 tabular-nums">{fmtDur(totalMins)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Meterage (driller only) */}
              {currentStep.key === 'meterage' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 leading-relaxed">
                      Borehole logs are recorded in <strong>KeyLogBook</strong> and imported via AGS — just confirm your total metres drilled today for the timesheet.
                    </p>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
                      <Ruler className="w-4 h-4 text-amber-600" /> Metres drilled today
                    </label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" placeholder="0.0" value={meterage}
                        onChange={e => setMeterage(e.target.value)} autoFocus
                        className="w-full px-4 py-4 pr-12 border-2 border-slate-200 rounded-xl text-2xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-400">m</span>
                    </div>
                    {meterage && parseFloat(meterage) > 0 && (
                      <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {parseFloat(meterage)}m recorded
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Progress Notes */}
              {currentStep.key === 'notes' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <FileText className="w-4 h-4 text-slate-500" /> Progress notes for the next shift
                      </label>
                      <VoiceToTextButton onTranscript={(text) => setProgressNotes(prev => (prev + text).slice(0, 2000))} />
                    </div>
                    <textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} rows={5} autoFocus
                      placeholder="What was done today? What's left for the next shift? Any issues? — or tap Voice to dictate"
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none" />
                    <p className="text-[11px] text-slate-400 mt-1.5">Optional — visible to management and the next shift. Tap <strong>Voice</strong> to dictate hands-free.</p>
                  </div>
                </div>
              )}

              {/* Step 4b: Daily Expenses */}
              {currentStep.key === 'expenses' && (
                <DailyExpenseStep
                  job={job}
                  staffId={staffId}
                  assignment={assignment}
                  expenses={expenses}
                  setExpenses={setExpenses}
                />
              )}

              {/* Step: Asset Recovery (decommissioning only) */}
              {currentStep.key === 'assets' && (
                <AssetRecoveryStep
                  job={job}
                  staffId={staffId}
                  staffName={assignment?.staff_name || ''}
                  returnData={assetReturnData}
                  setReturnData={setAssetReturnData}
                />
              )}

              {/* Step 4: Travel Home (last job only) */}
              {currentStep.key === 'travel' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Car className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-bold">Have a safe journey home!</p>
                    </div>
                    <p className="text-xs text-emerald-50 mt-1.5 leading-relaxed">Log your travel home before submitting your timesheet.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Left site</label>
                      <input type="time" value={departSite} onChange={e => setDepartSite(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived home</label>
                      <input type="time" value={arriveHome} onChange={e => setArriveHome(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                    </div>
                  </div>
                  {invalidTravel && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-800 font-medium">Arrival home must be after leaving site.</p>
                    </div>
                  )}
                  {travelMins > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                      <Car className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-900 font-medium">Travel time: {fmtDur(travelMins)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Final Review & Submit */}
              {currentStep.key === 'submit' && (
                <div className="space-y-4">
                  <div className="text-center py-1">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Ready to submit?</h3>
                    <p className="text-sm text-slate-500 mt-1">Confirm the checks below before submitting.</p>
                  </div>

                  {/* Hours summary banner */}
                  <div className={`rounded-xl border px-4 py-3 ${meetsRequiredHours ? 'bg-emerald-50 border-emerald-200' : earlyLeaveRecorded ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">On-site work</span>
                      <span className={`text-lg font-bold tabular-nums ${meetsRequiredHours ? 'text-emerald-700' : earlyLeaveRecorded ? 'text-amber-700' : 'text-red-700'}`}>{fmtDur(onSiteMins)}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 text-slate-500">Required: 9h (excl. travel) {meetsRequiredHours ? '— met' : earlyLeaveRecorded ? `— short day (${assignment?.early_leave_reason})` : '— not met'}</p>
                  </div>

                  {/* Block banner if short day without reason */}
                  {shortDayWithoutReason && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-red-900">Cannot submit — under 9 hours with no early-leave reason</p>
                        <p className="text-xs text-red-700 mt-0.5">Record why you left site early, or go back and add the missing on-site tasks.</p>
                        {onEarlyLeave && (
                          <button type="button" onClick={() => onEarlyLeave(assignment?.id)}
                            className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 active:scale-95 transition touch-manipulation">
                            <DoorOpen className="w-3.5 h-3.5" /> Record Early Leave Reason
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary details */}
                  <div className="space-y-2.5 bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tasks logged</span>
                      <span className="font-semibold text-slate-900">{entries.length} entries · {fmtDur(totalMins)}</span>
                    </div>
                    {isDriller && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Meterage</span>
                        <span className="font-semibold text-slate-900">{meterage ? `${parseFloat(meterage)}m` : '0m'}</span>
                      </div>
                    )}
                    {progressNotes.trim() && (
                      <div className="text-sm">
                        <span className="text-slate-500">Notes: </span>
                        <span className="text-slate-700">{progressNotes.trim()}</span>
                      </div>
                    )}
                    {isLastJob && travelMins > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Travel home</span>
                        <span className="font-semibold text-slate-900">{fmtDur(travelMins)}</span>
                      </div>
                    )}
                    {expenses.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Expenses</span>
                        <span className="font-semibold text-slate-900">{expenses.length} item{expenses.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {isDecommissioning && assetReturnData.scannedItems.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Gear returning</span>
                        <span className="font-semibold text-slate-900">{assetReturnData.scannedItems.length} item{assetReturnData.scannedItems.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Mandatory confirmations */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Confirm before submitting</p>
                    <button type="button" onClick={() => setConfirmations(c => ({ ...c, tasks: !c.tasks }))}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition ${confirmations.tasks ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${confirmations.tasks ? 'bg-emerald-600' : 'bg-white border-2 border-slate-300'}`}>
                        {confirmations.tasks && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">All site tasks are recorded</p>
                        <p className="text-xs text-slate-500 mt-0.5">I've logged all the work I did today on site.</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => setConfirmations(c => ({ ...c, travel: !c.travel }))}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition ${confirmations.travel ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${confirmations.travel ? 'bg-emerald-600' : 'bg-white border-2 border-slate-300'}`}>
                        {confirmations.travel && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Travel times are accurate</p>
                        <p className="text-xs text-slate-500 mt-0.5">My travel-to-site and travel-home times are correct.</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => setConfirmations(c => ({ ...c, hours: !c.hours }))}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition ${confirmations.hours ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${confirmations.hours ? 'bg-emerald-600' : 'bg-white border-2 border-slate-300'}`}>
                        {confirmations.hours && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Hours are correct {meetsRequiredHours ? '' : earlyLeaveRecorded ? '(early leave recorded)' : '(under 9h)'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {shortDayWithoutReason
                            ? '⚠️ Under 9 hours with no early-leave reason — go back and record your early departure first.'
                            : meetsRequiredHours
                            ? 'My on-site work meets the 9-hour requirement.'
                            : 'My on-site work is under 9 hours because I left site early (reason recorded).'}
                        </p>
                      </div>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center">
                    Your timesheet will be submitted to your manager for approval. A daily summary of who has and hasn't submitted is emailed to managers automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold">
                  Back
                </button>
              )}
              {!isLastStep ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance() || submitting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleFinalSubmit} disabled={!canSubmit || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                  {submitting ? 'Submitting…' : 'Submit Shift'} <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}