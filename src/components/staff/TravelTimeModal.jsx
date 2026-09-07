import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, Loader2 } from 'lucide-react';

/**
 * TravelTimeModal — lets field staff log long-distance travel time that
 * is incorporated into their 9-hour day.
 *
 *   Monday: travel FROM home TO site (after the weekend)
 *   Friday: travel FROM site/digs TO home (for the weekend)
 *
 * The logged minutes are saved to the RotaAssignment so they appear on
 * the timesheet as payable travel time within the 9-hour day.
 */
export default function TravelTimeModal({ open, onClose, onConfirm, dayType = 'monday', jobName }) {
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setHours('');
  }, [open]);

  const isMonday = dayType === 'monday';
  const minutes = hours ? Math.round(parseFloat(hours) * 60) : 0;
  const canConfirm = hours && parseFloat(hours) > 0 && !saving;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    await onConfirm({ minutes, dayType });
    setSaving(false);
    setHours('');
  };

  const label = isMonday ? 'Travel to Site (Monday)' : 'Travel Home (Friday)';
  const desc = isMonday
    ? 'Log your long-distance travel time from home to site after the weekend. This counts as part of your 9-hour day.'
    : 'Log your long-distance travel time from site/digs to home for the weekend. This counts as part of your 9-hour day.';

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
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{label}</h2>
                  <p className="text-emerald-100 text-xs">{jobName || 'Log your travel time'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">{desc}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Travel time (hours)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="8"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder="e.g. 2 for 2 hours"
                  className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white"
                />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {[1, 1.5, 2, 2.5, 3].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHours(String(h))}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {minutes > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
                  <p className="text-xs text-emerald-800">
                    <span className="font-bold">{minutes} minutes</span> of travel time will be added to your timesheet as part of your 9-hour day.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={onClose} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-[#2E5A1A] text-white rounded-xl hover:bg-[#244715] active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Log Travel Time'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}