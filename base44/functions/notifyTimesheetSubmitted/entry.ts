import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillSuccess, pillWarning,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow, formatGBP
} from '../../shared/emailStyling.ts';

function fmtHours(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return h + 'h ' + r + 'm';
  if (h) return h + 'h';
  return m > 0 ? r + 'm' : '—';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'timesheet_submitted' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    let summaries = body.summaries;
    let staffId = body.staff_id;
    let date = body.date;

    if (!summaries && body.data) {
      summaries = [body.data];
      staffId = staffId || body.data.staff_id;
      date = date || body.data.date;
    }

    if (!summaries || summaries.length === 0 || !staffId) return Response.json({ skipped: true, reason: 'No timesheet data' });

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staffId });
    const staff = staffList[0];

    let recipients = [];
    if (staff && staff.manager_id) {
      const mgrList = await base44.asServiceRole.entities.Staff.filter({ id: staff.manager_id });
      if (mgrList[0] && mgrList[0].email) recipients.push(mgrList[0].email);
    }
    if (recipients.length === 0) {
      const users = await base44.asServiceRole.entities.User.list();
      recipients = users.filter(u => u.role === 'admin' && u.email).map(u => u.email);
    }
    if (recipients.length === 0) return Response.json({ skipped: true, reason: 'No recipients' });

    const staffName = staff ? staff.name : 'Unknown crew member';

    const jobIds = [...new Set(summaries.map(s => s.job_id).filter(Boolean))];
    const jobs = [];
    for (let i = 0; i < jobIds.length; i++) {
      const jl = await base44.asServiceRole.entities.Job.filter({ id: jobIds[i] });
      if (jl[0]) jobs.push(jl[0]);
    }
    const jobNameOf = (jid) => { const j = jobs.find(x => x.id === jid); return j ? j.name : 'Unknown job'; };

    const totalMins = summaries.reduce((s, t) => s + (Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0)), 0);
    const totalMeterage = summaries.reduce((s, t) => s + (Number(t.meterage) || 0), 0);

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'timesheet_submitted' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const dateStr = date || summaries[0].date || '—';

    // Build rich HTML with stat tiles + data table
    const tableRows = summaries.map(s => {
      const jobName = jobNameOf(s.job_id);
      const mins = Number(s.task_duration_minutes) || (s.total_hours ? s.total_hours * 60 : 0);
      const meterage = Number(s.meterage) || 0;
      const otBadge = s.is_overtime ? html(pillWarning('OT')) : '';
      return [jobName, fmtHours(mins), meterage > 0 ? meterage + 'm' : '—', otBadge || '—'];
    });

    const shiftsTable = dataTable(['Job', 'Hours', 'Meterage', 'Type'], tableRows);

    const bodyHtml =
      heading('Daily timesheet submitted') +
      p('A daily timesheet has been submitted by ' + staffName + ' for ' + dateStr + ' and is ready for your approval.') +
      statTileRow([
        { label: 'Total Hours', value: fmtHours(totalMins), icon: '⏱', color: '#2E5A1A' },
        { label: 'Jobs', value: String(summaries.length), icon: '📋', color: '#2563eb' },
        ...(totalMeterage > 0 ? [{ label: 'Meterage', value: totalMeterage + 'm', icon: '⛏', color: '#059669' }] : []),
      ]) +
      sectionCard('Shift Breakdown', shiftsTable, { titleBg: '#2E5A1A' }) +
      helpTip('What to do next', 'Open the planner to review this timesheet. Check the hours and meterage match what you expect. Approve to send to payroll, or query it back to the crew member with a note if something looks wrong.') +
      linkBlock(baseUrl, '/admin', 'Open Planner');

    const subject = cfg.subject
      ? cfg.subject.replace(/\{staff_name\}/g, staffName).replace(/\{date\}/g, dateStr)
      : 'Daily timesheet submitted by ' + staffName + ' (' + dateStr + ')';

    const baseUrl = await getAppBaseUrl(base44);

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? (() => {
          const jobLines = summaries.map(s => {
            const jobName = jobNameOf(s.job_id);
            const mins = Number(s.task_duration_minutes) || (s.total_hours ? s.total_hours * 60 : 0);
            const meterage = Number(s.meterage) || 0;
            let line = '• Job: ' + jobName + ' — ' + fmtHours(mins);
            if (meterage > 0) line += ' · ' + meterage + 'm';
            if (s.is_overtime) line += ' (overtime)';
            return line;
          }).join('\n');
          const text = cfg.template
            .replace(/\{staff_name\}/g, staffName).replace(/\{date\}/g, dateStr)
            .replace(/\{total_hours\}/g, fmtHours(totalMins))
            .replace(/\{job_summary\}/g, jobLines);
          return escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
        })()
      : bodyHtml;

    let notified = 0;
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to, subject,
          body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'brand', banner_subtitle: 'Timesheet Approval · ' + dateStr })
        });
        notified++;
      } catch (e) {}
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});