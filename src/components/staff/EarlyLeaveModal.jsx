import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DoorOpen, Clock, CheckCircle2, FileText, Car } from 'lucide-react';

const DEFAULT_REASONS = [
  'Friday Travel Home (Long Distance)',
  'Monday Travel to Site (Long Distance)',
  'Client-Approved Early Finish',
  'Weather — unsafe conditions',
  'Doctor/Dentist Appointment',
  'Illness / Feeling Unwell',
  'Family Emergency',
  'Vehicle Breakdown',
  'Other',
];

// Reasons that trigger manager approval workflow
const APPROVAL_REASONS = new Set([
  'Friday Travel Home (Long Distance)',
  'Monday Travel to Site (Long Distance)',
  'Client-Approved Early Finish',
]);

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Lets staff leave site before the end of the shift with a reason. The reason
// and optional note are saved to the assignment and surfaced to managers on
// the timesheet approval view. The departure time auto-populates with the
// current time when the modal opens.
export default function EarlyLeaveModal({ open, onClose, onConfirm, jobName, defaultTime }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [note, setNote] = useState('');
  const [leaveTime, setLeaveTime] = useState('');
  const [travelHours, setTravelHours] = useState('');
  const [saving, setSaving] = useState(false);

  const isTravelReason = reason === 'Friday Travel Home (Long Distance)';
  const travelMinutes = isTravelReason && travelHours ? Math.round(parseFloat(travelHours) * 60) : 0;

  // Auto-populate the time when the modal opens
  useEffect(() => {
    if (open) setLeaveTime(defaultTime || nowHHMM());
  }, [open, defaultTime]);

  const isOther = reason === 'Other';
  const finalReason = isOther ? customReason.trim() : reason;
  const canConfirm = reason && (!isOther || customReason.trim()) && !saving && leaveTime;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    await onConfirm({ reason: finalReason, note: note.trim() || null, leave_time: leaveTime, travel_minutes: travelMinutes || null });
    setSaving(false);
    setReason(''); setCustomReason(''); setNote(''); setTravelHours('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center overflow-y-auto overscroll-contain p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                  <DoorOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Leaving Site</h2>
                  <p className="text-emerald-100 text-xs">{jobName || 'Record your reason'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">
                  Please record your reason for leaving site. This is saved on your timesheet for your manager to review.
                  {APPROVAL_REASONS.has(reason) && (
                    <span className="block mt-1.5 font-semibold text-amber-700">
                      ⚑ This reason will be sent to your manager for approval with their signature.
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Departure time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="time" value={leaveTime} onChange={e => setLeaveTime(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reason for leaving site</label>
                <div className="grid grid-cols-1 gap-2">
                  {DEFAULT_REASONS.map(r => {
                    const selected = reason === r;
                    return (
                      <button key={r} type="button" onClick={() => setReason(r)}
                        className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 text-left text-sm font-medium transition ${selected ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isOther && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Custom reason</label>
                  <input type="text" value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Describe the reason…"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
              )}

              {isTravelReason && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                  <label className="block text-xs font-semibold text-blue-700 uppercase mb-1.5 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5" /> Travel time home (hours)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="8"
                    value={travelHours}
                    onChange={e => setTravelHours(e.target.value)}
                    placeholder="e.g. 2 for 2 hours travel home"
                    className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                  />
                  <p className="text-[11px] text-blue-600 mt-1.5">This travel time is incorporated into your 9-hour day and shown on your timesheet as payable travel time.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Additional note (optional)
                </label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. appointment time, client contact who approved it, symptoms…"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none bg-white" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={onClose} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                {saving ? 'Saving…' : 'Confirm & Leave Site'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}