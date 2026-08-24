import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Backfill KeyLogBook Site Log Durations — one-time migration
// ============================================================
// Recomputes duration_minutes for all keylogbook_remarks InvestigationLogs
// where duration is 0/null but both start_time and end_time are present.
// Applies the midnight-crossing fix (e.g. 22:00→06:00 = 480 min).
//
// Triggered manually by an admin from the Site Logs tab.
// ============================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all keylogbook_remarks logs (up to 500 per batch)
    const allLogs = await base44.asServiceRole.entities.InvestigationLog.filter(
      { source: 'keylogbook_remarks' },
      '-created_date',
      500
    );

    // Find logs with zero/null duration but both times present
    const needsFix = allLogs.filter(log =>
      (!log.duration_minutes || log.duration_minutes === 0) &&
      log.start_time && log.end_time
    );

    // Recompute duration with midnight-crossing fix
    const updates = needsFix.map(log => {
      const m1 = String(log.start_time).match(/^(\d{1,2}):(\d{2})/);
      const m2 = String(log.end_time).match(/^(\d{1,2}):(\d{2})/);
      if (!m1 || !m2) return null;
      let startMins = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
      let endMins = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
      if (endMins <= startMins) endMins += 1440; // midnight crossing
      return { id: log.id, duration_minutes: endMins - startMins };
    }).filter(Boolean);

    // Bulk update in batches of 500
    let updated = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.InvestigationLog.bulkUpdate(batch);
      updated += batch.length;
    }

    return Response.json({
      status: 'success',
      total_logs_scanned: allLogs.length,
      logs_with_zero_duration: needsFix.length,
      updated: updated,
      has_more: allLogs.length === 500,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});