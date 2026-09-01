import React, { useState } from 'react';
import { MapPin, ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

/**
 * TrackingSettings — location tracking toggle + consent sign button.
 *
 * Shown on the StaffProfile page in a privacy/settings section.
 * - Shows the current tracking_enabled state (on/off switch)
 * - If consent is unsigned, shows a "Sign Consent" button
 * - Toggling off sets tracking_enabled=false and stops GPS polling
 * - Toggling back on requires consent to be signed first
 *
 * Props:
 *   staff        — the staff profile object
 *   onSignConsent — opens the TrackingConsentModal
 */
export default function TrackingSettings({ staff, onSignConsent }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);

  if (!staff || staff.is_admin || staff.no_staff_profile) return null;

  const trackingEnabled = staff.tracking_enabled !== false; // default true
  const consentSigned = !!staff.tracking_consent_signed_at;

  const handleToggle = async () => {
    // If turning ON and consent not signed, redirect to sign consent
    if (!trackingEnabled && !consentSigned) {
      onSignConsent?.();
      return;
    }

    setToggling(true);
    try {
      await base44.functions.invoke('updateMyOnboarding', {
        tracking_enabled: !trackingEnabled,
      });
      queryClient.invalidateQueries({ queryKey: ['my-staff-profile'] });
      queryClient.invalidateQueries({ queryKey: ['staff', staff?.id] });
      toast({
        title: trackingEnabled ? 'Tracking turned off' : 'Tracking turned on',
        description: trackingEnabled
          ? 'GPS tracking is now paused. Turn it back on anytime.'
          : 'GPS tracking is now active during your shifts.',
      });
    } catch (e) {
      toast({ title: 'Could not update tracking', description: e.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-[#2E5A1A]" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">Location Tracking</h2>
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">
              GPS Tracking {trackingEnabled ? 'On' : 'Off'}
            </p>
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              trackingEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {trackingEnabled ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
              {trackingEnabled ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Tracks your location during shifts for travel time & timesheets.
            Turn off of an evening if you prefer.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          role="switch"
          aria-checked={trackingEnabled}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition flex-shrink-0 touch-manipulation disabled:opacity-50 ${
            trackingEnabled ? 'bg-[#2E5A1A]' : 'bg-slate-300'
          }`}
        >
          {toggling && <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin text-white/80" />}
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            trackingEnabled ? 'translate-x-6' : 'translate-x-1'
          } ${toggling ? 'opacity-0' : ''}`} />
        </button>
      </div>

      {/* Consent status */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {consentSigned ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Consent form signed</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-600 min-w-0">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Consent form not yet signed</span>
            </div>
            <button onClick={onSignConsent}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" /> Sign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}