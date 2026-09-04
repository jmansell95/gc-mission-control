// ============================================================
// staffGeofence.ts — shared geofence detection logic for staff
// ============================================================
// Mirrors the vehicle geofence pipeline (geofence.ts) but for
// staff phone GPS. Evaluates each incoming StaffLocationLog point
// against the staff member's home geofence, today's job site
// geofence, and supplier yard geofences. Creates StaffGeofenceEvent
// records on boundary transitions, stamps the RotaAssignment shift
// pipeline fields, and auto-creates draft travel Timesheet entries.
//
// Used by the recordStaffLocation backend function.
// ============================================================

import { haversineMeters, loadGeofenceConfig } from "./geofence.ts";

export interface StaffGeofenceTarget {
  type: "home" | "site" | "supplier";
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_override?: number;
}

/** Monday of the week containing the given YYYY-MM-DD string. */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Evaluate a staff member's latest GPS position against all relevant
 * geofences and create arrival/departure events on transitions.
 *
 * Also stamps the RotaAssignment shift pipeline:
 *   - site arrival → arrived_on_site_at (first arrival of the day)
 *   - site departure → left_site_at
 *   - home arrival → arrived_home_at
 *
 * And auto-creates draft travel Timesheet entries:
 *   - site arrival → travel_to timesheet (from preceding home departure)
 *   - home arrival → travel_from timesheet (from preceding site departure)
 */
