import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { detectDeviceType } from '@/utils/deviceDetect';

/**
 * useStaffTracking — captures the crew member's phone GPS during an active
 * shift and streams batched points to the recordStaffLocation backend
 * function. Maximised for maximum freshness within web geolocation limits.
 *
 * Active only when ALL of:
 *   - staff.tracking_enabled === true
 *   - staff.tracking_consent_signed_at is set
 *   - an active RotaAssignment exists for today
 *
 * MAXIMUM FRESHNESS SETTINGS:
 *   - 30s flush while moving, 120s while stationary
 *   - 10m distance filter while moving
 *   - 3 min no-fix → gap detection (logs gap_start/gap_end markers)
 *   - Persistent wake lock re-acquired on visibilitychange AND focus
 *   - Auto-restart when geolocation permission transitions denied→granted
 *   - Session ID groups consecutive fixes; resume event on app reopen
 *
 * Returns:
 *   - isTracking: boolean — watch is active (but may not have a fix yet)
 *   - hasFix: boolean — at least one real GPS fix has been received
 *   - lastPoint: { lat, lng, accuracy, timestamp } | null
 *   - pointsQueued: number
 *   - error: string | null
 *   - errorType: 'permission_denied' | 'position_unavailable' | 'permanently_denied' | 'no_fix_timeout' | null
 *   - sessionId: string | null — current tracking session ID
 */
const MOVING_FLUSH_MS = 30_000;    // 30s while moving (maximum freshness)
const STATIONARY_FLUSH_MS = 120_000; // 2 min while stationary
const MIN_DISTANCE_M = 10;           // 10m distance filter while moving
const NO_FIX_TIMEOUT_MS = 180_000;   // 3 min with no fix → gap detection
const GAP_THRESHOLD_MS = 180_000;    // 3 min gap → log gap_start
const TICK_MS = 15_000;              // check every 15s, flush adaptively
const MAX_BATCH = 200;               // max points to keep in memory on flush failure

const RECORD_URL = (typeof window !== 'undefined' ? window.location.origin : 'https://gc-mission-control.base44.app') + '/functions/recordStaffLocation';

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

