import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Payroll Autopilot — runs nightly via scheduled automation.
 *
 * Stage 1 (nightly): merges each staff member's geotab_auto draft timesheets
 *   from today into a single daily summary entry (status 'submitted') so
 *   managers have one record to approve per person per day instead of many
 *   granular GPS pings.
 *
 * Stage 2 (Sunday night): merges the week's approved daily summaries into a
 *   single weekly summary record per staff member, ready for payroll export.
 *
 * Stage 3 (Monday 08:00): triggers the payroll export for the previous week.
 *   This is handled by a separate scheduled call with mode: 'export'.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'daily'; // 'daily' | 'weekly' | 'export'

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon

    if (mode === 'export') {
      // Monday morning — export the previous week's approved weekly summaries
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7 - dayOfWeek + 1);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const weekly = await base44.asServiceRole.entities.Timesheet.filter({
        is_weekly_summary: true,
        week_start: weekStartStr,
        status: 'approved',
      });

      if (weekly.length === 0) {
        return Response.json({ ok: true, mode: 'export', exported: 0, message: 'No approved weekly summaries to export' });
      }

      // Invoke the existing payroll export function
      const res = await base44.asServiceRole.functions.invoke('exportPayroll', {
        week_start: weekStartStr,
        timesheet_ids: weekly.map((t) => t.id),
      });

      return Response.json({ ok: true, mode: 'export', exported: weekly.length, week: weekStartStr, result: res.data });
    }

    if (mode === 'weekly') {
      // Sunday night — merge approved daily summaries into weekly records
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - dayOfWeek + 1); // Monday of this week
      if (dayOfWeek === 0) {
        // Sunday: week_start is today - 6
        weekStart.setDate(weekStart.getDate() - 6);
      }
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const summaries = await base44.asServiceRole.entities.Timesheet.filter({
        is_summary: true,
        is_weekly_summary: { $ne: true },
        week_start: weekStartStr,
        status: 'approved',
      });

      const byStaff = new Map<string, any[]>();
      summaries.forEach((s) => {
        const arr = byStaff.get(s.staff_id) || [];
        arr.push(s);
        byStaff.set(s.staff_id, arr);
      });

      let weeklyMerged = 0;
      for (const [staffId, entries] of byStaff) {
        const totalMinutes = entries.reduce((sum, e) => sum + (e.on_site_minutes || 0) || 0, 0);
        const meterage = entries.reduce((sum, e) => sum + (e.meterage || 0) || 0, 0);
        const weeklyIds = entries.map((e) => e.id).join(',');

        // Check if a weekly summary already exists (idempotent)
        const existing = await base44.asServiceRole.entities.Timesheet.filter({
          staff_id: staffId,
          is_weekly_summary: true,
          week_start: weekStartStr,
        });

        if (existing.length > 0) continue;

        await base44.asServiceRole.entities.Timesheet.create({
          staff_id: staffId,
          division_id: entries[0].division_id || '',
          date: weekStartStr,
          week_start: weekStartStr,
          is_summary: true,
          is_weekly_summary: true,
          weekly_entry_ids: weeklyIds,
          weekly_total_minutes: totalMinutes,
          weekly_meterage: meterage,
          status: 'submitted',
          source: 'geotab_auto',
        });

        // Mark daily summaries as merged
        await base44.asServiceRole.entities.Timesheet.updateMany(
          { _id: { $in: entries.map((e) => e.id) } },
          { $set: { status: 'merged' } },
        );
        weeklyMerged++;
      }

      return Response.json({ ok: true, mode: 'weekly', weeklyMerged, week: weekStartStr });
    }

    // Default: daily merge
    const drafts = await base44.asServiceRole.entities.Timesheet.filter({
      source: 'geotab_auto',
      status: 'draft',
      date: today,
    });

    const byStaff = new Map<string, any[]>();
    drafts.forEach((d) => {
      const arr = byStaff.get(d.staff_id) || [];
      arr.push(d);
      byStaff.set(d.staff_id, arr);
    });

    let dailyMerged = 0;
    for (const [staffId, entries] of byStaff) {
      // Only merge entries that have both start and end times (departure stamped)
      const complete = entries.filter((e) => e.start_time && e.end_time);
      if (complete.length === 0) continue;

      // Check if a daily summary already exists (idempotent)
      const existing = await base44.asServiceRole.entities.Timesheet.filter({
        staff_id: staffId,
        is_summary: true,
        is_weekly_summary: { $ne: true },
        date: today,
        source: 'geotab_auto',
      });
      if (existing.length > 0) continue;

      let totalMinutes = 0;
      complete.forEach((e) => {
        const [sh, sm] = (e.start_time || '').split(':').map(Number);
        const [eh, em] = (e.end_time || '').split(':').map(Number);
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins < 0) mins += 24 * 60;
        totalMinutes += mins;
      });

      const summaryIds = complete.map((e) => e.id).join(',');
      const jobIds = [...new Set(complete.map((e) => e.job_id).filter(Boolean))];

      await base44.asServiceRole.entities.Timesheet.create({
        staff_id: staffId,
        division_id: complete[0].division_id || '',
        job_id: jobIds[0] || '',
        date: today,
        week_start: complete[0].week_start || '',
        task_description: 'On site (auto-detected via Geotab)',
        total_hours: Math.round((totalMinutes / 60) * 100) / 100,
        on_site_minutes: totalMinutes,
        is_summary: true,
        summary_entry_ids: summaryIds,
        source: 'geotab_auto',
        status: 'submitted',
      });

      // Mark granular entries as merged
      await base44.asServiceRole.entities.Timesheet.updateMany(
        { _id: { $in: complete.map((e) => e.id) } },
        { $set: { status: 'merged' } },
      );
      dailyMerged++;
    }

    return Response.json({ ok: true, mode: 'daily', dailyMerged, date: today, draftsFound: drafts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}