import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  brandedWrapper, getAppBaseUrl, heading, p, helpTip,
  linkBlock, statTileRow, sectionCard, dataTable, pillWarning, html, BRAND
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const manual = !!body.manual;

    // Skip automation-control check when triggered manually from the dashboard
    if (!manual) {
      const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_timesheet_summary' });
      const ac = ctrl[0];
      if (ac && ac.enabled === false) {
        return Response.json({ skipped: true, reason: 'Automation disabled' });
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const staff = await base44.asServiceRole.entities.Staff.list();
    const jobs = await base44.asServiceRole.entities.Job.list();
    const todaysRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: todayStr });
    const todayTimesheets = await base44.asServiceRole.entities.Timesheet.filter({ date: todayStr });

    // Build per-staff status
    const byStaff = {};
    todaysRotas.forEach(a => {
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = [];
      byStaff[a.staff_id].push(a);
    });

    const submitted = [];
    const inProgress = [];
    const notStarted = [];

    staff.forEach(s => {
      const sAssignments = byStaff[s.id] || [];
      if (sAssignments.length === 0) return;
      const job = jobs.find(j => j.id === sAssignments[0]?.job_id);
      const jobName = job ? job.name : '—';
      const submittedTs = todayTimesheets.find(t => t.staff_id === s.id && t.is_summary && (t.status === 'submitted' || t.status === 'approved'));
      const arrived = sAssignments.some(a => a.arrived_on_site_at);
      const started = sAssignments.some(a => a.status === 'started');
      const completed = sAssignments.some(a => a.status === 'completed');
      const earlyLeave = sAssignments.some(a => a.early_leave_reason);
      const earlyLeaveReason = sAssignments.find(a => a.early_leave_reason)?.early_leave_reason || '';
      const submittedAt = submittedTs?.created_date ? new Date(submittedTs.created_date).toISOString().slice(11, 16) : '';
      const arrivedAt = sAssignments.map(a => a.arrived_on_site_at).filter(Boolean).sort()[0] || '';

      const row = { name: s.name, jobName, earlyLeave, earlyLeaveReason, submittedAt, arrivedAt: arrivedAt ? new Date(arrivedAt).toISOString().slice(11, 16) : '' };
      if (submittedTs) submitted.push(row);
      else if (started || completed || arrived) inProgress.push(row);
      else notStarted.push(row);
    });

    if (submitted.length === 0 && inProgress.length === 0 && notStarted.length === 0) {
      return Response.json({ skipped: true, reason: 'No staff on rota today' });
    }

    // Recipients: admins and managers (staff with system_role admin/manager) who have email + notifications enabled
    const recipients = staff
      .filter(s => (s.system_role === 'admin' || s.system_role === 'manager') && s.email && s.email_notifications_enabled !== false)
      .map(s => s.email);

    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured', submitted, inProgress, notStarted });
    }

    const baseUrl = await getAppBaseUrl(base44);
    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'timesheet_summary' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const subject = cfg.subject
      ? cfg.subject.replace(/\{date\}/g, todayStr)
      : 'Daily timesheet summary — ' + todayStr;

    // v2 branded body — stat tiles + per-status data tables
    const statsTiles = statTileRow([
      { label: 'Submitted', value: String(submitted.length), icon: '✓', color: '#059669' },
      { label: 'In Progress', value: String(inProgress.length), icon: '⏳', color: '#d97706' },
      { label: 'Not Started', value: String(notStarted.length), icon: '⬜', color: '#e11d48' },
      { label: 'Total on Rota', value: String(submitted.length + inProgress.length + notStarted.length), icon: '👥', color: '#2E5A1A' },
    ]);

    const buildTable = (rows) => {
      if (rows.length === 0) return p('None');
      const tableRows = rows.map(r => [
        r.name,
        r.jobName,
        r.submittedAt || r.arrivedAt || '—',
        r.earlyLeave ? html(pillWarning('Left early: ' + (r.earlyLeaveReason || '—'))) : '—',
      ]);
      return dataTable(['Staff', 'Job', 'Time', 'Notes'], tableRows);
    };

    const bodyHtml =
      heading('Daily timesheet summary for ' + todayStr) +
      (cfg.intro_message ? p(cfg.intro_message) : '') +
      statsTiles +
      sectionCard('✓ Submitted', buildTable(submitted), { titleBg: '#047857' }) +
      sectionCard('⏳ In Progress', buildTable(inProgress), { titleBg: '#b45309' }) +
      sectionCard('⬜ Not Started', buildTable(notStarted), { titleBg: '#be123c' }) +
      helpTip('What to do next', 'Review and approve pending timesheets in the Timesheets page. Follow up with any staff who haven\'t started their shift.') +
      linkBlock(baseUrl, '/admin', 'Open Timesheets');

    let sent = 0;
    const errors = [];
    for (const email of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: brandedWrapper(bodyHtml, { headerVariant: 'brand', banner_subtitle: 'Timesheet Summary · ' + todayStr, ...cfg })
        });
        sent++;
      } catch (e) {
        errors.push({ email, message: e.message });
      }
    }

    if (!manual) {
      const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_timesheet_summary' });
      const ac = ctrl[0];
      if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    }

    return Response.json({
      success: true,
      date: todayStr,
      recipients: sent,
      submitted: submitted.length,
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      errors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});