import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillSuccess, pillWarning,
  sectionCard, helpTip, heading, p, callout, html, dataTable
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_reminders' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) {
      return Response.json({ skipped: true, reason: 'Automation disabled' });
    }

    const staff = await base44.asServiceRole.entities.Staff.list();
    const jobs = await base44.asServiceRole.entities.Job.list();
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: todayStr });

    const byStaff = {};
    todaysRotas.forEach(r => {
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
      byStaff[r.staff_id].push(r);
    });

    const baseUrl = await getAppBaseUrl(base44);
    const dailyCfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'daily_reminder' });
    const dailyCfg = dailyCfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
    if (dailyCfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });
    let notified = 0;
    const skipped = [];

    for (const member of staff) {
      if (!member.email) { skipped.push({ name: member.name, reason: 'no email' }); continue; }
      if (member.email_notifications_enabled === false) { skipped.push({ name: member.name, reason: 'unsubscribed' }); continue; }
      const assignments = (byStaff[member.id] || []).filter(a => jobs.find(j => j.id === a.job_id));
      if (assignments.length === 0) continue;

      // Build rich HTML content with a data table
      const tableRows = assignments.map(a => {
        const job = jobs.find(j => j.id === a.job_id);
        const vehicle = vehicles.find(v => v.id === a.vehicle_id);
        const jobName = job ? job.name : 'Unknown job';
        const location = job ? job.location : '—';
        const time = (a.start_time || a.end_time) ? `${a.start_time || '—'}–${a.end_time || '—'}` : '—';
        const reg = vehicle ? vehicle.registration_number : '—';
        const statusBadge = a.shift_status === 'confirmed' ? html(pillSuccess('Confirmed'))
          : a.shift_status === 'declined' ? html(pillWarning('Declined'))
          : html(pillInfo('Pending'));
        return [jobName, location, time, reg, statusBadge];
      });

      const shiftsTable = dataTable(
        ['Job', 'Location', 'Time', 'Vehicle', 'Status'],
        tableRows
      );

      const bodyHtml =
        heading('Your schedule for today') +
        p('Hi ' + member.name + ',') +
        p('You have ' + assignments.length + ' shift' + (assignments.length > 1 ? 's' : '') + ' scheduled for today (' + todayStr + '). Here\'s what your day looks like:') +
        shiftsTable +
        helpTip('What to do next', 'Open the app to see full shift details. When you arrive on site, tap <strong>Sign In</strong> so the office knows you\'ve arrived safely. Complete your daily checks and POWRA before starting work.') +
        linkBlock(baseUrl, '/staff-schedule', 'View My Schedule');

      // If custom template is set, use it instead
      const finalHtml = (dailyCfg.template)
        ? (() => {
            const lines = assignments.map(a => {
              const job = jobs.find(j => j.id === a.job_id);
              const vehicle = vehicles.find(v => v.id === a.vehicle_id);
              const jobName = job ? job.name : 'Unknown job';
              const location = job ? job.location : '';
              const time = (a.start_time || a.end_time) ? ` · ${a.start_time || '—'}–${a.end_time || '—'}` : '';
              const reg = vehicle ? ` · ${vehicle.registration_number}` : '';
              return `   • ${jobName}${location ? ' — ' + location : ''}${time}${reg}`;
            }).join('\n');
            const text = dailyCfg.template
              .replace(/\{staff_name\}/g, member.name)
              .replace(/\{today_date\}/g, todayStr)
              .replace(/\{assignment_list\}/g, lines);
            return escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');
          })()
        : bodyHtml;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: member.email,
          subject: dailyCfg.subject ? dailyCfg.subject.replace(/\{staff_name\}/g, member.name).replace(/\{today_date\}/g, todayStr) : `Your schedule for today — ${assignments.length} shift${assignments.length > 1 ? 's' : ''}`,
          body: brandedWrapper(finalHtml, { ...dailyCfg, headerVariant: 'brand', banner_subtitle: 'Daily Schedule · ' + todayStr })
        });
        notified++;
      } catch (err) {
        skipped.push({ name: member.email, reason: err.message });
      }
    }

    // Send a combined daily schedule copy to configured recipients (managers/admins)
    const schedCfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_schedule' });
    const schedCfg = schedCfgList[0];
    const recipients = (schedCfg && schedCfg.recipient_emails) ? String(schedCfg.recipient_emails).split(',').map((e) => e.trim()).filter(Boolean) : [];
    let copies = 0;
    if (recipients.length > 0) {
      const validRotas = todaysRotas.filter((a) => jobs.find((j) => j.id === a.job_id));
      if (validRotas.length > 0) {
        const tableRows = validRotas.map((a) => {
          const job = jobs.find((j) => j.id === a.job_id);
          const member = staff.find((s) => s.id === a.staff_id);
          const vehicle = vehicles.find((v) => v.id === a.vehicle_id);
          const staffName = member ? member.name : '—';
          const jobName = job ? job.name : 'Unknown job';
          const location = job ? job.location : '—';
          const time = (a.start_time || a.end_time) ? `${a.start_time || '—'}–${a.end_time || '—'}` : '—';
          const reg = vehicle ? vehicle.registration_number : '—';
          return [staffName, jobName, location, time, reg];
        });

        const overviewTable = dataTable(
          ['Staff Member', 'Job', 'Location', 'Time', 'Vehicle'],
          tableRows
        );

        const bodyHtml =
          heading('Daily schedule overview') +
          p('Here\'s the full crew schedule for ' + todayStr + ':') +
          overviewTable +
          linkBlock(baseUrl, '/admin', 'Open Planner');

        for (const email of recipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: 'Daily schedule overview — ' + todayStr,
              body: brandedWrapper(bodyHtml, { ...(schedCfg || {}), headerVariant: 'blue', banner_subtitle: 'Crew Overview · ' + todayStr })
            });
            copies++;
          } catch (e) {}
        }
      }
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, date: todayStr, notified, copies, totalAssignments: todaysRotas.length, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});