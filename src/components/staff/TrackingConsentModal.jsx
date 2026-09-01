import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, MapPin, Car, Home, Clock, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import SignaturePad from '@/components/staff/SignaturePad';

const CONSENT_VERSION = 'v1_2026';

/**
 * TrackingConsentModal — first-time GPS tracking consent.
 *
 * Shows a clear privacy notice explaining exactly what is tracked (home→site
 * and site→home only, never personal travel), and requires a drawn signature
 * before zero-touch GPS tracking is activated.
 *
 * Stores the signature on the Staff entity (tracking_consent_signature_data_url,
 * tracking_consent_signed_at, tracking_consent_version) and sets phone_gps_consent
 * to true.
 */
export default function TrackingConsentModal({ open, onClose, onDecline, staff }) {
  const [signature, setSignature] = useState(null);
  const [saving, setSaving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const handleAccept = async () => {
    if (!signature) { setError('Please draw your signature to confirm consent.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.functions.invoke('updateMyOnboarding', {
        tracking_consent_signed_at: new Date().toISOString(),
        tracking_consent_signature_data_url: signature,
        tracking_consent_version: CONSENT_VERSION,
        tracking_consent_declined_at: null,
        phone_gps_consent: true,
        tracking_enabled: true,
      });
      queryClient.invalidateQueries({ queryKey: ['my-staff-profile'] });
      queryClient.invalidateQueries({ queryKey: ['staff', staff?.id] });
      setSaving(false);
      onClose();
    } catch (e) {
      setError('Could not save consent. Please try again.');
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError('');
    try {
      await base44.functions.invoke('updateMyOnboarding', {
        tracking_enabled: false,
        tracking_consent_declined_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['my-staff-profile'] });
      queryClient.invalidateQueries({ queryKey: ['staff', staff?.id] });
      setDeclining(false);
      onClose();
      if (onDecline) onDecline();
    } catch (e) {
      setError('Could not save your choice. Please try again.');
      setDeclining(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92dvh] overflow-y-auto flex flex-col"
          >
            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex items-center gap-3 flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">GPS Tracking Consent</h2>
                <p className="text-white/70 text-xs">Required for zero-touch timesheets</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* What we track */}
              <div className="bg-emerald-50/80 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> What we track
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Home className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Home → Site (morning)</p>
                      <p className="text-xs text-slate-500">Your travel time from home to the job site.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Car className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Site → Home (evening)</p>
                      <p className="text-xs text-slate-500">Your travel time from the job site back home.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Site → Site (inter-site)</p>
                      <p className="text-xs text-slate-500">Travel between different job sites during the day.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* What we DON'T track */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-slate-500" /> What we don't track
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 ml-1">
                  <li>• Personal travel (shops, pub, weekend, family)</li>
                  <li>• Your location outside working hours</li>
                  <li>• GPS turns off when you arrive home after your shift</li>
                  <li>• Mid-day home visits (lunch at home) are ignored</li>
                </ul>
              </div>

              {/* How it works */}
              <div className="flex items-start gap-2.5 text-xs text-slate-500">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p>GPS activates when you leave home for your shift and turns off when you return home. Tracking is windowed to save battery — no continuous draining.</p>
              </div>

              {/* Signature */}
              <div>
                <p className="text-sm font-bold text-slate-800 mb-1.5">
                  Sign to confirm consent
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  By signing below, I confirm that I understand my location is tracked during working hours for travel time and timesheet automation. I consent to this tracking as described above.
                </p>
                <SignaturePad onChange={setSignature} />
              </div>

              {error && (
                <p className="text-sm text-red-600 font-medium">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2.5 flex-shrink-0 safe-area-bottom">
              <button onClick={onClose} disabled={saving || declining}
                className="px-5 py-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold touch-manipulation">
                Not now
              </button>
              <button onClick={handleAccept} disabled={!signature || saving || declining}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-[#2E5A1A] text-white rounded-2xl hover:bg-[#1c4a12] active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {saving ? 'Saving…' : 'I Consent & Sign'}
              </button>
            </div>
            <button onClick={handleDecline} disabled={saving || declining}
              className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-red-500 transition touch-manipulation">
              {declining ? 'Saving…' : 'I don\'t consent — turn off tracking'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}