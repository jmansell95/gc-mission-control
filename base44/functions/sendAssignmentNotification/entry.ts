import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillWarning, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

const DEFAULT_ASSIGNMENT_TEMPLATE = "Hi {staff_name},\n\nYou have a new shift:\n\nJob: {job_name}\nLocation: {location}\nDate: {date}\nType: {job_type}\n{notes}\n\nPlease review the details and check your app for the full schedule.\n\nGC Mission Control";

function pillNeutral(text) { return statusPill(text, '#2E5A1A'); }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const data = body.data || body;
    const staffId = data.staff_id;
    const jobId = data.job_id;
    const assignedDate = data.assigned_date;

    if (!staffId || !jobId) {
      return Response.json({ skipped: true, reason: 'Missing staff_id or job_id' });
    }

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staffId });
    const staff = staffList[0];
    if (!staff || !staff.email) {
      return Response.json({ skipped: true, reason: 'Staff not found or no email' });
    }
    if (staff.email_notifications_enabled === false) {
      return Response.json({ skipped: true, reason: 'Staff unsubscribed from emails' });
    }

    const jobList = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    const job = jobList[0];
    if (!job) {
      return Response.json({ skipped: true, reason: 'Job not found' });
    }

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'assignment_notification' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled' });
    }
    const effectiveTemplate = (cfg && cfg.template) || DEFAULT_ASSIGNMENT_TEMPLATE;

    const dateObj = assignedDate ? new Date(assignedDate + 'T00:00:00') : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const notesLine = job.notes ? 'Notes: ' + job.notes : '';
    const text = effectiveTemplate
      .replace(/\{staff_name\}/g, staff.name)
      .replace(/\{job_name\}/g, job.name)
      .replace(/\{location\}/g, job.location)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{job_type\}/g, (job.job_type || 'general').replace(/_/g, ' '))
      .replace(/\{notes\}/g, notesLine);
    const subject = (cfg && cfg.subject)
      ? cfg.subject.replace(/\{job_name\}/g, job.name).replace(/\{staff_name\}/g, staff.name)
      : 'New Shift: ' + job.name;

    const baseUrl = await getAppBaseUrl(base44);

    // Build rich HTML content
    const jobTypeLabel = (job.job_type || 'general').replace(/_/g, ' ');
    const statusPillHtml = job.status === 'in_progress' ? pillSuccess('Active')
      : job.status === 'planning' ? pillInfo('Planning')
      : job.status === 'on_hold' ? pillWarning('On Hold')
      : job.status === 'completed' ? pillSuccess('Completed')
      : pillNeutral(job.status || 'Scheduled');

    const detailsTable = infoTable([
      ['Job', job.name],
      ['Location', job.location || '—'],
      ['Date', formattedDate],
      ['Type', jobTypeLabel],
      ['Status', html(statusPillHtml)],
      ['Project Manager', job.project_manager || '—'],
    ].filter(r => r[1] && r[1] !== '—'));

    const bodyHtml =
      heading('You have a new shift') +
      p('Hi ' + staff.name + ',') +
      p('You\'ve been assigned to a new shift. Here are the details:') +
      sectionCard('Shift Details', detailsTable, { titleBg: '#2E5A1A' }) +
      (job.notes ? callout(job.notes, 'info') : '') +
      helpTip('What to do next', 'Tap the button below to open your schedule in the app. On the day of your shift, use the app to sign in when you arrive on site, complete your daily checks, and log your hours.') +
      linkBlock(baseUrl, '/staff-schedule', 'View My Schedule');

    // If custom template text was provided, use it instead of the rich HTML body
    const finalHtml = (cfg && cfg.template)
      ? escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View My Schedule')
      : bodyHtml;

    const wrapperOpts = { ...cfg, headerVariant: 'brand', banner_subtitle: 'New Shift Assignment' };

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: brandedWrapper(finalHtml, wrapperOpts)
    });

    // Send a copy to configured recipients (managers/admins)
    const recipients = (cfg && cfg.recipient_emails) ? String(cfg.recipient_emails).split(',').map((e) => e.trim()).filter(Boolean) : [];
    let copies = 0;
    for (const email of recipients) {
      if (email === staff.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: brandedWrapper(finalHtml, wrapperOpts) });
        copies++;
      } catch (e) {}
    }

    return Response.json({ sent: true, to: staff.email, copies });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}