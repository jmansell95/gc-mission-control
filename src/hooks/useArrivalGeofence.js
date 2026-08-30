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
 * Returns live distance, on-site status, and arrival/departure state
 * so the UI can show "not arrived yet" / "arrived" / "left site" prompts.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useArrivalGeofence({ assignment, job, staffId, enabled = true }) {
  const queryClient = useQueryClient();
  const [distance, setDistance] = useState(null);
  const [arrived, setArrived] = useState(!!assignment?.arrived_on_site_at);
  const [leftSite, setLeftSite] = useState(!!assignment?.left_site_at);
  const stampedRef = useRef({ arrived: !!assignment?.arrived_on_site_at, left: !!assignment?.left_site_at });

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

  // Calculate distance from site
  useEffect(() => {
    if (!siteLat || !siteLng) { setDistance(null); return; }
    const pos = phonePos || vehiclePos;
    if (!pos) { setDistance(null); return; }
    const d = haversineMetres(pos.lat, pos.lng, siteLat, siteLng);
    setDistance(Math.round(d));
  }, [phonePos, vehiclePos, siteLat, siteLng]);

  const onSite = distance != null && distance <= radius;

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
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        left_site_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['my-today-assignments'] });
      if (navigator.vibrate) navigator.vibrate([200]);
    } catch (e) {
      stampedRef.current.left = false;
      setLeftSite(false);
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
  };
}