export async function evaluateStaffGeofence(
  base44: any,
  staffId: string,
  staffName: string,
  assignmentId: string,
  divisionId: string,
  lat: number,
  lng: number,
  timestamp: string,
): Promise<{ arrivals: number; departures: number; timesheetsCreated: number }> {
  const result = { arrivals: 0, departures: 0, timesheetsCreated: 0 };
  if (isNaN(lat) || isNaN(lng)) return result;

  const today = timestamp.slice(0, 10);

  // Load geofence config + staff record + today's assignment + job + suppliers
  const { config } = await loadGeofenceConfig(base44);
  if (!config.enabled) return result;

  const [staff, assignment, suppliers] = await Promise.all([
    base44.asServiceRole.entities.Staff.get(staffId).catch(() => null),
    assignmentId
      ? base44.asServiceRole.entities.RotaAssignment.get(assignmentId).catch(() => null)
      : null,
    base44.asServiceRole.entities.Supplier.list("-created_date", 500),
  ]);

  if (!staff) return result;

  // Build geofence targets
  const targets: StaffGeofenceTarget[] = [];

  // 1) Home geofence (if learned)
  if (staff.home_lat && staff.home_lng) {
    targets.push({
      type: "home",
      id: "home",
      name: "Home",
      lat: staff.home_lat,
      lng: staff.home_lng,
    });
  }

  // 2) Today's job site geofence
  let job: any = null;
  if (assignment?.job_id) {
    job = await base44.asServiceRole.entities.Job.get(assignment.job_id).catch(() => null);
  }
  if (job && job.site_lat && job.site_lng) {
    targets.push({
      type: "site",
      id: job.id,
      name: job.name,
      lat: job.site_lat,
      lng: job.site_lng,
      radius_override: job.geofence_radius_override,
    });
  }

  // 3) Supplier yard geofences
  for (const s of suppliers) {
    if (s.lat && s.lng) {
      targets.push({
        type: "supplier",
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        radius_override: s.geofence_radius_override,
      });
    }
  }

  if (targets.length === 0) return result;

  // Load recent staff geofence events to determine current in/out state
  const recentEvents = await base44.asServiceRole.entities.StaffGeofenceEvent.filter(
    { staff_id: staffId },
    "-at",
    200,
  );
  // Map: targetKey → last event type ('arrive' | 'depart')
  const lastEventByTarget = new Map<string, string>();
  for (const e of recentEvents) {
    const key = `${e.geofence_type}|${e.linked_geofence_ref}`;
    if (!lastEventByTarget.has(key)) {
      lastEventByTarget.set(key, e.event_type);
    }
  }

  for (const target of targets) {
    const distance = haversineMeters(lat, lng, target.lat, target.lng);
    const radius = target.radius_override || config.default_radius_meters;
    const isInside = distance <= radius;
    const key = `${target.type}|${target.id}`;
    const lastEvent = lastEventByTarget.get(key);

    if (isInside && lastEvent !== "arrive") {
      // ── ARRIVAL ──
      const event: any = await base44.asServiceRole.entities.StaffGeofenceEvent.create({
        staff_id: staffId,
        staff_name: staffName,
        assignment_id: assignmentId || "",
        division_id: divisionId || "",
        geofence_type: target.type,
        event_type: "arrive",
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        at: timestamp,
        linked_geofence_ref: target.id,
        linked_geofence_name: target.name,
        timesheet_created: false,
      });
      result.arrivals++;

      // Stamp RotaAssignment shift pipeline
      if (target.type === "site" && assignment && !assignment.arrived_on_site_at) {
        try {
          await base44.asServiceRole.entities.RotaAssignment.update(assignment.id, {
            arrived_on_site_at: timestamp,
          });
        } catch (_) {}
      }
      if (target.type === "home" && assignment && !assignment.arrived_home_at) {
        try {
          await base44.asServiceRole.entities.RotaAssignment.update(assignment.id, {
            arrived_home_at: timestamp,
          });
        } catch (_) {}
      }

      // Auto-create travel_to timesheet on site arrival (from preceding home departure)
      if (target.type === "site" && assignment) {
        const homeDepart = recentEvents.find(
          (e) => e.geofence_type === "home" && e.event_type === "depart" && e.at <= timestamp,
        );
        if (homeDepart && !event.timesheet_created) {
          const travelMin = Math.round(
            (new Date(timestamp).getTime() - new Date(homeDepart.at).getTime()) / 60000,
          );
          if (travelMin > 0) {
            try {
              const existing = await base44.asServiceRole.entities.Timesheet.filter(
                { rota_assignment_id: assignment.id, task_type: "travel_to", source: "staff_gps" },
                "-created_date",
                5,
              );
              if (existing.length === 0) {
                const departHHMM = homeDepart.at.length >= 16 ? homeDepart.at.slice(11, 16) : "";
                const arriveHHMM = timestamp.length >= 16 ? timestamp.slice(11, 16) : "";
                await base44.asServiceRole.entities.Timesheet.create({
                  staff_id: staffId,
                  division_id: divisionId || "",
                  job_id: assignment.job_id || "",
                  date: today,
                  week_start: getWeekStart(today),
                  task_description: "Travel to site (auto-detected via phone GPS)",
                  start_time: departHHMM,
                  end_time: arriveHHMM,
                  task_type: "travel_to",
                  source: "staff_gps",
                  status: "draft",
                  rota_assignment_id: assignment.id,
                  total_hours: Math.round((travelMin / 60) * 100) / 100,
                });
                result.timesheetsCreated++;
              }
              await base44.asServiceRole.entities.StaffGeofenceEvent.update(event.id, {
                timesheet_created: true,
                travel_minutes: travelMin,
              });
            } catch (_) {}
          }
        }
      }

      // Auto-create travel_from timesheet on home arrival (from preceding site departure)
      if (target.type === "home" && assignment) {
        const siteDepart = recentEvents.find(
          (e) => e.geofence_type === "site" && e.event_type === "depart" && e.at <= timestamp,
        );
        if (siteDepart && !event.timesheet_created) {
          const travelMin = Math.round(
            (new Date(timestamp).getTime() - new Date(siteDepart.at).getTime()) / 60000,
          );
          if (travelMin > 0) {
            try {
              const existing = await base44.asServiceRole.entities.Timesheet.filter(
                { rota_assignment_id: assignment.id, task_type: "travel_from", source: "staff_gps" },
                "-created_date",
                5,
              );
              if (existing.length === 0) {
                const departHHMM = siteDepart.at.length >= 16 ? siteDepart.at.slice(11, 16) : "";
                const arriveHHMM = timestamp.length >= 16 ? timestamp.slice(11, 16) : "";
                await base44.asServiceRole.entities.Timesheet.create({
                  staff_id: staffId,
                  division_id: divisionId || "",
                  job_id: assignment.job_id || "",
                  date: today,
                  week_start: getWeekStart(today),
                  task_description: "Travel home (auto-detected via phone GPS)",
                  start_time: departHHMM,
                  end_time: arriveHHMM,
                  task_type: "travel_from",
                  source: "staff_gps",
                  status: "draft",
                  rota_assignment_id: assignment.id,
                  total_hours: Math.round((travelMin / 60) * 100) / 100,
                });
                result.timesheetsCreated++;
              }
              await base44.asServiceRole.entities.StaffGeofenceEvent.update(event.id, {
                timesheet_created: true,
                travel_minutes: travelMin,
              });
            } catch (_) {}
          }
        }
      }

      lastEventByTarget.set(key, "arrive");
    } else if (!isInside && lastEvent === "arrive") {
      // ── DEPARTURE ──
      // Calculate duration on site (for site departures)
      let durationMin: number | undefined;
      if (target.type === "site") {
        const arriveEvent = recentEvents.find(
          (e) =>
            e.geofence_type === "site" &&
            e.event_type === "arrive" &&
            e.linked_geofence_ref === target.id &&
            e.at <= timestamp,
        );
        if (arriveEvent) {
          durationMin = Math.round(
            (new Date(timestamp).getTime() - new Date(arriveEvent.at).getTime()) / 60000,
          );
        }
      }

      await base44.asServiceRole.entities.StaffGeofenceEvent.create({
        staff_id: staffId,
        staff_name: staffName,
        assignment_id: assignmentId || "",
        division_id: divisionId || "",
        geofence_type: target.type,
        event_type: "depart",
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        at: timestamp,
        duration_on_site_minutes: durationMin,
        linked_geofence_ref: target.id,
        linked_geofence_name: target.name,
        timesheet_created: false,
      });
      result.departures++;

      // Stamp left_site_at on site departure
      if (target.type === "site" && assignment && !assignment.left_site_at) {
        try {
          await base44.asServiceRole.entities.RotaAssignment.update(assignment.id, {
            left_site_at: timestamp,
          });
        } catch (_) {}
      }

      lastEventByTarget.set(key, "depart");
    }
  }

  return result;
}