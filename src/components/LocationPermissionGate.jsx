import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Settings, X, Loader2, RefreshCw } from 'lucide-react';
import { useLocationPermission } from '@/hooks/useLocationPermission';

const SESSION_KEY = 'loc_perm_dismissed_session';

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/**
 * LocationPermissionGate — app-shell-level gate that checks geolocation
 * permission on every app open and shows a persistent enable-location
 * banner until the user grants it.
 *
 *   'prompt' state → brand-green banner with "Enable Location" button
 *                   that triggers the native browser permission dialog.
 *   'denied'  state → amber banner with platform-specific settings
 *                   instructions and a "Check again" button.
 *
 * Dismissible for the current session only (sessionStorage) — reappears
 * on the next app open. Never appears once permission is 'granted'.
 */
export default function LocationPermissionGate() {
  const { state, busy, requestPermission, recheck } = useLocationPermission();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (state === 'granted') {
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    }
  }, [state]);

  if (state === 'granted' || state === 'checking' || state === 'unsupported') return null;
  if (dismissed) return null;

  const isDenied = state === 'denied';
  const platform = detectPlatform();

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
  };

  const handleAction = () => {
    if (isDenied) recheck();
    else requestPermission();
  };

  const settingsInstructions = platform === 'ios'
    ? 'Settings → Privacy & Security → Location Services → [Safari / home-screen app] → While Using'
    : platform === 'android'
    ? 'Settings → Location → App permissions → [Chrome / browser] → Allow'
    : 'Enable location access for this site in your browser settings.';

  const actionLabel = isDenied ? "I've enabled it" : 'Enable Location';
  const ActionIcon = busy ? Loader2 : (isDenied ? RefreshCw : MapPin);

  return (
    <AnimatePresence>
      {/* Desktop — top banner */}
      <motion.div
        key="desktop"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className={`hidden sm:flex fixed top-0 left-0 right-0 z-40 items-center gap-3 px-4 py-2.5 shadow-lg ${
          isDenied ? 'bg-amber-50/95 backdrop-blur-md border-b border-amber-200' : 'bg-[#2E5A1A]/95 backdrop-blur-md border-b border-[#1c4a12]'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDenied ? 'bg-amber-100' : 'bg-white/15'}`}>
          {isDenied ? <Settings className="w-4 h-4 text-amber-600" /> : <MapPin className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold leading-tight ${isDenied ? 'text-amber-900' : 'text-white'}`}>
            {isDenied ? 'Location permission denied' : 'Enable location tracking'}
          </p>
          <p className={`text-xs leading-tight truncate ${isDenied ? 'text-amber-700' : 'text-white/80'}`}>
            {isDenied ? settingsInstructions : 'Required for GPS tracking during shifts and automated timesheets.'}
          </p>
        </div>
        <button
          onClick={handleAction}
          disabled={busy}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition touch-manipulation flex-shrink-0 disabled:opacity-60 ${
            isDenied ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-white text-[#2E5A1A] hover:bg-white/90'
          }`}
        >
          <ActionIcon className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {actionLabel}
        </button>
        <button
          onClick={handleDismiss}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition touch-manipulation flex-shrink-0 ${isDenied ? 'hover:bg-amber-100' : 'hover:bg-white/15'}`}
        >
          <X className={`w-4 h-4 ${isDenied ? 'text-amber-600' : 'text-white/80'}`} />
        </button>
      </motion.div>

      {/* Mobile — bottom sheet */}
      <motion.div
        key="mobile"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl shadow-2xl safe-area-bottom ${isDenied ? 'bg-amber-50' : 'bg-white'}`}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className={`w-10 h-1.5 rounded-full ${isDenied ? 'bg-amber-200' : 'bg-slate-200'}`} />
        </div>
        <div className="px-4 pb-4 pt-1 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDenied ? 'bg-amber-100' : 'bg-[#2E5A1A]/10'}`}>
            {isDenied ? <Settings className="w-5 h-5 text-amber-600" /> : <MapPin className="w-5 h-5 text-[#2E5A1A]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${isDenied ? 'text-amber-900' : 'text-slate-900'}`}>
              {isDenied ? 'Location permission denied' : 'Enable location tracking'}
            </p>
            <p className={`text-xs leading-snug mt-0.5 ${isDenied ? 'text-amber-700' : 'text-slate-500'}`}>
              {isDenied ? settingsInstructions : 'Required for GPS tracking during shifts and automated timesheets.'}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={handleAction}
                disabled={busy}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition touch-manipulation disabled:opacity-60 ${
                  isDenied ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-[#2E5A1A] text-white hover:bg-[#1c4a12]'
                }`}
              >
                <ActionIcon className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                {actionLabel}
              </button>
              <button
                onClick={handleDismiss}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition touch-manipulation flex-shrink-0 ${isDenied ? 'bg-amber-100 hover:bg-amber-200' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                <X className={`w-4 h-4 ${isDenied ? 'text-amber-600' : 'text-slate-500'}`} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}