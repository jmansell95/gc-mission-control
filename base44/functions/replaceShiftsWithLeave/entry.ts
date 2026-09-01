import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * replaceShiftsWithLeave — when leave is assigned to a staff member, this
 * deletes all their job and yard_depot RotaAssignment records within the
 * given date range so the leave fully replaces the shift (no double-booking).
 * Non-job assignments (annual_leave, sick, training) are preserved.
 *
 * Payload: { staff_id, start_date, end_date }
 * Returns: { ok, deleted }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, start_date, end_date } = body;

    if (!staff_id || !start_date || !end_date) {
      return Response.json({ error: 'staff_id, start_date, and end_date are required' }, { status: 400 });
    }

    // Fetch all rota assignments for this staff member within the date range.
    const assignments = await base44.entities.RotaAssignment.filter({
      staff_id,
      assigned_date: { $gte: start_date, $lte: end_date }
    });

    // Only delete job and yard_depot assignments — preserve annual_leave/sick/training.
    const toDelete = assignments.filter(a =>
      a.assignment_type !== 'annual_leave' &&
      a.assignment_type !== 'sick' &&
      a.assignment_type !== 'training'
    );

    let deleted = 0;
    for (const a of toDelete) {
      try {
        await base44.entities.RotaAssignment.delete(a.id);
        deleted++;
      } catch (e) {
        // Skip records that can't be deleted (RLS, already gone, etc.)
      }
    }

    return Response.json({ ok: true, deleted, staff_id, start_date, end_date });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}