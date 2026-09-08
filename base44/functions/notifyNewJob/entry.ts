import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const job = body.data || body;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'new_job_alert' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!job || !job.name) return Response.json({ skipped: true, reason: 'No job data' });

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'No admins' });

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'new_job' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const jobType = (job.job_type || '').replace(/_/g, ' ');
    const ref = job.job_reference || '';
    const subject = cfg.subject ? cfg.subject.replace(/\{job_name\}/g, job.name) : 'New Job Created: ' + job.name;

    const baseUrl = await getAppBaseUrl(base44);

    // Rich HTML body
    const statusBadge = job.status === 'in_progress' ? html(pillInfo('In Progress'))
      : job.status === 'planning' ? html(pillInfo('Planning'))
      : html(pillInfo(job.status || 'Planning'));

    const detailsTable = infoTable([
      ['Job Name', job.name],
      ['Reference', ref || '—'],
      ['Location', job.location || '—'],
      ['Type', jobType || '—'],
      ['Start Date', job.start_date || '—'],
      ['End Date', job.end_date || '—'],
      ['Status', statusBadge],
      ['Project Manager', job.project_manager || '—'],
    ].filter(r => r[1] && r[1] !== '—'));

    const bodyHtml =
      heading('New job created') +
      p('A new job has been created in the system. Review the details below and start planning crew and equipment assignments.') +
      sectionCard('Job Details', detailsTable, { titleBg: '#2E5A1A' }) +
      (job.notes ? callout(job.notes, 'info') : '') +
      helpTip('What to do next', 'Open the planner to assign crew and equipment to this job. Check the job\'s required teams and disciplines, then build the rota for the project duration.') +
      linkBlock(baseUrl, '/admin', 'Open Planner');

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{job_name\}/g, job.name).replace(/\{location\}/g, job.location || '—')
            .replace(/\{job_type\}/g, jobType).replace(/\{start_date\}/g, job.start_date || '—')
            .replace(/\{end_date\}/g, job.end_date || '—').replace(/\{job_reference\}/g, ref)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner')
      : bodyHtml;

    let notified = 0;
    for (const u of admins) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email, subject,
          body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'emerald', banner_subtitle: 'New Job' })
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