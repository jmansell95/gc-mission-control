import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { evaluateStaffGeofence } from "../../shared/staffGeofence.ts";

// ============================================================
// receivePhoneGps — webhook endpoint for FREE external GPS apps
// (GPSLogger for Android, OwnTracks for iOS/Android).
//
// These open-source native apps run in the phone's background and
// POST GPS fixes to this endpoint even when our app is closed —
// no Capacitor build, no paid service, no app-store submission.
//
// The function validates a shared secret, looks up the staff
// member, creates a StaffLocationLog entry, and runs the geofence
// engine — the same pipeline as the in-app recordStaffLocation.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const params = url.searchParams;

    // ── Auth: shared secret + staff_id from query params or headers ──
    const secret =
      params.get("secret") ||
      req.headers.get("X-Tracking-Secret") ||
      "";
    const staffId = params.get("staff_id") || params.get("staff") || "";

    if (!secret || !staffId) {
      return Response.json(
        { error: "Missing secret or staff_id" },
        { status: 400 },
      );
    }

    // ── Validate the shared secret against AppSetting ──
    const configRecords =
      await base44.asServiceRole.entities.AppSetting.filter({
        key: "phone_gps_config",
      });
    const config = configRecords[0];
    if (!config || !config.value?.secret) {
      return Response.json(
        {
          error:
            "Phone GPS tracking not configured. Admin must generate a shared secret in Settings → Phone GPS Tracking.",
        },
        { status: 503 },
      );
    }
    if (secret !== config.value.secret) {
      return Response.json({ error: "Invalid secret" }, { status: 403 });
    }

    // ── Look up the staff member ──
    const staff = await base44.asServiceRole.entities.Staff.get(staffId).catch(
      () => null,
    );
    if (!staff) {
      return Response.json({ error: "Staff member not found" }, { status: 404 });
    }

    // ── Consent gate — no capture unless tracking is enabled ──
    if (!staff.tracking_enabled) {
      return Response.json(
        { error: "Tracking not enabled for this staff member" },
        { status: 403 },
      );
    }

    // ── Extract GPS data from the request ──
    let lat: number;
    let lng: number;
    let accuracy: number | null = null;
    let speed: number | null = null;
    let heading: number | null = null;
    let recordedAt: string;

    if (req.method === "POST") {
      // ── OwnTracks JSON format ──
      const body = await req.json();
      if (body._type && body._type !== "location") {
        // Ignore transitions, lwt, etc. — only store location pings
        return Response.json({ status: "ignored", type: body._type });
      }
      lat = parseFloat(body.lat);
      lng = parseFloat(body.lon);
      accuracy = body.acc != null ? parseFloat(body.acc) : null;
      speed = body.vel != null ? parseFloat(body.vel) : null;
      // OwnTracks tst is Unix seconds
      const tst = body.tst ? parseInt(body.tst) : Math.floor(Date.now() / 1000);
      // Handle both seconds and milliseconds
      const tsMs = tst > 1e12 ? tst : tst * 1000;
      recordedAt = new Date(tsMs).toISOString();
    } else {
      // ── GPSLogger GET format ──
      lat = parseFloat(params.get("lat") || "");
      lng = parseFloat(params.get("lon") || params.get("lng") || "");
      accuracy = params.get("accuracy")
        ? parseFloat(params.get("accuracy")!)
        : null;
      speed = params.get("speed") ? parseFloat(params.get("speed")!) : null;
      heading = params.get("heading")
        ? parseFloat(params.get("heading")!)
        : null;
      const ts = params.get("timestamp");
      if (ts) {
        const tsNum = parseInt(ts);
        const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
        recordedAt = new Date(tsMs).toISOString();
      } else {
        recordedAt = new Date().toISOString();
      }
    }

    if (isNaN(lat) || isNaN(lng)) {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    // ── Find today's RotaAssignment for this staff member ──
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAssignments =
      await base44.asServiceRole.entities.RotaAssignment.filter({
        staff_id: staffId,
        assigned_date: todayStr,
      });
    const assignment = todayAssignments[0];
    const assignmentId = assignment?.id || "";
    const divisionId = staff.division_id || assignment?.division_id || "";

    // ── Create the StaffLocationLog entry ──
    const isMoving = speed != null && speed > 1;

    await base44.asServiceRole.entities.StaffLocationLog.create({
      staff_id: staffId,
      assignment_id: assignmentId,
      division_id: divisionId,
      lat,
      lng,
      accuracy_m: accuracy,
      speed_mps: speed,
      heading,
      recorded_at: recordedAt,
      is_moving: isMoving,
    });

    // ── Run geofence evaluation (same pipeline as in-app tracker) ──
    let geofenceResult = { arrivals: 0, departures: 0, timesheetsCreated: 0 };
    if (assignmentId) {
      try {
        geofenceResult = await evaluateStaffGeofence(
          base44,
          staffId,
          staff.name,
          assignmentId,
          divisionId,
          lat,
          lng,
          recordedAt,
        );
      } catch (e) {
        // Geofence failure is non-fatal — point is still stored
      }
    }

    // ── Clear any previous capture error (GPS is working again) ──
    if (staff.last_capture_error) {
      await base44.asServiceRole.entities.Staff.update(staffId, {
        last_capture_error: "",
        last_capture_error_at: "",
      });
    }

    return Response.json({
      status: "success",
      staff: staff.name,
      lat,
      lng,
      recorded_at: recordedAt,
      geofence: geofenceResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}