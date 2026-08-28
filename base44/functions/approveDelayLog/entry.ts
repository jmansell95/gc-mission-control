import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Add N working days (Mon–Fri) to a yyyy-mm-dd date string.
function addWorkingDays(dateStr, n) {
  if (!dateStr || n <= 0) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

// Shift a Monday week_start by whole weeks (keeps it a Monday).
function addWeeks(dateStr, weeks) {
  if (!dateStr || weeks <= 0) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { delay_log_id, action } = body;
    if (!delay_log_id) return Response.json({ error: 'delay_log_id required' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const log = await base44.asServiceRole.entities.JobDelayLog.get(delay_log_id);
    if (!log) return Response.json({ error: 'Delay log not found' }, { status: 404 });

    // A staff member cannot approve their own delay — managers only.
    if (action === 'approve' && log.created_by_id && log.created_by_id === user.id) {
      return Response.json({ error: "You can't approve your own delay log" }, { status: 403 });
    }

    // Only admins/managers may approve or reject delay logs — the approve
    // action shifts future rota assignments and extends job end dates, which
    // must not be available to regular staff.
    const isAdmin = user.role === 'admin';
    let isManager = isAdmin;
    if (!isManager) {
      try {
        const staffRec = await base44.entities.Staff.filter({ user_id: user.id });
        const s = staffRec[0];
        isManager = !!s && (s.system_role === 'admin' || s.system_role === 'management' || s.system_role === 'super_admin');
      } catch (_) { /* fall through to deny */ }
    }
    if (!isManager) {
      return Response.json({ error: 'Only managers can approve or reject delay logs' }, { status: 403 });
    }

    const reviewer = user.full_name || user.email || '';

    if (action === 'reject') {
      await base44.asServiceRole.entities.JobDelayLog.update(delay_log_id, {
        manager_review_status: 'rejected',
        manager_reviewed_by: reviewer,
        manager_reviewed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'rejected' });
    }

    // ── Approve ──
    const days = Number(log.impacted_days) || 0;
    let shifted = 0;
    let newEndDate = null;

    if (days > 0) {
      // Anchor = the date the delay was reported; shift every assignment on/after it.
      const anchor = (log.reported_at || new Date().toISOString()).slice(0, 10);
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: log.job_id });
      const future = assignments.filter(a => (a.assigned_date || '') >= anchor);

      if (future.length > 0) {
        const weeks = Math.ceil(days / 5);
        const updates = future.map(a => ({
          id: a.id,
          assigned_date: addWorkingDays(a.assigned_date, days),
          week_start: addWeeks(a.week_start, weeks),
        }));
        await base44.asServiceRole.entities.RotaAssignment.bulkUpdate(updates);
        shifted = updates.length;
      }

      // Extend the job end date by the same working days.
      const job = await base44.asServiceRole.entities.Job.get(log.job_id);
      if (job && job.end_date) {
        newEndDate = addWorkingDays(job.end_date, days);
        await base44.asServiceRole.entities.Job.update(log.job_id, { end_date: newEndDate });
      }
    }

    await base44.asServiceRole.entities.JobDelayLog.update(delay_log_id, {
      manager_review_status: 'approved',
      manager_reviewed_by: reviewer,
      manager_reviewed_at: new Date().toISOString(),
      rota_adjusted: days > 0,
    });

    return Response.json({ status: 'approved', days, shifted, new_end_date: newEndDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});