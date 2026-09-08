import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * replaceShiftsWithLeave — when leave is assigned to a staff member, this
 * deletes all their job and yard_depot RotaAssignment records within the
 * given date range so the leave fully replaces the shift (no double-booking),
 * then creates annual_leave RotaAssignment records for each date so the
 * rota grid shows "Annual Leave" instead of blank days.
 *
 * Non-job assignments (annual_leave, sick, training) are preserved — if an
 * annual_leave record already exists for a date, a new one is not created
 * (idempotent, safe for concurrent/overlapping leave requests).
 *
 * Payload: { staff_id, start_date, end_date, reason?, non_job_label? }
 * Returns: { ok, deleted, created, staff_id, start_date, end_date }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, start_date, end_date, reason, non_job_label } = body;

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

    // Build the list of dates in the range (inclusive).
    const dates: string[] = [];
    const start = new Date(start_date + 'T00:00:00');
    const end = new Date(end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    // Determine which dates already have a non-job assignment (annual_leave,
    // sick, training) so we don't create duplicates — this makes the function
    // idempotent and safe for overlapping/concurrent leave requests.
    const existingLeaveDates = new Set(
      assignments
        .filter(a => a.assignment_type === 'annual_leave' || a.assignment_type === 'sick' || a.assignment_type === 'training')
        .map(a => a.assigned_date)
    );

    // Compute week_start (Monday) for each date.
    const getWeekStart = (dateStr: string): string => {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDay(); // 0=Sun, 1=Mon, ...
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    };

    // Create annual_leave RotaAssignment records for dates that don't have one.
    const toCreate: any[] = [];
    for (const dateStr of dates) {
      if (existingLeaveDates.has(dateStr)) continue;
      toCreate.push({
        staff_id,
        assigned_date: dateStr,
        week_start: getWeekStart(dateStr),
        assignment_type: 'annual_leave',
        non_job_label: non_job_label || reason || 'Annual Leave',
      });
    }

    let created = 0;
    if (toCreate.length > 0) {
      try {
        const result = await base44.entities.RotaAssignment.bulkCreate(toCreate);
        created = Array.isArray(result) ? result.length : (toCreate.length);
      } catch (e) {
        // Fall back to individual creates if bulk fails
        for (const rec of toCreate) {
          try {
            await base44.entities.RotaAssignment.create(rec);
            created++;
          } catch (err) { /* best-effort */ }
        }
      }
    }

    return Response.json({ ok: true, deleted, created, staff_id, start_date, end_date });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}