import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createApproval } from '../../shared/inboxEngine.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, date } = body;
    if (!staff_id || !date) return Response.json({ error: 'staff_id and date required' }, { status: 400 });

    // Verify the caller is the staff member or an admin
    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staff_id });
    const staff = staffList[0];
    if (!staff) return Response.json({ error: 'Staff not found' }, { status: 404 });
    if (staff.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if staff is in a depot team (depot teams don't get the 1.5h travel deduction)
    let isDepot = false;
    if (staff.team_id) {
      const teamList = await base44.asServiceRole.entities.Team.filter({ id: staff.team_id });
      if (teamList[0] && teamList[0].job_type === 'depot') isDepot = true;
    }

    // Load BusinessConfig for required hours & travel deductible
    let REQUIRED_WORK_MINS = 540; // 9 hours default
    let TRAVEL_DEDUCTIBLE = 90;   // 1.5 hours default
    try {
      const bizConfigs = await base44.asServiceRole.entities.BusinessConfig.filter({ key: 'global' });
      const bizConfig = bizConfigs?.[0];
      if (bizConfig) {
        if (bizConfig.required_daily_on_site_minutes != null) REQUIRED_WORK_MINS = Number(bizConfig.required_daily_on_site_minutes);
        if (bizConfig.travel_deductible_minutes != null) TRAVEL_DEDUCTIBLE = Number(bizConfig.travel_deductible_minutes);
      }
    } catch (e) { /* use defaults */ }

    // Fetch all draft entries for this staff+date
    const drafts = await base44.asServiceRole.entities.Timesheet.filter({ staff_id, date, status: 'draft' });

    // Fetch rota assignments for this staff+date to inherit overtime status & rate
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ staff_id, assigned_date: date });

    if (drafts.length === 0) {
      return Response.json({ success: true, summaries: [], message: 'No drafts to submit' });
    }

    // Separate by type
    const onSiteTasks = drafts.filter(t => !t.is_break && (!t.task_type || t.task_type === 'on_site'));
    const travelTo = drafts.find(t => t.task_type === 'travel_to');
    const travelFrom = drafts.find(t => t.task_type === 'travel_from');
    // Break entries — used to set break_minutes on the summary so the
    // green-path auto-approval check (break_minutes >= 30) can pass.
    // Without this, every staff-submitted summary has break_minutes: null
    // and green-path auto-approval never fires.
    const breakEntries = drafts.filter(t => t.is_break);
    const breakMinutesTotal = breakEntries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);

    if (onSiteTasks.length === 0 && !travelTo && !travelFrom) {
      return Response.json({ success: true, summaries: [], message: 'No tasks to submit' });
    }

    // ── on-site validation (threshold from BusinessConfig) ──
    // On-site work excludes travel_to / travel_from. Staff may submit under the
    // required threshold ONLY if they recorded an early-leave reason on their rota assignment.
    const onSiteMinsTotal = onSiteTasks.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
    const meetsRequiredHours = onSiteMinsTotal >= REQUIRED_WORK_MINS;

    // Check for an early-leave reason across today's assignments
    let earlyLeaveReason = '';
    for (const a of assignments) {
      if (a.early_leave_reason) { earlyLeaveReason = String(a.early_leave_reason); break; }
    }

    if (!meetsRequiredHours && !earlyLeaveReason) {
      return Response.json({
        error: `On-site work is under ${(REQUIRED_WORK_MINS / 60)} hours and no early-leave reason was recorded. Use the Leave Site Early button on your job card to record why you left early, or add the missing tasks.`,
        code: 'UNDER_9H_NO_EARLY_LEAVE',
        on_site_minutes: onSiteMinsTotal,
        required_minutes: REQUIRED_WORK_MINS
      }, { status: 422 });
    }

    // Calculate travel times (deductible loaded from BusinessConfig above)
    const travelToMins = travelTo ? (Number(travelTo.task_duration_minutes) || 0) : 0;
    const travelFromMins = travelFrom ? (Number(travelFrom.task_duration_minutes) || 0) : 0;
    const payableTravelTo = isDepot ? travelToMins : Math.max(0, travelToMins - TRAVEL_DEDUCTIBLE);
    const payableTravelFrom = isDepot ? travelFromMins : Math.max(0, travelFromMins - TRAVEL_DEDUCTIBLE);
    const payableTravelTotal = payableTravelTo + payableTravelFrom;

    // Group on-site tasks by job
    const byJob = {};
    onSiteTasks.forEach(t => {
      const jid = t.job_id || 'no_job';
      if (!byJob[jid]) byJob[jid] = [];
      byJob[jid].push(t);
    });

    // Compute the Monday of the week for this date (matches utils/overtime weekKey)
    const _d = new Date(date + 'T00:00:00');
    const _day = _d.getDay();
    const _diff = _day === 0 ? 6 : _day - 1;
    const _monday = new Date(_d);
    _monday.setDate(_d.getDate() - _diff);
    const weekStart = `${_monday.getFullYear()}-${String(_monday.getMonth() + 1).padStart(2, '0')}-${String(_monday.getDate()).padStart(2, '0')}`;

    const jobIds = Object.keys(byJob);
    const summaries = [];

    for (let i = 0; i < jobIds.length; i++) {
      const jid = jobIds[i];
      const jobTasks = byJob[jid];
      const onSiteMins = jobTasks.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
      const meterage = jobTasks.reduce((s, t) => s + (Number(t.meterage) || 0), 0);
      const entryIds = jobTasks.map(t => t.id);
      const hasTravel = i === 0 && (travelTo || travelFrom);

      const totalMins = onSiteMins + (hasTravel ? payableTravelTotal : 0);

      const summaryData = {
        staff_id,
        job_id: jid === 'no_job' ? '' : jid,
        date,
        week_start: weekStart,
        task_description: 'Daily Summary',
        task_duration_minutes: totalMins,
        total_hours: Math.round((totalMins / 60) * 100) / 100,
        on_site_minutes: onSiteMins,
        break_minutes: breakMinutesTotal || 0,
        status: 'submitted',
        is_summary: true,
        summary_entry_ids: entryIds.join(','),
        meterage: meterage || 0,
        notes: jobTasks.map(t => t.task_description).filter(Boolean).join('; ')
      };

      if (hasTravel) {
        summaryData.travel_to_minutes = travelToMins;
        summaryData.travel_from_minutes = travelFromMins;
        summaryData.payable_travel_minutes = payableTravelTotal;
        if (travelTo) {
          summaryData.travel_depart_home = travelTo.start_time;
          summaryData.travel_arrive_site = travelTo.end_time;
        }
        if (travelFrom) {
          summaryData.travel_depart_site = travelFrom.start_time;
          summaryData.travel_arrive_home = travelFrom.end_time;
        }
      }

      // Inherit overtime flag & rate from the matching rota assignment
      const matchingAssignment = jid !== 'no_job' ? assignments.find(a => a.job_id === jid) : null;
      if (matchingAssignment && matchingAssignment.is_overtime) {
        summaryData.is_overtime = true;
        if (matchingAssignment.rate_multiplier != null && matchingAssignment.rate_multiplier !== '') {
          summaryData.rate_multiplier = Number(matchingAssignment.rate_multiplier);
        }
      }

      const summary = await base44.asServiceRole.entities.Timesheet.create(summaryData);
      summaries.push(summary);
    }

    // Mark ALL drafts (on-site, breaks, travel) as merged
    const allDraftIds = drafts.map(t => t.id);
    if (allDraftIds.length > 0) {
      await base44.asServiceRole.entities.Timesheet.bulkUpdate(
        allDraftIds.map(id => ({ id, status: 'merged' }))
      );
    }

    // Send ONE consolidated daily notification (not one per task or per job)
    try {
      await base44.asServiceRole.functions.invoke('notifyTimesheetSubmitted', { summaries, staff_id: staff_id, date });
    } catch (e) { /* notification failure shouldn't block submission */ }

    // ── Create inbox approval for the manager to approve the timesheet ──
    try {
      const totalHours = summaries.reduce((s, x) => s + (Number(x.total_hours) || 0), 0);
      await createApproval(base44, {
        approvalType: 'timesheet',
        requesterStaffId: staff_id,
        title: `Timesheet for ${staff.name} — ${date} (${totalHours.toFixed(1)}h)`,
        body: `${staff.name} submitted their daily timesheet for ${date}. Total: ${totalHours.toFixed(1)} hours across ${summaries.length} job(s). Please review and approve.`,
        sourceHub: 'staff',
        sourceEntity: 'Timesheet',
        sourceId: summaries[0]?.id || '',
        deepLink: '/staff?tab=timesheets',
        priority: 'normal',
      });
    } catch (_) { /* don't block submission on inbox failure */ }

    return Response.json({ success: true, summaries, merged_count: allDraftIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});