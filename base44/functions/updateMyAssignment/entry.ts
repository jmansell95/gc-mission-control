import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// updateMyAssignment — Self-service RotaAssignment updater
// ============================================================
// Allows a staff member to update their OWN rota assignment fields
// (daily checks, arrival, briefing, status, leave site) without being
// blocked by the RotaAssignment RLS (which only allows the creator or
// admins to update).
//
// Security:
//   1. Verifies the caller is authenticated via base44.auth.me()
//   2. Looks up the Staff record by user_id (the linked platform user)
//   3. Fetches the RotaAssignment and verifies assignment.staff_id === staff.id
//   4. Only accepts a whitelist of self-service fields — all other fields
//      are silently ignored so a malicious payload can't change job_id,
//      staff_id, vehicle_id, etc.
//   5. Updates via asServiceRole so RLS doesn't block the write.

const ALLOWED_FIELDS = new Set([
  'daily_checks_completed',
  'daily_checks_completed_at',
  'arrived_on_site_at',
  'briefing_signed',
  'briefing_signed_at',
  'briefing_start_at',
  'status',
  'started_at',
  'left_site_at',
  'early_leave_reason',
  'early_leave_note',
  'mitti_vehicle_check_at',
  'mitti_powra_at',
  'mitti_equipment_check_at',
  'towing_checklist_completed',
  'towing_checklist_at',
  'driver_checked',
  'driver_checked_by',
  'driver_checked_at',
]);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Auth check
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const body = await req.json().catch(() => ({}));
    const assignmentId: string = String(body.assignmentId || '').trim();
    const updates: Record<string, any> = body.updates || {};

    if (!assignmentId) {
      return Response.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    // 3. Look up the caller's Staff record by user_id
    const staffList = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
    const myStaff = staffList[0];
    if (!myStaff) {
      return Response.json({ error: 'No staff profile linked to your account' }, { status: 403 });
    }

    // 4. Fetch the assignment and verify ownership
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ id: assignmentId });
    const assignment = assignments[0];
    if (!assignment) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if (assignment.staff_id !== myStaff.id) {
      return Response.json({ error: 'You can only update your own assignments' }, { status: 403 });
    }

    // 5. Filter to allowed fields only
    const safeUpdates: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // 6. Update via service role (bypasses RLS)
    const updated = await base44.asServiceRole.entities.RotaAssignment.update(assignmentId, safeUpdates);

    return Response.json({ success: true, assignment: updated });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}