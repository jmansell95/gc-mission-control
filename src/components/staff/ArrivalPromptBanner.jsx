import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, CheckCircle2, AlertTriangle, Car, Home, Clock } from 'lucide-react';
import { useArrivalGeofence } from '@/hooks/useArrivalGeofence';

/**
 * ArrivalPromptBanner — zero-touch arrival/departure prompts.
 *
 * Shows contextual banners based on the crew member's geofence status:
 *   - "Not arrived yet" — past shift start, not on site, shows distance countdown
 *   - "Arrived" — green full-screen flash when geofence entry detected
 *   - "Left site" — toast when geofence exit detected after work
 *   - "Arrive home" — prompt 2h after leaving site
 *
 * Auto-stamps arrived_on_site_at / left_site_at on the RotaAssignment.
 */
export default function ArrivalPromptBanner({ assignment, job, staffId, homeLat, homeLng, shiftStartTime, allJobs = [], hotelLat = null, hotelLng = null, depotLat = null, depotLng = null, trackingEnabled = true }) {
  const [showArrivedFlash, setShowArrivedFlash] = useState(false);
  const [showLeftToast, setShowLeftToast] = useState(false);
  const [showArriveHome, setShowArriveHome] = useState(false);
  const [homeConfirmed, setHomeConfirmed] = useState(false);
  const [prevArrived, setPrevArrived] = useState(!!assignment?.arrived_on_site_at);

  const geofence = useArrivalGeofence({
    assignment,
    job,
    staffId,
    homeLat,
    homeLng,
    allJobs,
    hotelLat,
    hotelLng,
    depotLat,
    depotLng,
    enabled: !!assignment && !!job,
    trackingEnabled,
  });

  const { distance, onSite, arrived, leftSite, radius, hasGPS, gpsError, arrivedHome, showHomeConfirmPrompt, confirmHome, confirmingHome } = geofence;

  // Flash "Arrived" when arrival is first detected
  useEffect(() => {
    if (arrived && !prevArrived) {
      setShowArrivedFlash(true);
      const t = setTimeout(() => setShowArrivedFlash(false), 4000);
      return () => clearTimeout(t);
    }
    setPrevArrived(arrived);
  }, [arrived, prevArrived]);

  // Show "Left site" toast when departure detected
  useEffect(() => {
    if (leftSite && arrived) {
      setShowLeftToast(true);
      const t = setTimeout(() => setShowLeftToast(false), 5000);
      return () => clearTimeout(t);
    }
  }, [leftSite, arrived]);

  // "Arrive home" fallback prompt 2 hours after leaving site (only if GPS
  // home detection hasn't already triggered)
  useEffect(() => {
    if (!leftSite || !assignment?.left_site_at || arrivedHome || showHomeConfirmPrompt) return;
    const leftAt = new Date(assignment.left_site_at).getTime();
    const twoHoursLater = leftAt + 2 * 60 * 60 * 1000;
    const now = Date.now();
    const delay = Math.max(0, twoHoursLater - now);

    const t = setTimeout(() => setShowArriveHome(true), delay);
    return () => clearTimeout(t);
  }, [leftSite, assignment?.left_site_at, arrivedHome, showHomeConfirmPrompt]);

  // Don't render anything if no active assignment or job
  if (!assignment || !job) return null;

  const shiftStart = shiftStartTime || assignment.start_time || '08:00';
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isPastStart = currentHHMM >= shiftStart;

  // GPS not available
  if (gpsError && !hasGPS) {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="font-bold text-amber-900 text-sm">Location access needed</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Turn on location services to auto-track your arrival and build your timesheet automatically.
          </p>
        </div>
      </div>
    );
  }

  // Auto-detected arrival home (learned geofence) — green confirmation
  if (leftSite && arrivedHome && !homeConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-emerald-900 text-sm">You're home!</p>
          <p className="text-xs text-emerald-700 mt-0.5">Travel-home time auto-recorded. Your timesheet will be built automatically.</p>
          <button
            onClick={() => setHomeConfirmed(true)}
            className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold active:scale-95 transition"
          >
            Got it
          </button>
        </div>
      </motion.div>
    );
  }

  // GPS-based "Confirm you're home" prompt (no learned home yet)
  if (leftSite && showHomeConfirmPrompt && !homeConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Home className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-blue-900 text-sm">Are you home?</p>
          <p className="text-xs text-blue-700 mt-0.5">Confirm so we can learn your home location for automatic travel-time tracking.</p>
          <button
            onClick={async () => {
              const res = await confirmHome();
              if (res?.success) {
                setHomeConfirmed(true);
                if (res.is_confirmed) {
                  // Home confirmed — show success state
                }
              }
            }}
            disabled={confirmingHome}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold active:scale-95 transition disabled:opacity-50"
          >
            {confirmingHome ? 'Confirming…' : "Yes, I'm home"}
          </button>
        </div>
      </motion.div>
    );
  }

  // Fallback: 2h timer prompt (no GPS available)
  if (leftSite && showArriveHome) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Home className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-blue-900 text-sm">Did you arrive home safely?</p>
          <p className="text-xs text-blue-700 mt-0.5">Confirm to complete your travel-home time.</p>
          <button
            onClick={() => setShowArriveHome(false)}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold active:scale-95 transition"
          >
            Yes, I'm home
          </button>
        </div>
      </motion.div>
    );
  }

  if (leftSite && !showArriveHome && !arrivedHome && !showHomeConfirmPrompt) return null;
  if (arrived) return null; // Arrived, working — no banner needed

  // "Not arrived yet" — past shift start, not on site
  if (isPastStart && !onSite && distance != null) {
    const isClose = distance <= radius * 2;
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-4 ${isClose ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isClose ? 'bg-emerald-100' : 'bg-orange-100'}`}>
            <Navigation className={`w-5 h-5 ${isClose ? 'text-emerald-600' : 'text-orange-600'}`} />
          </div>
          <div className="flex-1">
            <p className={`font-bold text-sm ${isClose ? 'text-emerald-900' : 'text-orange-900'}`}>
              {isClose ? 'Almost there!' : "You haven't arrived yet"}
            </p>
            <p className={`text-xs mt-0.5 ${isClose ? 'text-emerald-700' : 'text-orange-700'}`}>
              {isClose
                ? `You're ${distance}m from ${job.name || 'site'} — get within ${radius}m to start.`
                : `Get within ${radius}m of ${job.name || 'the site'} to start the job.`}
            </p>
            {distance != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isClose ? 'bg-emerald-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, Math.max(5, (1 - distance / (radius * 3)) * 100))}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums ${isClose ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {distance}m
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Waiting for GPS
  if (!hasGPS && isPastStart) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 animate-pulse">
          <MapPin className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-sm">Locating you…</p>
          <p className="text-xs text-slate-500 mt-0.5">Waiting for GPS to detect your arrival.</p>
        </div>
      </div>
    );
  }

  return null;
}