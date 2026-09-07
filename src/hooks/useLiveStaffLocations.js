import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useLiveStaffLocations — fetches the latest GPS position per staff member
 * who has reported in the last 2 hours, plus today's assignments to determine
 * shift state (travelling-to-site, on-site, travelling-home).
 *
 * Vehicle proxy: for staff with no recent phone GPS but a linked vehicle
 * (via today's rota, their default vehicle, or the Geotab keeper link)
 * that has a recent Geotab position, synthesizes a pin from the vehicle's
 * latest GPS point with source='vehicle_proxy'. The Geotab keeper fallback
 * means crew in company vehicles appear on the live map immediately even
 * when the rota has no vehicle selected — Geotab already knows who drives each.
 *
 * Returns an array of { staffId, staffName, lat, lng, accuracy, speed, heading,
 *   timestamp, isMoving, shiftState, jobName, source, vehicleName? } ready
 *   for map rendering.
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

  // Fetch Vehicle records to build a Geotab keeper map — each vehicle's
  // geotab_keeper_staff_id links a staff member to the vehicle Geotab knows
  // they drive, even when the rota has no vehicle selected.
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-for-keeper-map'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  // keeperStaffToVehicleId: geotab_keeper_staff_id → vehicle_id
  const keeperStaffToVehicleId = {};
  for (const v of vehicles) {
    if (v.geotab_keeper_staff_id) keeperStaffToVehicleId[v.geotab_keeper_staff_id] = v.id;
  }

  // Vehicle proxy: collect vehicle IDs assigned today (via rota, default, or
  // Geotab keeper link) so their fresh GPS logs are fetched.
  const assignedVehicleIds = todayAssignments.map(a => a.vehicle_id).filter(Boolean);
  const staffDefaultVehicleIds = staffList.map(s => s.default_vehicle_id).filter(Boolean);
  const keeperVehicleIds = Object.values(keeperStaffToVehicleId);
  const vehicleIds = [...new Set([...assignedVehicleIds, ...staffDefaultVehicleIds, ...keeperVehicleIds])];

  const { data: vehicleLogs = [] } = useQuery({
    queryKey: ['vehicle-location-for-staff-proxy', vehicleIds.join(',')],
    queryFn: async () => {
      if (vehicleIds.length === 0) return [];
      const all = await base44.entities.VehicleLocationLog.list('-timestamp', 200);
      return all.filter(v => v.vehicle_id && vehicleIds.includes(v.vehicle_id));
    },
    refetchInterval: 30000,
    enabled: vehicleIds.length > 0,
  });

  // Deduplicate: latest phone GPS point per staff member
  const latestByStaff = {};
  for (const log of locationLogs) {
    if (!log.staff_id) continue;
    if (!latestByStaff[log.staff_id] || new Date(log.recorded_at) > new Date(latestByStaff[log.staff_id].recorded_at)) {
      latestByStaff[log.staff_id] = log;
    }
  }

  // Deduplicate: latest vehicle GPS point per vehicle
  const latestByVehicle = {};
  for (const log of vehicleLogs) {
    if (!log.vehicle_id) continue;
    if (!latestByVehicle[log.vehicle_id] || new Date(log.timestamp) > new Date(latestByVehicle[log.vehicle_id].timestamp)) {
      latestByVehicle[log.vehicle_id] = log;
    }
  }

  // Helper: derive shift state from an assignment
  const deriveShiftState = (assignment) => {
    if (!assignment) return 'off_shift';
    if (assignment.left_site_at && !assignment.arrived_home_at) return 'travelling_home';
    if (assignment.arrived_on_site_at && !assignment.left_site_at) return 'on_site';
    if (assignment.arrived_home_at) return 'home';
    if (!assignment.arrived_on_site_at) return 'travelling_to_site';
    return 'off_shift';
  };

  // Build the live staff array from phone GPS
  const liveStaff = Object.values(latestByStaff).map(log => {
    const staff = staffList.find(s => s.id === log.staff_id);
    const assignment = todayAssignments.find(a => a.staff_id === log.staff_id);
    const job = assignment?.job_id ? jobs.find(j => j.id === assignment.job_id) : null;
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
      shiftState: deriveShiftState(assignment),
      jobName: job?.name || null,
      assignmentId: assignment?.id || null,
      source: 'phone',
    };
  });

  // Vehicle proxy: synthesize a pin from the vehicle's latest Geotab position
  // for every staff member with a linked vehicle. Vehicle resolved in priority:
  //   1. Today's rota assignment vehicle_id
  //   2. Staff default_vehicle_id
  //   3. Geotab keeper link (Vehicle.geotab_keeper_staff_id → this staff member)
  // The keeper fallback (3) works even without a rota assignment, so all
  // tracked drivers appear — Geotab already knows who drives each vehicle.
  // Staff with BOTH phone GPS and vehicle tracking get two entries (one
  // source='phone', one source='vehicle_proxy') so consumers can show dual pills.
  for (const staff of staffList) {
    const assignment = todayAssignments.find(a => a.staff_id === staff.id);
    const vehicleId = assignment?.vehicle_id || staff.default_vehicle_id || keeperStaffToVehicleId[staff.id];
    if (!vehicleId) continue;
    const vLog = latestByVehicle[vehicleId];
    if (!vLog || vLog.lat == null || vLog.lng == null) continue;
    // Only proxy if the vehicle log is fresh (within 2 hours)
    if (new Date(vLog.timestamp).getTime() < Date.now() - STALE_MS) continue;
    const job = assignment?.job_id ? jobs.find(j => j.id === assignment.job_id) : null;
    liveStaff.push({
      staffId: staff.id,
      staffName: staff.name,
      lat: vLog.lat,
      lng: vLog.lng,
      accuracy: null,
      speed: vLog.speed_kph ? vLog.speed_kph / 3.6 : null, // kph → mps
      heading: vLog.heading,
      timestamp: vLog.timestamp,
      isMoving: vLog.ignition_on && (vLog.speed_kph || 0) > 5,
      shiftState: deriveShiftState(assignment),
      jobName: job?.name || null,
      assignmentId: assignment?.id || null,
      source: 'vehicle_proxy',
      vehicleName: vLog.vehicle_name || vLog.registration_number,
    });
  }

  return { liveStaff, isLoading: false };
}