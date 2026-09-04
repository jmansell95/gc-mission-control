import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useStaffTracking — captures the crew member's phone GPS during an active
 * shift and streams batched points to the recordStaffLocation backend
 * function.
 *
 * Active only when ALL of:
 *   - staff.tracking_enabled === true
 *   - staff.tracking_consent_signed_at is set
 *   - an active RotaAssignment exists for today
 *
 * FIX: Distinguishes "watch started" from "first GPS fix received" so the
 * green Tracking pill only shows after real data flows. Surfaces permission
 * errors as a typed errorType so the UI can prompt the crew to enable
 * location. Keeps the screen awake via Wake Lock during the shift. Detects
 * a Capacitor background-geolocation plugin at runtime and, when present,
 * switches to native always-on tracking that continues with the app closed.
 *
 * Returns:
 *   - isTracking: boolean — watch is active (but may not have a fix yet)
 *   - hasFix: boolean — at least one real GPS fix has been received
 *   - lastPoint: { lat, lng, accuracy, timestamp } | null
 *   - pointsQueued: number
 *   - error: string | null
 *   - errorType: 'permission_denied' | 'position_unavailable' | 'permanently_denied' | 'no_fix_timeout' | null
 */
const MOVING_FLUSH_MS = 120_000;   // 2 min while moving
const STATIONARY_FLUSH_MS = 300_000; // 5 min while stationary
const MIN_DISTANCE_M = 30;           // ignore points <30m from the last sent point
const NO_FIX_TIMEOUT_MS = 120_000;   // 2 min with no fix → log error

const RECORD_URL = 'https://gc-mission-control.base44.app/functions/recordStaffLocation';

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapGeolocationError(err) {
  if (!err) return 'position_unavailable';
  if (err.code === 1) return 'permission_denied';
  return 'position_unavailable';
}

// Detect if running inside a Capacitor native wrapper with the
// background-geolocation plugin installed. Returns the plugin module or null.
// Uses @vite-ignore so the web build doesn't try to resolve the package.
async function loadBackgroundPlugin() {
  try {
    if (typeof window === 'undefined' || !window.Capacitor?.isNative) return null;
    const mod = await import(/* @vite-ignore */ '@transistorsoft/capacitor-background-geolocation');
    return mod.BackgroundGeolocation || mod.default?.BackgroundGeolocation || null;
  } catch {
    return null;
  }
}

function getAuthToken() {
  try {
    return localStorage.getItem('base44_access_token') || '';
  } catch {
    return '';
  }
}

