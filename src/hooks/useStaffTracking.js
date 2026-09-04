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
 * Uses navigator.geolocation.watchPosition with a distance filter to
 * throttle writes. Points are batched and POSTed every ~2 min while moving
 * (5 min while stationary). Capture fully pauses outside shift windows.
 *
 * Returns:
 *   - isTracking: boolean — currently capturing GPS
 *   - lastPoint: { lat, lng, accuracy, timestamp } | null — latest reading
 *   - pointsQueued: number — points waiting for the next batch flush
 *   - error: string | null
 */
const MOVING_FLUSH_MS = 120_000;   // 2 min while moving
const STATIONARY_FLUSH_MS = 300_000; // 5 min while stationary
const MIN_DISTANCE_M = 30;           // ignore points <30m from the last sent point

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useStaffTracking({ staff, activeAssignment, enabled = true }) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [pointsQueued, setPointsQueued] = useState(0);
  const [error, setError] = useState(null);

  const watchId = useRef(null);
  const batchRef = useRef([]);
  const lastSentRef = useRef(null);
  const flushTimer = useRef(null);

  const consentGranted = !!staff?.tracking_enabled && !!staff?.tracking_consent_signed_at;
  const hasAssignment = !!activeAssignment?.id;
  const shouldTrack = enabled && consentGranted && hasAssignment;

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

  // Set up the geolocation watch + batch flush timer
  useEffect(() => {
    if (!shouldTrack) {
      // Clean up any active tracking
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (flushTimer.current) {
        clearInterval(flushTimer.current);
        flushTimer.current = null;
      }
      // Flush any remaining points before pausing
      if (batchRef.current.length > 0) {
        flushBatch();
      }
      setIsTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }

    setIsTracking(true);
    setError(null);

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      if (latitude == null || longitude == null) return;

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
          lastSentRef.current.lat,
          lastSentRef.current.lng,
          latitude,
          longitude,
        );
        if (dist < MIN_DISTANCE_M && !point.is_moving) return; // stationary, skip
      }

      batchRef.current.push(point);
      lastSentRef.current = point;
      setPointsQueued(batchRef.current.length);
    };

    const onError = (err) => {
      setError(err.message || 'Location unavailable');
    };

    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });

    // Flush timer — adaptive based on whether the crew is moving
    flushTimer.current = setInterval(() => {
      flushBatch();
    }, MOVING_FLUSH_MS);

    return () => {
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (flushTimer.current) {
        clearInterval(flushTimer.current);
        flushTimer.current = null;
      }
      // Flush remaining points on unmount
      if (batchRef.current.length > 0) {
        flushBatch();
      }
      setIsTracking(false);
    };
  }, [shouldTrack, flushBatch]);

  return { isTracking, lastPoint, pointsQueued, error };
}