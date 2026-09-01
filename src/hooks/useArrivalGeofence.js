import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGeolocation } from '@/hooks/useGeolocation';

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * useArrivalGeofence — smart zero-touch travel tracking.
 *
 * TRACKS ONLY: home→site, site→home, site→site (inter-site).
 * NEVER tracks personal travel — GPS activates only during the working window.
 *
 * Smart GPS windowing:
 * - GPS turns ON when: shift start -1h, OR user leaves home geofence
 * - GPS turns OFF when: user arrives home geofence after shift end
 * - Reduces battery drain by not polling outside the working window
 *
 * Geofence detection:
 * - Site geofence: job site_lat/lng (current assignment + all today's jobs for inter-site)
 * - Home geofence: learned home_lat/lng (or hotel address for away jobs)
 * - Depot geofence: depot/yard location for depot staff
 *
 * First/last home only:
 * - Only the FIRST departure from home (morning) creates a travel_to entry
 * - Only the LAST arrival home (evening) creates a travel_from entry
 * - Mid-day home visits (lunch at home) are ignored
 *
 * Inter-site travel:
 * - When staff leave Site A and arrive at Site B, an inter_site_travel
 *   timesheet entry is auto-created (chargeable to client)
 */
export function useArrivalGeofence({
  assignment,
  job,
  staffId,
  homeLat,
  homeLng,
  allJobs = [],
  hotelLat = null,
  hotelLng = null,
  depotLat = null,
  depotLng = null,
  enabled = true,
  trackingEnabled = true,
}) {
  const queryClient = useQueryClient();
  const [distance, setDistance] = useState(null);
  const [homeDistance, setHomeDistance] = useState(null);
  const [arrived, setArrived] = useState(!!assignment?.arrived_on_site_at);
  const [leftSite, setLeftSite] = useState(!!assignment?.left_site_at);
  const [arrivedHome, setArrivedHome] = useState(false);
  const [confirmingHome, setConfirmingHome] = useState(false);
  const [gpsActive, setGpsActive] = useState(true);
  const [interSiteFrom, setInterSiteFrom] = useState(null); // {jobId, jobName, leftAt}
  const stampedRef = useRef({
    arrived: !!assignment?.arrived_on_site_at,
    left: !!assignment?.left_site_at,
    homeArrived: false,
    firstHomeDeparture: false,
  });
  const departedAtRef = useRef(assignment?.left_site_at ? new Date(assignment.left_site_at).getTime() : null);
  const lastPosRef = useRef(null);
  const lastMoveTimeRef = useRef(null);
  const interSiteStampedRef = useRef(new Set()); // dedupe inter-site entries

  const siteLat = job?.site_lat || job?.lat;
  const siteLng = job?.site_lng || job?.lng;
  const radius = job?.geofence_radius_override || 200;
  const assignmentId = assignment?.id;
  const vehicleId = assignment?.vehicle_id;

  // Effective home = learned home OR hotel (for away jobs)
  const effectiveHomeLat = hotelLat || homeLat;
  const effectiveHomeLng = hotelLng || homeLng;

  // Smart GPS windowing — only track during the working window
  // Turn on 1h before shift start, turn off when arrived home after shift
  const shiftStart = assignment?.start_time;
  const isWithinWindow = useCallback(() => {
    if (!shiftStart) return true; // no shift time = always track
    const now = new Date();
    const [sh, sm] = shiftStart.split(':').map(Number);
    const shiftStartToday = new Date(now);
    shiftStartToday.setHours(sh, sm, 0, 0);
    const windowStart = new Date(shiftStartToday.getTime() - 60 * 60 * 1000); // 1h before
    // Window stays open until arrived home or 2h after shift end (fallback)
    if (arrivedHome) return false;
    return now.getTime() >= windowStart.getTime();
  }, [shiftStart, arrivedHome]);

  const shouldTrack = enabled && trackingEnabled !== false && !!siteLat && !!siteLng && isWithinWindow();

  // Phone GPS — only watch during the working window
  const { position: phonePos, error: gpsError } = useGeolocation({
    watch: true,
    enabled: shouldTrack,
  });

  // Vehicle GPS — poll latest location (less frequent to save battery)
  const { data: vehicleLogs = [] } = useQuery({
    queryKey: ['vehicle-location-arrival', vehicleId],
    queryFn: () => base44.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', 1),
    enabled: !!vehicleId && shouldTrack,
    refetchInterval: 30000,
  });

  const vehiclePos = vehicleLogs[0]
    ? { lat: vehicleLogs[0].latitude, lng: vehicleLogs[0].longitude }
    : null;

  const currentPos = phonePos || vehiclePos;

  // Calculate distance from site
  useEffect(() => {
    if (!siteLat || !siteLng || !currentPos) { setDistance(null); return; }
    const d = haversineMetres(currentPos.lat, currentPos.lng, siteLat, siteLng);
    setDistance(Math.round(d));
  }, [currentPos?.lat, currentPos?.lng, siteLat, siteLng]);

  // Calculate distance from effective home (learned home or hotel)
  useEffect(() => {
    if (!effectiveHomeLat || !effectiveHomeLng || !currentPos) { setHomeDistance(null); return; }
    const d = haversineMetres(currentPos.lat, currentPos.lng, effectiveHomeLat, effectiveHomeLng);
    setHomeDistance(Math.round(d));
  }, [currentPos?.lat, currentPos?.lng, effectiveHomeLat, effectiveHomeLng]);

  const onSite = distance != null && distance <= radius;
  const nearHome = homeDistance != null && homeDistance <= 200;
  const nearDepot = depotLat && depotLng && currentPos
    ? haversineMetres(currentPos.lat, currentPos.lng, depotLat, depotLng) <= 200
    : false;

  // Auto-stamp arrival on site
  const stampArrival = useCallback(async () => {
    if (stampedRef.current.arrived || !assignmentId) return;
    stampedRef.current.arrived = true;
    setArrived(true);
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        arrived_on_site_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['my-today-assignments'] });
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {
      stampedRef.current.arrived = false;
      setArrived(false);
    }
  }, [assignmentId, queryClient]);

  // Auto-stamp departure from site
  const stampDeparture = useCallback(async () => {
    if (stampedRef.current.left || !assignmentId || !stampedRef.current.arrived) return;
    stampedRef.current.left = true;
    setLeftSite(true);
    departedAtRef.current = Date.now();
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        left_site_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      if (navigator.vibrate) navigator.vibrate([200]);
    } catch (e) {
      stampedRef.current.left = false;
      setLeftSite(false);
      departedAtRef.current = null;
    }
  }, [assignmentId, queryClient]);

  // Auto-stamp arrival home (only the LAST arrival — first/last home only)
  const stampArrivedHome = useCallback(async () => {
    if (stampedRef.current.homeArrived || !assignmentId) return;
    stampedRef.current.homeArrived = true;
    setArrivedHome(true);
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        arrived_home_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
    } catch (e) {
      stampedRef.current.homeArrived = false;
      setArrivedHome(false);
    }
  }, [assignmentId, queryClient]);

  // Detect arrival/departure transitions for the CURRENT site
  useEffect(() => {
    if (!shouldTrack || !siteLat || !siteLng) return;

    if (onSite && !arrived && !stampedRef.current.arrived) {
      stampArrival();
    } else if (!onSite && arrived && !leftSite && !stampedRef.current.left) {
      // Only stamp departure after 30s outside to avoid false triggers
      const departTimer = setTimeout(() => {
        if (!stampedRef.current.left) stampDeparture();
      }, 30000);
      return () => clearTimeout(departTimer);
    }
  }, [onSite, arrived, leftSite, shouldTrack, siteLat, siteLng, stampArrival, stampDeparture]);

  // Detect inter-site travel — when leaving current site, check if entering another job's geofence
  useEffect(() => {
    if (!shouldTrack || !leftSite || !currentPos || !allJobs.length) return;

    for (const otherJob of allJobs) {
      if (otherJob.id === job?.id) continue;
      const oLat = otherJob.site_lat || otherJob.lat;
      const oLng = otherJob.site_lng || otherJob.lng;
      if (!oLat || !oLng) continue;
      const d = haversineMetres(currentPos.lat, currentPos.lng, oLat, oLng);
      if (d <= (otherJob.geofence_radius_override || 200)) {
        // Arrived at another site — record inter-site travel
        const key = `${assignment?.id}_${otherJob.id}`;
        if (interSiteStampedRef.current.has(key)) return;
        interSiteStampedRef.current.add(key);
        setInterSiteFrom({ jobId: otherJob.id, jobName: otherJob.name, arrivedAt: new Date().toISOString() });

        // Auto-create inter-site travel timesheet entry
        if (assignment?.left_site_at && staffId) {
          const leftAt = new Date(assignment.left_site_at).getTime();
          const arrivedAt = Date.now();
          const travelMins = Math.round((arrivedAt - leftAt) / 60000);
          if (travelMins > 2) {
            base44.entities.Timesheet.create({
              staff_id: staffId,
              date: assignment.assigned_date,
              job_id: otherJob.id,
              task_description: `Inter-site travel: ${job?.name || ''} → ${otherJob.name || ''}`,
              task_type: 'inter_site_travel',
              task_duration_minutes: travelMins,
              total_hours: Math.round((travelMins / 60) * 100) / 100,
              status: 'draft',
              source: 'geotab_auto',
              chargeable: true,
            }).catch(() => {});
          }
        }
        return;
      }
    }
  }, [shouldTrack, leftSite, currentPos?.lat, currentPos?.lng, allJobs, job?.id, assignment?.id, staffId]);

  // Detect arrival home (after leaving site) — first/last home only
  // Only stamp the LAST arrival home (evening), ignore mid-day home visits
  useEffect(() => {
    if (!leftSite || !nearHome || arrivedHome) return;
    if (!departedAtRef.current) return;
    const minsSinceDeparture = (Date.now() - departedAtRef.current) / 60000;
    // Must have been travelling for at least 10 minutes since departure
    // (filters out brief pass-bys and mid-day lunch-at-home visits)
    if (minsSinceDeparture < 10) return;

    // Check if this is likely the evening return (not a mid-day visit)
    // Heuristic: if current time is after 14:00, it's likely the evening return
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12 && minsSinceDeparture < 60) return; // morning/early afternoon = probably mid-day

    stampArrivedHome();
  }, [leftSite, nearHome, arrivedHome, stampArrivedHome]);

  // Smart GPS deactivation — turn off GPS when arrived home (battery saving)
  useEffect(() => {
    if (arrivedHome) {
      setGpsActive(false);
    }
  }, [arrivedHome]);

  // Detect "stopped moving" for home confirmation prompt (when no learned home)
  const showHomeConfirmPrompt = leftSite && !effectiveHomeLat && currentPos && departedAtRef.current &&
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
    gpsActive,
    // Home detection
    homeDistance,
    nearHome,
    arrivedHome,
    showHomeConfirmPrompt,
    confirmHome,
    confirmingHome,
    // Inter-site
    interSiteFrom,
    // Depot
    nearDepot,
  };
}