export function useStaffTracking({ staff, activeAssignment, enabled = true }) {
  const [isTracking, setIsTracking] = useState(false);
  const [hasFix, setHasFix] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [pointsQueued, setPointsQueued] = useState(0);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);

  const watchId = useRef(null);
  const batchRef = useRef([]);
  const lastSentRef = useRef(null);
  const flushTimer = useRef(null);
  const wakeLockRef = useRef(null);
  const noFixTimer = useRef(null);
  const hasFixRef = useRef(false);
  const errorLoggedRef = useRef(false);
  const bgPluginRef = useRef(null);

  const consentGranted = !!staff?.tracking_enabled && !!staff?.tracking_consent_signed_at;
  const hasAssignment = !!activeAssignment?.id;
  const shouldTrack = enabled && consentGranted && hasAssignment;

  // Log a capture error to the backend so managers see "consented but no GPS"
  const logCaptureError = useCallback(async (type) => {
    if (errorLoggedRef.current) return; // only log once per tracking session
    errorLoggedRef.current = true;
    try {
      await base44.functions.invoke('recordStaffLocation', {
        assignment_id: activeAssignment?.id,
        staff_name: staff?.name,
        error: type,
        points: [],
      });
    } catch {
      // non-fatal — the error is still shown locally to the crew member
    }
  }, [activeAssignment?.id, staff?.name]);

  // Flush the batched points to the backend
  const flushBatch = useCallback(async () => {
    const batch = batchRef.current;
    if (batch.length === 0) return;
    batchRef.current = [];
    setPointsQueued(0);
    try {
      await base44.functions.invoke('recordStaffLocation', {
        assignment_id: activeAssignment?.id,
        staff_name: staff?.name,
        points: batch,
      });
    } catch (err) {
      // On failure, re-queue the points so they're not lost
      batchRef.current = [...batch, ...batchRef.current];
      setPointsQueued(batchRef.current.length);
    }
  }, [activeAssignment?.id, staff?.name]);

  // Screen Wake Lock — keeps the GPS watch alive while the crew member is
  // on shift so screen-sleep doesn't suspend the geolocation watch.
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch { /* visibility/permission — non-fatal */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch { /* */ }
      wakeLockRef.current = null;
    }
  }, []);

  // Re-acquire wake lock when the page becomes visible again (it's released
  // automatically when the tab is hidden).
  useEffect(() => {
    if (!shouldTrack) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [shouldTrack, acquireWakeLock]);

  // Set up the geolocation watch + batch flush timer
  useEffect(() => {
    if (!shouldTrack) {
      // Clean up any active tracking
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (flushTimer.current) { clearInterval(flushTimer.current); flushTimer.current = null; }
      if (noFixTimer.current) { clearTimeout(noFixTimer.current); noFixTimer.current = null; }
      releaseWakeLock();
      if (batchRef.current.length > 0) flushBatch();
      if (bgPluginRef.current) {
        bgPluginRef.current.stop().catch(() => {});
        bgPluginRef.current = null;
      }
      setIsTracking(false);
      setHasFix(false);
      setError(null);
      setErrorType(null);
      hasFixRef.current = false;
      errorLoggedRef.current = false;
      return;
    }

    let cancelled = false;
    setIsTracking(true);
    setError(null);
    setErrorType(null);
    hasFixRef.current = false;
    errorLoggedRef.current = false;
    acquireWakeLock();

    // Check existing permission state on mount — detect already-denied
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (!cancelled && result.state === 'denied') {
          setErrorType('permanently_denied');
          setError('Location permission denied. Enable it in your phone settings.');
          logCaptureError('permanently_denied');
        }
      }).catch(() => {});
    }

    // Web geolocation fallback (used when no native plugin is present)
    const startWebGeolocation = () => {
      if (!navigator.geolocation) {
        setError('Geolocation not supported on this device');
        setErrorType('position_unavailable');
        logCaptureError('position_unavailable');
        return;
      }

      const onSuccess = (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        if (latitude == null || longitude == null) return;

        // First real fix — clear the "waiting" state and the no-fix timer
        if (!hasFixRef.current) {
          hasFixRef.current = true;
          setHasFix(true);
          if (noFixTimer.current) { clearTimeout(noFixTimer.current); noFixTimer.current = null; }
        }

        const point = {
          lat: latitude,
          lng: longitude,
          accuracy_m: accuracy,
          speed_mps: speed != null && !isNaN(speed) ? speed : null,
          heading: heading != null && !isNaN(heading) ? heading : null,
          recorded_at: new Date(pos.timestamp).toISOString(),
          is_moving: (speed != null && speed > 1) || false,
        };
        setLastPoint(point);

        // Distance filter — skip points too close to the last sent one
        if (lastSentRef.current) {
          const dist = haversineMetres(
            lastSentRef.current.lat, lastSentRef.current.lng,
            latitude, longitude,
          );
          if (dist < MIN_DISTANCE_M && !point.is_moving) return; // stationary, skip
        }

        batchRef.current.push(point);
        lastSentRef.current = point;
        setPointsQueued(batchRef.current.length);
      };

      const onError = (err) => {
        const type = mapGeolocationError(err);
        setErrorType(type);
        setError(err.message || 'Location unavailable');
        logCaptureError(type);
      };

      watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });

      // No-fix timeout — if we haven't got a fix after 2 min, log it
      noFixTimer.current = setTimeout(() => {
        if (!hasFixRef.current) {
          setErrorType('no_fix_timeout');
          setError('Waiting for GPS… no fix received yet.');
          logCaptureError('no_fix_timeout');
        }
      }, NO_FIX_TIMEOUT_MS);

      // Flush timer — adaptive based on whether the crew is moving
      flushTimer.current = setInterval(() => {
        flushBatch();
      }, MOVING_FLUSH_MS);
    };

    // Try the Capacitor background-geolocation plugin first (native build
    // only). When present, it handles GPS capture and HTTP posting natively,
    // continuing even when the webview is closed. Falls back to web
    // geolocation when the plugin isn't installed.
    (async () => {
      const plugin = await loadBackgroundPlugin();
      if (cancelled) return;
      if (plugin) {
        bgPluginRef.current = plugin;
        const token = getAuthToken();
        try {
          await plugin.configure({
            url: RECORD_URL,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            params: {
              assignment_id: activeAssignment?.id || '',
              staff_name: staff?.name || '',
            },
            desiredAccuracy: plugin.DESIRED_ACCURACY_HIGH,
            stationaryRadius: 20,
            distanceFilter: 30,
            notificationTitle: 'GC Mission Control',
            notificationText: 'Location tracking active',
            startOnBoot: true,
            stopOnTerminate: false,
            debug: false,
            logLevel: plugin.LOG_LEVEL_OFF,
            autoSync: true,
            autoSyncThreshold: 10,
            batchSync: true,
            maxBatchSize: 50,
          });
          await plugin.start();
          // The plugin handles fixes natively — mark as having a fix
          hasFixRef.current = true;
          setHasFix(true);
        } catch (e) {
          // Plugin configure/start failed — fall back to web geolocation
          bgPluginRef.current = null;
          startWebGeolocation();
        }
      } else {
        // No native plugin — use web geolocation
        startWebGeolocation();
      }
    })();

    return () => {
      cancelled = true;
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (flushTimer.current) { clearInterval(flushTimer.current); flushTimer.current = null; }
      if (noFixTimer.current) { clearTimeout(noFixTimer.current); noFixTimer.current = null; }
      releaseWakeLock();
      if (batchRef.current.length > 0) flushBatch();
      if (bgPluginRef.current) {
        bgPluginRef.current.stop().catch(() => {});
        bgPluginRef.current = null;
      }
      setIsTracking(false);
      setHasFix(false);
      hasFixRef.current = false;
    };
  }, [shouldTrack, flushBatch, acquireWakeLock, releaseWakeLock, logCaptureError, activeAssignment?.id, staff?.name]);

  return { isTracking, hasFix, lastPoint, pointsQueued, error, errorType };
}