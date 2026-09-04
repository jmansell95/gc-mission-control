import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useLiveStaffLocations — fetches the latest GPS position per staff member
 * who has reported in the last 2 hours, plus today's assignments to determine
 * shift state (travelling-to-site, on-site, travelling-home).
 *
 * Returns an array of { staffId, staffName, lat, lng, accuracy, speed, heading,
 *   timestamp, isMoving, shiftState, jobName } ready for map rendering.
 */
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useLiveStaffLocations(divisionId) {
  const { data: locationLogs = [] } = useQuery({
    queryKey: ['staff-location-recent', divisionId],
    queryFn: async () => {
      const since = new Date(Date.now() - STALE_MS).toISOString();
      const all = await base44.entities.StaffLocationLog.filter(
        { division_id: divisionId },
        '-recorded_at',
        500,
      );
      // Only keep points from the last 2 hours
      return all.filter(l => l.recorded_at && new Date(l.recorded_at).getTime() > Date.now() - STALE_MS);
    },
    refetchInterval: 30000, // 30s poll
    enabled: !!divisionId,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-for-map', divisionId],
    queryFn: () => base44.entities.Staff.filter({ division_id: divisionId }),
    enabled: !!divisionId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayAssignments = [] } = useQuery({
    queryKey: ['staff-assignments-map', divisionId, today],
    queryFn: () => base44.entities.RotaAssignment.filter({ division_id: divisionId, assigned_date: today }),
    enabled: !!divisionId,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-staff-map'],
    queryFn: () => base44.entities.Job.list(),
  });

  // Deduplicate: latest point per staff member
  const latestByStaff = {};
  for (const log of locationLogs) {
    if (!log.staff_id) continue;
    if (!latestByStaff[log.staff_id] || new Date(log.recorded_at) > new Date(latestByStaff[log.staff_id].recorded_at)) {
      latestByStaff[log.staff_id] = log;
    }
  }

  // Build the live staff array with shift state
  const liveStaff = Object.values(latestByStaff).map(log => {
    const staff = staffList.find(s => s.id === log.staff_id);
    const assignment = todayAssignments.find(a => a.staff_id === log.staff_id);
    const job = assignment?.job_id ? jobs.find(j => j.id === assignment.job_id) : null;

    let shiftState = 'off_shift';
    if (assignment) {
      if (assignment.left_site_at && !assignment.arrived_home_at) {
        shiftState = 'travelling_home';
      } else if (assignment.arrived_on_site_at && !assignment.left_site_at) {
        shiftState = 'on_site';
      } else if (!assignment.arrived_on_site_at) {
        shiftState = 'travelling_to_site';
      } else if (assignment.arrived_home_at) {
        shiftState = 'home';
      }
    }

    return {
      staffId: log.staff_id,
      staffName: staff?.name || 'Unknown',
      lat: log.lat,
      lng: log.lng,
      accuracy: log.accuracy_m,
      speed: log.speed_mps,
      heading: log.heading,
      timestamp: log.recorded_at,
      isMoving: log.is_moving,
      shiftState,
      jobName: job?.name || null,
      assignmentId: assignment?.id || null,
    };
  });

  return { liveStaff, isLoading: false };
}