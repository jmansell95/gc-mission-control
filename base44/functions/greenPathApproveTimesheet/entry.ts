import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Green-Path Auto-Approval — when a daily summary timesheet is submitted,
// checks if it meets "green-path" criteria (routine day, no red flags) and
// auto-approves it so managers only need to review exceptions.
//
// Triggered by an entity automation on Timesheet "create". Can also be
// invoked manually to bulk-process pending submitted summaries.
//
// Green-path criteria (all must be true):
//   1. is_summary = true and status = 'submitted'
//   2. has a valid job_id
//   3. on_site_minutes > 0
//   4. total minutes (on-site + travel + break) <= 720 (12h day — routine in drilling)
//   5. travel minutes <= 120 (2h — normal for remote sites)
//   6. is_overtime = false
//   7. break_minutes >= 30
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: allow admin invocation from the frontend, and service-role
    // invocation from the entity automation (no user session).
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch (_) {}

    let timesheetId = null;
    let timesheetData = null;

    // Entity automation payload: { event, data }
    try {
      const body = await req.json();
      if (body?.event?.entity_id) {
        timesheetId = body.event.entity_id;
        timesheetData = body.data;
      } else if (body?.timesheet_id) {
        timesheetId = body.timesheet_id;
      }
    } catch (_) {
      // No JSON body — might be a GET or empty POST
    }

    // If we have a specific timesheet, process just that one
    if (timesheetId) {
      if (!timesheetData) {
        timesheetData = await base44.asServiceRole.entities.Timesheet.get(timesheetId);
      }
      const result = checkGreenPath(timesheetData);
      if (result.passed) {
        const now = new Date();
        const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await base44.asServiceRole.entities.Timesheet.update(timesheetId, {
          status: 'approved',
          approved_by_name: 'Green-Path Auto-Approval',
          auto_approved_at: now.toISOString(),
          auto_approved_until: until.toISOString(),
        });
        return Response.json({ success: true, auto_approved: true, id: timesheetId, checks: result.checks });
      }
      // Flag overtime entries for explicit line-manager approval
      if (timesheetData?.is_overtime || (timesheetData?.weekly_overtime_minutes || 0) > 0) {
        await base44.asServiceRole.entities.Timesheet.update(timesheetId, {
          overtime_pending: true,
          status: 'submitted',
        });
        return Response.json({ success: true, auto_approved: false, id: timesheetId, reason: 'Overtime pending line-manager approval' });
      }
      return Response.json({ success: true, auto_approved: false, id: timesheetId, reason: result.reason });
    }

    // Bulk mode (admin only) — process all pending submitted summaries
    if (!isAdmin) {
      return Response.json({ error: 'Admin only for bulk processing' }, { status: 403 });
    }

    const pending = await base44.asServiceRole.entities.Timesheet.filter({
      status: { $in: ['submitted', 'auto_submitted'] },
      is_summary: true,
    });

    let approved = 0;
    let skipped = 0;
    const skippedReasons = [];

    const now = new Date();
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    for (const t of pending) {
      const result = checkGreenPath(t);
      if (result.passed) {
        await base44.asServiceRole.entities.Timesheet.update(t.id, {
          status: 'approved',
          approved_by_name: 'Green-Path Auto-Approval',
          auto_approved_at: now.toISOString(),
          auto_approved_until: until.toISOString(),
        });
        approved++;
      } else if (t.is_overtime || (t.weekly_overtime_minutes || 0) > 0) {
        await base44.asServiceRole.entities.Timesheet.update(t.id, {
          overtime_pending: true,
          status: 'submitted',
        });
        skipped++;
        skippedReasons.push({ id: t.id, reason: 'Overtime pending line-manager approval' });
      } else {
        skipped++;
        skippedReasons.push({ id: t.id, reason: result.reason });
      }
    }

    return Response.json({
      success: true,
      processed: pending.length,
      auto_approved: approved,
      skipped,
      skipped_reasons: skippedReasons.length > 0 ? skippedReasons : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Check if a timesheet meets green-path criteria.
// Returns { passed: boolean, reason?: string, checks?: object }
function checkGreenPath(t) {
  if (!t) return { passed: false, reason: 'No timesheet data' };
  if (!t.is_summary) return { passed: false, reason: 'Not a summary entry' };
  if (t.status !== 'submitted' && t.status !== 'auto_submitted') return { passed: false, reason: `Status is ${t.status}` };
  if (!t.job_id) return { passed: false, reason: 'No job assigned' };

  const onSite = t.on_site_minutes || 0;
  const travelTo = t.travel_to_minutes || 0;
  const travelFrom = t.travel_from_minutes || 0;
  const breakMin = t.break_minutes || 0;
  const totalMins = onSite + travelTo + travelFrom + breakMin;
  const travelMins = travelTo + travelFrom;

  const checks = {
    has_on_site: onSite > 0,
    reasonable_day: totalMins <= 720,
    reasonable_travel: travelMins <= 120,
    no_overtime: !t.is_overtime,
    has_break: breakMin >= 30,
  };

  if (!checks.has_on_site) return { passed: false, reason: 'No on-site time recorded', checks };
  if (!checks.reasonable_day) return { passed: false, reason: `Long day (${totalMins}m > 720m)`, checks };
  if (!checks.reasonable_travel) return { passed: false, reason: `Excessive travel (${travelMins}m > 120m)`, checks };
  if (!checks.no_overtime) return { passed: false, reason: 'Overtime flagged', checks };
  if ((t.weekly_overtime_minutes || 0) > 0) return { passed: false, reason: 'Weekly overtime hours present', checks };
  if (!checks.has_break) return { passed: false, reason: `Break too short (${breakMin}m < 30m)`, checks };

  return { passed: true, checks };
}