import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGeolocation } from '@/hooks/useGeolocation';
import useEffectiveSettings from '@/hooks/useEffectiveSettings';

/**
 * useGeofenceDetection — real-time geofence detection for a job site.
 *
 * Combines:
 *   1. The crew member's phone GPS (browser Geolocation API)
 *   2. The tracked vehicle's Geotab GPS location (VehicleLocationLog)
 *
 * Detects:
 *   - arrival: phone OR vehicle enters the job's geofence radius
 *   - departure: phone AND vehicle have both exited the geofence radius
 *
 * Returns:
 *   - onSite: boolean — currently within geofence (phone or vehicle)
 *   - arrivalTime: string|null — HH:MM of first detected arrival
 *   - departureTime: string|null — HH:MM of last detected departure
 *   - source: 'phone'|'vehicle'|'both'|null — which source triggered the latest event
 *   - phoneOnSite: boolean
 *   - vehicleOnSite: boolean
 *   - vehicleData: latest VehicleLocationLog entry for the assigned vehicle
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toHHMM(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useGeofenceDetection({ job, vehicleId, staffId, enabled = true }) {
  const [arrivalTime, setArrivalTime] = useState(null);
  const [departureTime, setDepartureTime] = useState(null);
  const [source, setSource] = useState(null);
  const [wasOnSite, setWasOnSite] = useState(false);
  const arrivalRef = useRef(null);
  const { get: getEffectiveSetting } = useEffectiveSettings();

  const siteLat = job?.site_lat;
  const siteLng = job?.site_lng;
  const defaultRadius = getEffectiveSetting('geofence_default_radius_m') ?? 250;
  const radius = job?.geofence_radius_override || defaultRadius;

  // Phone GPS — watch position
  const { position: phonePos } = useGeolocation({
    watch: true,
    enabled: enabled && !!siteLat && !!siteLng,
  });

  // Vehicle GPS — poll latest VehicleLocationLog for the assigned vehicle
  const { data: vehicleLogs = [] } = useQuery({
    queryKey: ['vehicle-location-latest', vehicleId],
    queryFn: () => base44.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', 5),
    enabled: !!vehicleId && enabled,
    refetchInterval: 30000, // poll every 30s for near-real-time
  });

  const latestVehicleLog = vehicleLogs[0];
  const vehiclePos = latestVehicleLog ? { lat: latestVehicleLog.latitude, lng: latestVehicleLog.longitude, timestamp: latestVehicleLog.timestamp } : null;

  // Calculate on-site status from both sources
  const phoneOnSite = phonePos && siteLat && siteLng
    ? haversineMetres(phonePos.lat, phonePos.lng, siteLat, siteLng) < radius
    : false;

  const vehicleOnSite = vehiclePos && siteLat && siteLng
    ? haversineMetres(vehiclePos.lat, vehiclePos.lng, siteLat, siteLng) < radius
    : false;

  const onSite = phoneOnSite || vehicleOnSite;

  // Detect arrival and departure transitions
  useEffect(() => {
    if (!enabled || (!siteLat && !siteLng)) return;

    if (onSite && !wasOnSite) {
      // Arrival detected
      const now = new Date();
      const time = toHHMM(now);
      if (!arrivalRef.current) {
        arrivalRef.current = time;
        setArrivalTime(time);
        setSource(phoneOnSite && vehicleOnSite ? 'both' : phoneOnSite ? 'phone' : 'vehicle');
      }
    } else if (!onSite && wasOnSite) {
      // Departure detected
      const now = new Date();
      setDepartureTime(toHHMM(now));
      setSource(phoneOnSite ? 'phone' : 'vehicle');
    }
    setWasOnSite(onSite);
  }, [onSite, wasOnSite, enabled, siteLat, siteLng, phoneOnSite, vehicleOnSite]);

  return {
    onSite,
    arrivalTime,
    departureTime,
    source,
    phoneOnSite,
    vehicleOnSite,
    phonePos,
    vehiclePos,
    radius,
  };
}