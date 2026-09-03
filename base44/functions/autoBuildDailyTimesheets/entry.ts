import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * autoBuildDailyTimesheets — the zero-touch timesheet engine.
 *
 * Runs on a schedule (22:00 daily). For every staff member who had an active
 * RotaAssignment today, collects all granular fragments (GPS geofence,
 * KeyLogBook entries, delivery completions, rota times) and merges them into
 * a single daily summary timesheet with a confidence score.
 *
 * High confidence → auto_submitted (eligible for green-path approval).
 * Medium confidence → submitted (manager review).
 * Low confidence → draft (staff nudge needed).
 *
 * Also runnable on-demand for a specific staff_id + date.
 */
function minutesBetween(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || todayDateStr();
    const targetStaffId = body.staff_id || null;

    // Use service role so this runs on a schedule without a user session
    const b = base44.asServiceRole;

    // Fetch all assignments for the target date
    const assignmentFilter: any = { assigned_date: targetDate };
    if (targetStaffId) assignmentFilter.staff_id = targetStaffId;

    const assignments = await b.entities.RotaAssignment.filter(assignmentFilter, '-assigned_date', 500);

    const results = {
      date: targetDate,
      processed: 0,
      auto_submitted: 0,
      submitted: 0,
      draft: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const assignment of assignments) {
      try {
        // Skip non-job assignments (leave, sick, training) — no timesheet needed
        if (assignment.assignment_type && assignment.assignment_type !== 'job') {
          results.skipped++;
          continue;
        }

        const staffId = assignment.staff_id;
        if (!staffId) { results.skipped++; continue; }

        // Check if a summary already exists for this staff+date — delete it
        // so we can rebuild with the full-day picture (on-site + travel + break
        // + overtime). The webhook may have created an on-site-only summary;
        // the scheduled run enhances it with GPS travel and auto-detected breaks.
        const existing = await b.entities.Timesheet.filter({
          staff_id: staffId,
          date: targetDate,
          is_summary: true,
        });
        if (existing && existing.length > 0) {
          for (const t of existing) {
            await b.entities.Timesheet.delete(t.id);
          }
        }

        // Collect all granular fragments for this staff+date
        const fragments = await b.entities.Timesheet.filter({
          staff_id: staffId,
          date: targetDate,
          is_summary: false,
          status: { $ne: 'deleted' },
        });

        // Collect KeyLogBook site activity logs for this staff+date — these
        // carry the driller's time-stamped on-site activities (the 8am–5pm
        // block). Their summed duration_minutes is the on-site time.
        let klbLogs: any[] = [];
        try {
          if (assignment.job_id) {
            klbLogs = await b.entities.InvestigationLog.filter({
              job_id: assignment.job_id,
              date: targetDate,
              source: 'keylogbook_remarks',
            });
          }
        } catch (e) { /* skip */ }
        const klbOnSiteMinutes = klbLogs.reduce((s: number, l: any) => s + (Number(l.duration_minutes) || 0), 0);
        if (klbOnSiteMinutes > 0) sources.add('keylogbook');

        // Collect sources
        const sources = new Set<string>();
        fragments.forEach((f: any) => {
          if (f.source === 'geotab_auto') sources.add('gps');
          if (f.source === 'keylogbook') sources.add('keylogbook');
          if (f.linked_delivery_id) sources.add('delivery');
        });

        // Check for Mitti verification
        if (assignment.mitti_powra_at) sources.add('mitti');
        if (assignment.mitti_vehicle_check_at) sources.add('mitti');

        // Rota-based fallback (depot staff or no fragments)
        if (fragments.length === 0 && klbLogs.length === 0) {
          sources.add('rota');
        }

        // Skip creating a summary when there is truly zero data — no
        // fragments, no GPS arrival, no KLB logs, no on-site minutes.
        if (fragments.length === 0 && klbLogs.length === 0 && !assignment.arrived_on_site_at && !assignment.left_site_at) {
          results.skipped++;
          continue;
        }

        // Calculate on-site duration — prefer KLB activity log durations (the
        // driller's actual timed activities), then GPS assignment timestamps,
        // then fragment durations as a last resort.
        let onSiteMinutes = 0;
        if (klbOnSiteMinutes > 0) {
          onSiteMinutes = klbOnSiteMinutes;
        } else if (assignment.arrived_on_site_at && assignment.left_site_at) {
          onSiteMinutes = minutesBetween(assignment.arrived_on_site_at, assignment.left_site_at);
        } else if (assignment.arrived_on_site_at) {
          // Still on site — calculate to now
          onSiteMinutes = minutesBetween(assignment.arrived_on_site_at, new Date().toISOString());
        }

        // Sum fragment durations as fallback
        if (onSiteMinutes === 0 && fragments.length > 0) {
          onSiteMinutes = fragments
            .filter((f: any) => f.task_type !== 'travel_to' && f.task_type !== 'travel_from' && !f.is_break)
            .reduce((sum: number, f: any) => sum + (f.task_duration_minutes || 0), 0);
        }

        // Travel minutes
        let travelToMinutes = 0;
        let travelFromMinutes = 0;
        fragments.forEach((f: any) => {
          if (f.task_type === 'travel_to') travelToMinutes += f.task_duration_minutes || 0;
          if (f.task_type === 'travel_from') travelFromMinutes += f.task_duration_minutes || 0;
        });

        // Break minutes
        const breakMinutes = fragments
          .filter((f: any) => f.is_break)
          .reduce((sum: number, f: any) => sum + (f.task_duration_minutes || 0), 0);

        // Payable travel (after 1.5h deductible for non-depot)
        let payableTravelMinutes = travelToMinutes + travelFromMinutes;
        const staffRecords = await b.entities.Staff.filter({ id: staffId });
        const staff = staffRecords[0];
        let isDepot = false;
        if (staff?.team_id) {
          const teams = await b.entities.Team.filter({ id: staff.team_id });
          if (teams[0]?.job_type === 'depot') isDepot = true;
        }
        if (!isDepot && payableTravelMinutes > 90) {
          payableTravelMinutes -= 90;
        } else if (!isDepot) {
          payableTravelMinutes = 0;
        }

        const totalMinutes = onSiteMinutes + payableTravelMinutes;

        // Meterage from fragments
        const meterage = fragments.reduce((sum: number, f: any) => sum + (f.meterage || 0), 0);

        // Confidence scoring
        let confidence = 0;
        if (sources.has('gps')) confidence += 30;
        if (sources.has('keylogbook')) confidence += 25;
        if (sources.has('delivery')) confidence += 25;
        if (sources.has('mitti')) confidence += 15;
        if (sources.has('rota') && sources.size === 1) confidence += 20; // rota-only = low confidence
        if (assignment.arrived_on_site_at && assignment.left_site_at) confidence += 10;
        if (fragments.length === 0 && !assignment.arrived_on_site_at) confidence = 0;
        confidence = Math.min(100, confidence);

        // Determine status based on confidence
        let status: string;
        if (confidence >= 80) status = 'auto_submitted';
        else if (confidence >= 40) status = 'submitted';
        else status = 'draft';

        // Inherit overtime from the rota assignment — weekend shifts or
        // explicitly-flagged overtime shifts carry the rate_multiplier.
        const isOvertime = !!assignment.is_overtime;
        const rateMultiplier = assignment.rate_multiplier != null && assignment.rate_multiplier !== ''
          ? Number(assignment.rate_multiplier) : null;

        // Create the summary entry
        const summary: Record<string, any> = {
          staff_id: staffId,
          division_id: staff?.division_id || null,
          job_id: assignment.job_id || '',
          date: targetDate,
          week_start: weekStart(targetDate),
          task_description: 'Auto-built daily summary',
          is_summary: true,
          is_weekly_summary: false,
          summary_entry_ids: fragments.map((f: any) => f.id).join(','),
          on_site_minutes: onSiteMinutes,
          travel_to_minutes: travelToMinutes,
          travel_from_minutes: travelFromMinutes,
          payable_travel_minutes: payableTravelMinutes,
          break_minutes: breakMinutes,
          total_hours: Math.round((totalMinutes / 60) * 100) / 100,
          meterage: meterage || assignment.meterage || null,
          // Source reflects the dominant data source that backed the auto-build,
          // so the audit trail is accurate instead of always saying 'keylogbook'.
          source: sources.has('gps') ? 'geotab_auto'
            : sources.has('keylogbook') ? 'keylogbook'
            : sources.has('delivery') ? 'geotab_auto'
            : 'staff',
          status,
          approved_by_name: null,
          // New auto-build fields
          auto_built: true,
          auto_built_sources: Array.from(sources).join(','),
          confidence_score: confidence,
        };

        if (isOvertime) {
          summary.is_overtime = true;
          if (rateMultiplier != null) summary.rate_multiplier = rateMultiplier;
          summary.overtime_pending = true;
        }

        await b.entities.Timesheet.create(summary);

        // Mark granular fragments as merged
        if (fragments.length > 0) {
          await b.entities.Timesheet.bulkUpdate(
            fragments.map((f: any) => ({ id: f.id, status: 'merged' }))
          );
        }

        results.processed++;
        if (status === 'auto_submitted') results.auto_submitted++;
        else if (status === 'submitted') results.submitted++;
        else results.draft++;
      } catch (e) {
        results.errors.push(`Assignment ${assignment.id}: ${e.message}`);
      }
    }

    return Response.json({ success: true, ...results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});