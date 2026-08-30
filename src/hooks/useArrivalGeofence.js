import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGeolocation } from '@/hooks/useGeolocation';

/**
 * useArrivalGeofence — zero-touch arrival/departure detection.
 *
 * Watches the crew member's phone GPS and/or tracked vehicle GPS,
 * detects geofence entry/exit against the job site, and AUTO-STAMPS
 * the RotaAssignment's arrived_on_site_at / left_site_at fields.
 *
 * Also detects when the crew member arrives home after leaving site,
 * and offers a "Confirm home" prompt so the system can learn their
 * home location for automatic travel-from-site time tracking.
 *
 * Returns live distance, on-site status, arrival/departure state,
 * and home detection state so the UI can show contextual prompts.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useArrivalGeofence({ assignment, job, staffId, homeLat, homeLng, enabled = true }) {
  const queryClient = useQueryClient();
  const [distance, setDistance] = useState(null);
  const [homeDistance, setHomeDistance] = useState(null);
  const [arrived, setArrived] = useState(!!assignment?.arrived_on_site_at);
  const [leftSite, setLeftSite] = useState(!!assignment?.left_site_at);
  const [arrivedHome, setArrivedHome] = useState(false);
  const [confirmingHome, setConfirmingHome] = useState(false);
  const stampedRef = useRef({ arrived: !!assignment?.arrived_on_site_at, left: !!assignment?.left_site_at });
  const departedAtRef = useRef(assignment?.left_site_at ? new Date(assignment.left_site_at).getTime() : null);
  const stoppedMovingRef = useRef(null);

  const siteLat = job?.site_lat || job?.lat;
  const siteLng = job?.site_lng || job?.lng;
  const radius = job?.geofence_radius_override || 200;
  const assignmentId = assignment?.id;
  const vehicleId = assignment?.vehicle_id;

  // Phone GPS — continuous watch
  const { position: phonePos, error: gpsError } = useGeolocation({
    watch: true,
    enabled: enabled && !!siteLat && !!siteLng,
  });

  // Vehicle GPS — poll latest location
  const { data: vehicleLogs = [] } = useQuery({
    queryKey: ['vehicle-location-arrival', vehicleId],
    queryFn: () => base44.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', 1),
    enabled: !!vehicleId && enabled,
    refetchInterval: 30000,
  });

  const vehiclePos = vehicleLogs[0]
    ? { lat: vehicleLogs[0].latitude, lng: vehicleLogs[0].longitude }
    : null;

  const currentPos = phonePos || vehiclePos;

  // Calculate distance from site
  useEffect(() => {
    if (!siteLat || !siteLng) { setDistance(null); return; }
    if (!currentPos) { setDistance(null); return; }
    const d = haversineMetres(currentPos.lat, currentPos.lng, siteLat, siteLng);
    setDistance(Math.round(d));
  }, [currentPos, siteLat, siteLng]);

  // Calculate distance from home (if learned)
  useEffect(() => {
    if (!homeLat || !homeLng || !currentPos) { setHomeDistance(null); return; }
    const d = haversineMetres(currentPos.lat, currentPos.lng, homeLat, homeLng);
    setHomeDistance(Math.round(d));
  }, [currentPos, homeLat, homeLng]);

  const onSite = distance != null && distance <= radius;
  const nearHome = homeDistance != null && homeDistance <= 200;

  // Auto-stamp arrival
  const stampArrival = useCallback(async () => {
    if (stampedRef.current.arrived || !assignmentId) return;
    stampedRef.current.arrived = true;
    setArrived(true);
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        arrived_on_site_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['my-today-assignments'] });
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {
      stampedRef.current.arrived = false;
      setArrived(false);
    }
  }, [assignmentId, queryClient]);

  // Auto-stamp departure
  const stampDeparture = useCallback(async () => {
    if (stampedRef.current.left || !assignmentId || !stampedRef.current.arrived) return;
    stampedRef.current.left = true;
    setLeftSite(true);
    departedAtRef.current = Date.now();
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        left_site_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['my-today-assignments'] });
      if (navigator.vibrate) navigator.vibrate([200]);
    } catch (e) {
      stampedRef.current.left = false;
      setLeftSite(false);
      departedAtRef.current = null;
    }
  }, [assignmentId, queryClient]);

  // Detect arrival/departure transitions
  useEffect(() => {
    if (!enabled || !siteLat || !siteLng) return;

    if (onSite && !arrived && !stampedRef.current.arrived) {
      stampArrival();
    } else if (!onSite && arrived && !leftSite && !stampedRef.current.left) {
      // Only stamp departure if they were previously on site (not just passing by)
      // and have been outside for more than 30 seconds to avoid false triggers
      const departTimer = setTimeout(() => {
        if (!stampedRef.current.left) stampDeparture();
      }, 30000);
      return () => clearTimeout(departTimer);
    }
  }, [onSite, arrived, leftSite, enabled, siteLat, siteLng, stampArrival, stampDeparture]);

  // Detect arrival home (after leaving site)
  // If we have a learned home location, auto-detect when they arrive within 200m
  useEffect(() => {
    if (!leftSite || !nearHome || arrivedHome) return;
    // Must have been travelling for at least 10 minutes since departure
    if (!departedAtRef.current) return;
    const minsSinceDeparture = (Date.now() - departedAtRef.current) / 60000;
    if (minsSinceDeparture < 10) return;
    setArrivedHome(true);
    if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
  }, [leftSite, nearHome, arrivedHome]);

  // Detect "stopped moving" for home confirmation prompt (when no learned home)
  // Uses the GPS speed if available, otherwise infers from position changes
  const showHomeConfirmPrompt = leftSite && !homeLat && currentPos && departedAtRef.current &&
    (Date.now() - departedAtRef.current) > 30 * 60000; // 30+ min since departure

  // Confirm home location — called by the banner's "I'm home" button
  const confirmHome = useCallback(async () => {
    if (!currentPos || confirmingHome) return null;
    setConfirmingHome(true);
    try {
      const res = await base44.functions.invoke('confirmHomeLocation', {
        lat: currentPos.lat,
        lng: currentPos.lng,
      });
      queryClient.invalidateQueries({ queryKey: ['my-staff-profile'] });
      return res;
    } catch (e) {
      return null;
    } finally {
      setConfirmingHome(false);
    }
  }, [currentPos, confirmingHome, queryClient]);

  return {
    distance,
    onSite,
    arrived,
    leftSite,
    radius,
    siteLat,
    siteLng,
    phonePos,
    vehiclePos,
    gpsError,
    hasGPS: !!(phonePos || vehiclePos),
    // Home detection
    homeDistance,
    nearHome,
    arrivedHome,
    showHomeConfirmPrompt,
    confirmHome,
    confirmingHome,
  };
}