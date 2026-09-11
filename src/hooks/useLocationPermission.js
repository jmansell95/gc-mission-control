import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useLocationPermission — reads the browser geolocation permission state
 * on mount and exposes a trigger to request it.
 *
 * State values:
 *   'checking'    — initial read in progress
 *   'granted'     — OS/browser location permission granted
 *   'prompt'      — not yet asked (browser will show the native dialog)
 *   'denied'      — user or system denied (native dialog won't reappear)
 *   'unsupported' — permissions API + geolocation unavailable
 *
 * On grant/deny, persists the outcome to the Staff record
 * (last_capture_error / last_capture_error_at) so the Tracking Hub
 * reflects the live permission state.
 */
export function useLocationPermission() {
  const [state, setState] = useState('checking');
  const [busy, setBusy] = useState(false);
  const permStatusRef = useRef(null);
  const onChangeRef = useRef(null);

  const persistOutcome = useCallback(async (granted) => {
    try {
      await base44.functions.invoke('updateMyOnboarding', granted
        ? { last_capture_error: null, last_capture_error_at: null }
        : { last_capture_error: 'permission_denied', last_capture_error_at: new Date().toISOString() }
      );
    } catch { /* non-fatal */ }
  }, []);

  const check = useCallback(async () => {
    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (onChangeRef.current && permStatusRef.current) {
          permStatusRef.current.removeEventListener('change', onChangeRef.current);
        }
        permStatusRef.current = status;
        const onChange = () => setState(permStatusRef.current?.state || 'prompt');
        onChangeRef.current = onChange;
        status.addEventListener('change', onChange);
        setState(status.state);
        return status.state;
      } catch { /* fall through */ }
    }
    setState('unsupported');
    return 'unsupported';
  }, []);

  useEffect(() => {
    check();
    return () => {
      if (onChangeRef.current && permStatusRef.current) {
        permStatusRef.current.removeEventListener('change', onChangeRef.current);
      }
    };
  }, [check]);

  // Trigger the native browser permission dialog (must be called from a
  // user gesture — e.g. a button click — for the prompt to appear).
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setState('unsupported');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => { setState('granted'); setBusy(false); persistOutcome(true); },
      (err) => {
        if (err.code === 1) { setState('denied'); persistOutcome(false); }
        else { setState('prompt'); }
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [persistOutcome]);

  return { state, busy, requestPermission, recheck: check };
}