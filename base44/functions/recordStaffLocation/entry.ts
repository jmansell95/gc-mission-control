import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { evaluateStaffGeofence } from "../../shared/staffGeofence.ts";

// ============================================================
// recordStaffLocation — receives batched GPS points from the
// staff app and stores them as StaffLocationLog entries, then
// runs geofence evaluation on the latest point.
// ============================================================
// Called by the staff app (useStaffTracking hook) every few
// minutes while the crew member has an active shift and tracking
// consent. Uses the authenticated user's token (not service role)
// so RLS create rules (created_by_id = user.id) apply.
// ============================================================

interface GpsPoint {
  lat: number;
  lng: number;
  accuracy_m?: number;
  speed_mps?: number;
  heading?: number;
  recorded_at: string;
  is_moving?: boolean;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const points: GpsPoint[] = Array.isArray(body?.points) ? body.points : [];
    const assignmentId: string = body?.assignment_id || "";
    const staffName: string = body?.staff_name || user.full_name || "";

    if (points.length === 0) {
      return Response.json({ error: "No points provided" }, { status: 400 });
    }

    // Look up the staff record for this user to validate tracking consent
    const staffRecords = await base44.entities.Staff.filter({ user_id: user.id });
    const staff = staffRecords[0];
    if (!staff) {
      return Response.json({ error: "Staff record not found" }, { status: 404 });
    }

    // Consent gate — no capture unless tracking is enabled and consent signed
    if (!staff.tracking_enabled || !staff.tracking_consent_signed_at) {
      return Response.json({ error: "Tracking consent not granted" }, { status: 403 });
    }

    // Validate the assignment exists and belongs to this staff member
    let assignment: any = null;
    if (assignmentId) {
      assignment = await base44.entities.RotaAssignment.get(assignmentId).catch(() => null);
      if (!assignment || assignment.staff_id !== staff.id) {
        return Response.json({ error: "Invalid assignment" }, { status: 403 });
      }
    }

    const divisionId = staff.division_id || assignment?.division_id || "";

    // Bulk-create the location log entries
    const logEntries = points.map((p) => ({
      staff_id: staff.id,
      assignment_id: assignmentId,
      division_id: divisionId,
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracy_m ?? null,
      speed_mps: p.speed_mps ?? null,
      heading: p.heading ?? null,
      recorded_at: p.recorded_at,
      is_moving: p.is_moving ?? false,
    }));

    await base44.entities.StaffLocationLog.bulkCreate(logEntries);

    // Run geofence evaluation on the latest point only (the rest are
    // historical breadcrumbs that don't need re-evaluation)
    const latest = points[points.length - 1];
    let geofenceResult = { arrivals: 0, departures: 0, timesheetsCreated: 0 };
    if (latest && assignmentId) {
      try {
        geofenceResult = await evaluateStaffGeofence(
          base44,
          staff.id,
          staffName,
          assignmentId,
          divisionId,
          latest.lat,
          latest.lng,
          latest.recorded_at,
        );
      } catch (e) {
        // Geofence failure is non-fatal — points are still stored
      }
    }

    return Response.json({
      status: "success",
      points_stored: logEntries.length,
      geofence: geofenceResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}