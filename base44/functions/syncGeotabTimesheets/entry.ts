import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncGeotabTimesheets — auto-generates draft Timesheet entries
// from Geotab GPS vehicle location data.
//
// Matches drivers to staff (by name or assigned vehicle), detects
// arrival/departure at job sites via geofencing (Haversine distance
// to job site_lat/site_lng), and creates travel_to / on_site /
// travel_from entries with source: 'geotab_auto'.
//
// Payload: { date?: 'YYYY-MM-DD', radius?: number (metres, default 200) }
// Called by admins manually or by a scheduled automation.
// ============================================================

// Haversine distance in metres between two lat/lng points
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toHHMM(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // When called without an explicit date, use a time-aware default:
    //   - Before 06:00 → process yesterday (the nightly 00:00 automation
    //     catches the full previous day's GPS logs).
    //   - After 06:00 → process today (the 30-minute daytime automation
    //     builds entries in near-real-time for the current day).
    // Manual UI calls always pass an explicit date, so this default only
    // affects the two scheduled automations.
    const targetDate = body.date || (() => {
      const d = new Date();
      if (d.getHours() < 6) d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const GEOFENCE_RADIUS_M = Number(body.radius) || 200;

    // Load all active staff for driver-name matching
    const allStaff = await base44.asServiceRole.entities.Staff.filter({ is_active: true });

    // Load today's rota assignments
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: targetDate });
    if (assignments.length === 0) {
      return Response.json({ ok: true, message: 'No rota assignments for this date.', synced: 0 });
    }

    // Load all jobs (for site_lat/site_lng) and vehicles
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j.id] = j;

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const vehicleById: Record<string, any> = {};
    for (const v of vehicles) vehicleById[v.id] = v;

    // Get all VehicleLocationLog entries for today
    const dayStart = new Date(targetDate + 'T00:00:00');
    const dayEnd = new Date(targetDate + 'T23:59:59');
    const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', 2000);
    const dayLogs = allLogs.filter((l: any) => {
      const ts = new Date(l.timestamp);
      return ts >= dayStart && ts <= dayEnd;
    });

    // Group logs by vehicle_id and by driver_name
    const logsByVehicle: Record<string, any[]> = {};
    const logsByDriverName: Record<string, any[]> = {};
    for (const l of dayLogs) {
      const vKey = l.vehicle_id || '';
      if (vKey) {
        if (!logsByVehicle[vKey]) logsByVehicle[vKey] = [];
        logsByVehicle[vKey].push(l);
      }
      if (l.driver_name) {
        const dKey = l.driver_name.toLowerCase().trim();
        if (!logsByDriverName[dKey]) logsByDriverName[dKey] = [];
        logsByDriverName[dKey].push(l);
      }
    }

    // Check for existing geotab_auto timesheets to avoid duplicates
    const existingTimesheets = await base44.asServiceRole.entities.Timesheet.filter({ date: targetDate });
    const existingAutoKeys = new Set<string>();
    for (const t of existingTimesheets) {
      if (t.source === 'geotab_auto') {
        existingAutoKeys.add(`${t.staff_id}|${t.job_id}|${t.task_type}`);
      }
    }

    let synced = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const assignment of assignments) {
      const staff = allStaff.find(s => s.id === assignment.staff_id);
      if (!staff) { skipped++; continue; }

      const job = jobMap[assignment.job_id];
      if (!job || (job.site_lat === undefined || job.site_lat === null)) {
        // No geofence coordinates for this job — can't auto-detect
        skipped++;
        continue;
      }

      // Find GPS logs for this staff member's vehicle
      let vehicleLogs: any[] = [];

      // 1. Try the vehicle assigned to the rota assignment
      if (assignment.vehicle_id) {
        vehicleLogs = logsByVehicle[assignment.vehicle_id] || [];
      }

      // 2. Fallback: match by driver name in the GPS logs
      if (vehicleLogs.length === 0 && staff.name) {
        const staffNameKey = staff.name.toLowerCase().trim();
        vehicleLogs = logsByDriverName[staffNameKey] || [];
      }

      // 3. Fallback: try staff's default vehicle
      if (vehicleLogs.length === 0 && staff.default_vehicle_id) {
        vehicleLogs = logsByVehicle[staff.default_vehicle_id] || [];
      }

      if (vehicleLogs.length === 0) {
        skipped++;
        continue;
      }

      // Sort by timestamp
      vehicleLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Geofence detection: find first entry within radius (arrival) and last within-radius log (departure)
      const siteLat = Number(job.site_lat);
      const siteLng = Number(job.site_lng);
      let arrivalLog: any = null;
      let departureLog: any = null;

      for (const log of vehicleLogs) {
        const dist = haversineMetres(Number(log.lat), Number(log.lng), siteLat, siteLng);
        if (dist <= GEOFENCE_RADIUS_M) {
          if (!arrivalLog) arrivalLog = log;
          departureLog = log; // keep updating to last within-radius log
        }
      }

      if (!arrivalLog) {
        // Vehicle never entered the geofence — no auto timesheet
        skipped++;
        continue;
      }

      // If no departure detected (vehicle still on site), use the last log of the day
      const lastLog = vehicleLogs[vehicleLogs.length - 1];
      if (!departureLog || departureLog.id === arrivalLog.id) {
        departureLog = lastLog;
      }

      const firstLog = vehicleLogs[0];
      const weekStart = getWeekStart(targetDate);

      // Create travel_to entry (first log → arrival)
      const travelToKey = `${staff.id}|${job.id}|travel_to`;
      if (!existingAutoKeys.has(travelToKey)) {
        const travelToDuration = Math.round((new Date(arrivalLog.timestamp) - new Date(firstLog.timestamp)) / 60000);
        await base44.asServiceRole.entities.Timesheet.create({
          staff_id: staff.id,
          job_id: job.id,
          date: targetDate,
          week_start: weekStart,
          task_description: 'Travel to site (auto-detected via Geotab GPS)',
          task_type: 'travel_to',
          start_time: toHHMM(firstLog.timestamp),
          end_time: toHHMM(arrivalLog.timestamp),
          task_duration_minutes: Math.max(0, travelToDuration),
          total_hours: Math.max(0, travelToDuration) / 60,
          status: 'draft',
          source: 'geotab_auto',
          travel_depart_home: toHHMM(firstLog.timestamp),
          travel_arrive_site: toHHMM(arrivalLog.timestamp),
        });
        existingAutoKeys.add(travelToKey);
        synced++;
      }

      // Create on_site entry (arrival → departure)
      const onSiteKey = `${staff.id}|${job.id}|on_site`;
      if (!existingAutoKeys.has(onSiteKey)) {
        const onSiteDuration = Math.round((new Date(departureLog.timestamp) - new Date(arrivalLog.timestamp)) / 60000);
        await base44.asServiceRole.entities.Timesheet.create({
          staff_id: staff.id,
          job_id: job.id,
          date: targetDate,
          week_start: weekStart,
          task_description: 'On-site work (auto-detected via Geotab GPS)',
          task_type: 'on_site',
          start_time: toHHMM(arrivalLog.timestamp),
          end_time: toHHMM(departureLog.timestamp),
          task_duration_minutes: Math.max(0, onSiteDuration),
          total_hours: Math.max(0, onSiteDuration) / 60,
          status: 'draft',
          source: 'geotab_auto',
        });
        existingAutoKeys.add(onSiteKey);
        synced++;
      }

      // Create travel_from entry (departure → last log) only if vehicle left site
      const travelFromKey = `${staff.id}|${job.id}|travel_from`;
      if (!existingAutoKeys.has(travelFromKey) && departureLog.id !== lastLog.id) {
        const travelFromDuration = Math.round((new Date(lastLog.timestamp) - new Date(departureLog.timestamp)) / 60000);
        await base44.asServiceRole.entities.Timesheet.create({
          staff_id: staff.id,
          job_id: job.id,
          date: targetDate,
          week_start: weekStart,
          task_description: 'Travel home (auto-detected via Geotab GPS)',
          task_type: 'travel_from',
          start_time: toHHMM(departureLog.timestamp),
          end_time: toHHMM(lastLog.timestamp),
          task_duration_minutes: Math.max(0, travelFromDuration),
          total_hours: Math.max(0, travelFromDuration) / 60,
          status: 'draft',
          source: 'geotab_auto',
          travel_depart_site: toHHMM(departureLog.timestamp),
          travel_arrive_home: toHHMM(lastLog.timestamp),
        });
        existingAutoKeys.add(travelFromKey);
        synced++;
      }

      results.push({
        staff: staff.name,
        job: job.name,
        arrival: toHHMM(arrivalLog.timestamp),
        departure: toHHMM(departureLog.timestamp),
      });
    }

    return Response.json({
      ok: true,
      message: `Synced ${synced} auto-timesheet entr${synced === 1 ? 'y' : 'ies'} from Geotab GPS data.`,
      synced,
      skipped,
      date: targetDate,
      results,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}