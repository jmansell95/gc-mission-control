import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, MapPin, Car, Clock, ChevronRight, X } from 'lucide-react';

/**
 * TrackingConsentCard — non-blocking consent prompt for the staff dashboard.
 *
 * Shows a dismissible card explaining GPS tracking and offering "Sign Now"
 * and "Later" buttons. If dismissed, a compact reminder banner takes its
 * place. If the user explicitly declines, tracking_enabled flips to false.
 *
 * Props:
 *   staff         — the staff profile object
 *   onSignNow     — opens the TrackingConsentModal
 *   onDecline     — explicitly declines tracking (sets tracking_enabled=false)
 *   onDismiss     — hides the card (non-blocking, reminder banner appears)
 */
export default function TrackingConsentCard({ staff, onSignNow, onDecline, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show if consent already signed or tracking disabled
  if (!staff || staff.is_admin || staff.no_staff_profile) return null;
  if (staff.tracking_consent_signed_at) return null;
  if (staff.tracking_enabled === false) return null;
  if (dismissed) {
    // Compact reminder banner after dismissal
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2.5"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
        </div>
        <p className="text-xs text-amber-800 font-medium flex-1 min-w-0">
          Please sign the GPS tracking consent form to keep tracking active.
        </p>
        <button onClick={onSignNow}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
          Sign <ChevronRight className="w-3 h-3" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[#2E5A1A]/15 shadow-sm overflow-hidden"
    >
      {/* Brand header strip */}
      <div className="hero-gradient px-4 py-3 text-white flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">GPS Tracking Consent</p>
          <p className="text-white/70 text-[11px]">Required to keep tracking active</p>
        </div>
        <button onClick={() => { setDismissed(true); onDismiss?.(); }}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition touch-manipulation flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Your location is tracked during working hours for accurate travel time and
          automated timesheets. Please sign the consent form to keep this feature active.
        </p>

        {/* What we track — compact icons */}
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col items-center gap-1 bg-blue-50 rounded-xl py-2.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            <p className="text-[10px] font-semibold text-slate-600 text-center leading-tight">Home → Site</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 bg-amber-50 rounded-xl py-2.5">
            <Car className="w-4 h-4 text-amber-600" />
            <p className="text-[10px] font-semibold text-slate-600 text-center leading-tight">Site → Site</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 bg-emerald-50 rounded-xl py-2.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <p className="text-[10px] font-semibold text-slate-600 text-center leading-tight">Site → Home</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold active:scale-95 transition touch-manipulation">
            Later
          </button>
          <button onClick={onSignNow}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold active:scale-95 transition touch-manipulation hover:bg-[#1c4a12]">
            <ShieldCheck className="w-4 h-4" />
            Sign Now
          </button>
        </div>
        <button onClick={onDecline}
          className="w-full text-center py-1 text-[11px] font-medium text-slate-400 hover:text-red-500 transition touch-manipulation">
          I don't consent — turn off tracking
        </button>
      </div>
    </motion.div>
  );
}