import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Backfill KeyLogBook Site Log Durations — one-time migration
// ============================================================
// Recomputes duration_minutes for ALL keylogbook_remarks InvestigationLogs
// where the duration is wrong:
//   1. Zero/null duration but both start_time and end_time are present
//   2. Duration >= 1440 (24h) — the old midnight-crossing bug added 1440
//      when end === start, inflating instantaneous activities to exactly 24h
//
// Paginates through ALL logs (500 per page) so one call fixes everything.
// Triggered manually by an admin from the Site Logs tab.
// ============================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let totalScanned = 0;
    let totalNeedsFix = 0;
    let totalUpdated = 0;
    let hasMore = true;
    let skip = 0;
    const PAGE_SIZE = 500;

    // Paginate through ALL keylogbook_remarks logs
    while (hasMore) {
      const page = await base44.asServiceRole.entities.InvestigationLog.filter(
        { source: 'keylogbook_remarks' },
        '-created_date',
        PAGE_SIZE,
        skip,
      );

      totalScanned += page.length;

      // Recompute EVERY keylogbook_remarks log that has both times.
      // The old midnight-crossing bug produced a range of wrong values
      // (0, 1440, and everything in between when logs were merged), so
      // we recompute all and only update where the value changes.
      const needsFix = page.filter(log => log.start_time && log.end_time);

      totalNeedsFix += needsFix.length;

      // Recompute duration with corrected midnight-crossing logic:
      //   end > start → normal duration
      //   end < start → midnight crossing (add 1440)
      //   end === start → 0 (instantaneous/missing end, NOT 24h)
      // Also cap any duration > 1200 min (20h) to 0 — no single activity
      // should exceed 20 hours; anything beyond is a data error.
      const updates = needsFix.map(log => {
        const m1 = String(log.start_time).match(/^(\d{1,2}):(\d{2})/);
        const m2 = String(log.end_time).match(/^(\d{1,2}):(\d{2})/);
        if (!m1 || !m2) return null;
        const startMins = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
        const endMins = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
        let duration: number;
        if (endMins > startMins) duration = endMins - startMins;
        else if (endMins < startMins) duration = (endMins + 1440) - startMins;
        else duration = 0;
        // Cap unreasonable durations (>20h = almost certainly a data error)
        if (duration > 1200) duration = 0;
        // Only update if the computed duration differs from the stored value
        const stored = Number(log.duration_minutes) || 0;
        if (duration === stored) return null;
        return { id: log.id, duration_minutes: duration };
      }).filter(Boolean);

      // Bulk update this page's fixes
      if (updates.length > 0) {
        await base44.asServiceRole.entities.InvestigationLog.bulkUpdate(updates);
        totalUpdated += updates.length;
      }

      if (page.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        skip += PAGE_SIZE;
      }
      // Safety cap at 10,000 to avoid timeout on very large datasets
      if (totalScanned >= 10000) break;
    }

    return Response.json({
      status: 'success',
      total_logs_scanned: totalScanned,
      logs_needing_fix: totalNeedsFix,
      updated: totalUpdated,
      has_more: hasMore,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});