function generateSessionId() {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// Detect if running inside a Capacitor native wrapper with the
// background-geolocation plugin installed. Returns the plugin module or null.
async function loadBackgroundPlugin() {
  try {
    if (typeof window === 'undefined' || !window.Capacitor?.isNative) return null;
    const dynamicImport = new Function('s', 'return import(s)');
    const mod = await dynamicImport('@transistorsoft/capacitor-background-geolocation');
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
  const [sessionId, setSessionId] = useState(null);

  const watchId = useRef(null);
  const batchRef = useRef([]);
  const lastSentRef = useRef(null);
  const flushTimer = useRef(null);
  const wakeLockRef = useRef(null);
  const noFixTimer = useRef(null);
  const gapTimer = useRef(null);
  const hasFixRef = useRef(false);
  const errorLoggedRef = useRef(false);
  const bgPluginRef = useRef(null);
  const sessionIdRef = useRef(null);
  const deviceTypeRef = useRef('phone');
  const staffNameRef = useRef(null);
  const lastFixTimeRef = useRef(null);
  const lastFlushTimeRef = useRef(0);
  const isMovingRef = useRef(false);
  const gapLoggedRef = useRef(false);
  const lastKnownPosRef = useRef(null);
  const permissionListenerRef = useRef(null);

  const consentGranted = !!staff?.tracking_enabled && !!staff?.tracking_consent_signed_at;
  const hasAssignment = !!activeAssignment?.id;
  const shouldTrack = enabled && consentGranted && hasAssignment;

  // Keep staff name + device type in refs so they don't tear down the GPS watch
  useEffect(() => { staffNameRef.current = staff?.name || ''; }, [staff?.name]);
  useEffect(() => { deviceTypeRef.current = detectDeviceType(); }, []);

  // Log a capture error to the backend so managers see "consented but no GPS"
  const logCaptureError = useCallback(async (type) => {
    if (errorLoggedRef.current) return;
    errorLoggedRef.current = true;
    try {
      await base44.functions.invoke('recordStaffLocation', {
        assignment_id: activeAssignment?.id,
        staff_name: staffNameRef.current,
        device_type: deviceTypeRef.current,
        error: type,
        points: [],
      });
    } catch {
      // non-fatal — the error is still shown locally to the crew member
    }
  }, [activeAssignment?.id]);

  // Flush the batched points to the backend
  const flushBatch = useCallback(async () => {
    const batch = batchRef.current;
    if (batch.length === 0) return;
    batchRef.current = [];
    setPointsQueued(0);
    lastFlushTimeRef.current = Date.now();
    try {
      await base44.functions.invoke('recordStaffLocation', {
        assignment_id: activeAssignment?.id,
        staff_name: staffNameRef.current,
        device_type: deviceTypeRef.current,
        session_id: sessionIdRef.current,
        points: batch,
      });
    } catch (err) {
      // On failure, re-queue the points so they're not lost (capped at MAX_BATCH)
      batchRef.current = [...batch, ...batchRef.current].slice(0, MAX_BATCH);
      setPointsQueued(batchRef.current.length);
    }
  }, [activeAssignment?.id]);

  // Log a session event (gap_start, gap_end, resume, session_start, session_end)
  const logSessionEvent = useCallback((event, posOverride = null) => {
    const pos = posOverride || lastKnownPosRef.current;
    if (!pos) return; // need a position for the log entry
    // Queue the session event into the batch instead of making an individual
    // API call — reduces network requests and ensures events are ordered
    // correctly relative to fix points in the same flush.
    batchRef.current.push({
      lat: pos.lat,
      lng: pos.lng,
      accuracy_m: pos.accuracy_m ?? null,
      speed_mps: null,
      heading: null,
      recorded_at: new Date().toISOString(),
      is_moving: false,
      session_event: event,
    });
    setPointsQueued(batchRef.current.length);
    // Trigger immediate flush so the event is sent right away (not waiting
    // for the next timer tick — gap markers need to appear on the map ASAP)
    flushBatch();
  }, [flushBatch]);

  // Screen Wake Lock — keeps the GPS watch alive while the crew member is
  // on shift so screen-sleep doesn't suspend the geolocation watch.
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    // Don't re-acquire if we already hold one
    if (wakeLockRef.current) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      // Release handler — wake locks are auto-released on visibility change
      if (wakeLockRef.current) {
        wakeLockRef.current.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch { /* visibility/permission — non-fatal */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch { /* */ }
      wakeLockRef.current = null;
    }
  }, []);

  // Re-acquire wake lock when the page becomes visible again OR on focus.
  // Wake locks are auto-released when the tab is hidden, so we must grab
  // a new one every time the crew returns to the app.
  useEffect(() => {
    if (!shouldTrack) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
        // Session resume — if we had a session and the app was backgrounded,
        // log a resume event so the trail reconnects on the map.
        if (sessionIdRef.current && hasFixRef.current) {
          logSessionEvent('resume');
        }
      }
    };
    const onFocus = () => {
      acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [shouldTrack, acquireWakeLock, logSessionEvent]);

  // Permission watcher — auto-restart tracking when the user grants location
  // permission after previously denying it (e.g. they fixed it in settings).
  useEffect(() => {
    if (!shouldTrack || !navigator.permissions?.query) return;
    let permStatus = null;
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      permStatus = status;
      const onChange = () => {
        if (permStatus.state === 'granted' && errorLoggedRef.current && !hasFixRef.current) {
          // Permission transitioned denied→granted — reset error state and
          // let the main effect re-acquire the watch on next render cycle
          errorLoggedRef.current = false;
          setError(null);
          setErrorType(null);
        }
      };
      permStatus.addEventListener('change', onChange);
      permissionListenerRef.current = { status: permStatus, onChange };
    }).catch(() => {});
    return () => {
      if (permissionListenerRef.current) {
        permissionListenerRef.current.status.removeEventListener('change', permissionListenerRef.current.onChange);
        permissionListenerRef.current = null;
      }
    };
  }, [shouldTrack]);

  // Set up the geolocation watch + adaptive batch flush
  useEffect(() => {
    if (!shouldTrack) {
      // Clean up any active tracking
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (flushTimer.current) { clearInterval(flushTimer.current); flushTimer.current = null; }
      if (noFixTimer.current) { clearTimeout(noFixTimer.current); noFixTimer.current = null; }
      if (gapTimer.current) { clearInterval(gapTimer.current); gapTimer.current = null; }
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
      setSessionId(null);
      hasFixRef.current = false;
      errorLoggedRef.current = false;
      gapLoggedRef.current = false;
      lastFixTimeRef.current = null;
      lastKnownPosRef.current = null;
      return;
    }

    let cancelled = false;
    // Start a new session
    sessionIdRef.current = generateSessionId();
    setSessionId(sessionIdRef.current);
    setIsTracking(true);
    setError(null);
    setErrorType(null);
    hasFixRef.current = false;
    errorLoggedRef.current = false;
    gapLoggedRef.current = false;
    lastFlushTimeRef.current = Date.now();
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
        const wasFirstFix = !hasFixRef.current;
        if (wasFirstFix) {
          hasFixRef.current = true;
          setHasFix(true);
          if (noFixTimer.current) { clearTimeout(noFixTimer.current); noFixTimer.current = null; }
          // Log session_start as the first event
          logSessionEvent('session_start', { lat: latitude, lng: longitude, accuracy_m: accuracy });
        }

        // Gap end detection — if we had a gap logged, now we have a fix again
        if (gapLoggedRef.current) {
          gapLoggedRef.current = false;
          logSessionEvent('gap_end', { lat: latitude, lng: longitude, accuracy_m: accuracy });
        }

        lastFixTimeRef.current = Date.now();
        const moving = (speed != null && speed > 1) || false;
        isMovingRef.current = moving;

        const point = {
          lat: latitude,
          lng: longitude,
          accuracy_m: accuracy,
          speed_mps: speed != null && !isNaN(speed) ? speed : null,
          heading: heading != null && !isNaN(heading) ? heading : null,
          recorded_at: new Date(pos.timestamp).toISOString(),
          is_moving: moving,
          session_event: 'fix',
        };
        setLastPoint(point);
        lastKnownPosRef.current = { lat: latitude, lng: longitude, accuracy_m: accuracy };

        // Distance filter — skip points too close to the last sent one
        // (only when stationary; moving points always pass through)
        if (lastSentRef.current) {
          const dist = haversineMetres(
            lastSentRef.current.lat, lastSentRef.current.lng,
            latitude, longitude,
          );
          if (dist < MIN_DISTANCE_M && !moving) return; // stationary, skip
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
        maximumAge: 5000,
        timeout: 15000,
      });

      // No-fix timeout — if we haven't got a fix after 3 min, log it
      noFixTimer.current = setTimeout(() => {
        if (!hasFixRef.current) {
          setErrorType('no_fix_timeout');
          setError('Waiting for GPS… no fix received yet.');
          logCaptureError('no_fix_timeout');
        }
      }, NO_FIX_TIMEOUT_MS);

      // Gap detection timer — checks every 15s if we've lost fix for >3 min.
      // If so, logs a gap_start event so managers see coverage holes on the map.
      gapTimer.current = setInterval(() => {
        if (!hasFixRef.current || !lastFixTimeRef.current) return;
        const sinceFix = Date.now() - lastFixTimeRef.current;
        if (sinceFix > GAP_THRESHOLD_MS && !gapLoggedRef.current) {
          gapLoggedRef.current = true;
          logSessionEvent('gap_start');
        }
      }, TICK_MS);

      // Adaptive flush timer — checks every 15s but only flushes when the
      // appropriate interval has elapsed based on moving state.
      flushTimer.current = setInterval(() => {
        const interval = isMovingRef.current ? MOVING_FLUSH_MS : STATIONARY_FLUSH_MS;
        if (Date.now() - lastFlushTimeRef.current >= interval) {
          flushBatch();
        }
      }, TICK_MS);
    };

    // Try the Capacitor background-geolocation plugin first (native build
    // only). Falls back to web geolocation when the plugin isn't installed.
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
              session_id: sessionIdRef.current || '',
            },
            desiredAccuracy: plugin.DESIRED_ACCURACY_HIGH,
            stationaryRadius: 10,
            distanceFilter: 10,
            notificationTitle: 'GC Mission Control',
            notificationText: 'Location tracking active',
            startOnBoot: true,
            stopOnTerminate: false,
            debug: false,
            logLevel: plugin.LOG_LEVEL_OFF,
            autoSync: true,
            autoSyncThreshold: 5,
            batchSync: true,
            maxBatchSize: 50,
          });
          await plugin.start();
          hasFixRef.current = true;
          setHasFix(true);
        } catch (e) {
          bgPluginRef.current = null;
          startWebGeolocation();
        }
      } else {
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
      if (gapTimer.current) { clearInterval(gapTimer.current); gapTimer.current = null; }
      releaseWakeLock();
      if (batchRef.current.length > 0) flushBatch();
      if (bgPluginRef.current) {
        bgPluginRef.current.stop().catch(() => {});
        bgPluginRef.current = null;
      }
      setIsTracking(false);
      setHasFix(false);
      setSessionId(null);
      hasFixRef.current = false;
    };
  }, [shouldTrack, flushBatch, acquireWakeLock, releaseWakeLock, logCaptureError, logSessionEvent, activeAssignment?.id]);

  return { isTracking, hasFix, lastPoint, pointsQueued, error, errorType, sessionId };
}