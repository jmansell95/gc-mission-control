import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillWarning,
  sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const abs = body.data || body;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'absence_request' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!abs || !abs.staff_id) return Response.json({ skipped: true, reason: 'No absence data' });

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: abs.staff_id });
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

    const staffName = staff ? staff.name : 'Unknown staff';
    const reason = (abs.reason || '').replace(/_/g, ' ');

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'absence_request' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const notesStr = abs.notes || '';
    const subject = cfg.subject ? cfg.subject.replace(/\{staff_name\}/g, staffName) : 'Absence request: ' + staffName;

    const baseUrl = await getAppBaseUrl(base44);

    // Rich HTML body
    const detailsTable = infoTable([
      ['Staff Member', staffName],
      ['From', abs.start_date || '—'],
      ['To', abs.end_date || '—'],
      ['Reason', reason],
      ['Notes', notesStr || '—'],
    ]);

    const bodyHtml =
      heading('New absence request') +
      p('A member of your team has submitted an absence request. Please review the details below and approve or decline it in the planner.') +
      sectionCard('Absence Details', detailsTable, { titleBg: '#b45309' }) +
      helpTip('What to do next', 'Open the planner to review this request. You can approve or decline it from the staff member\'s rota view. The staff member will be notified of your decision automatically.') +
      linkBlock(baseUrl, '/admin', 'Open Planner');

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{staff_name\}/g, staffName)
            .replace(/\{start_date\}/g, abs.start_date || '—')
            .replace(/\{end_date\}/g, abs.end_date || '—')
            .replace(/\{reason\}/g, reason)
            .replace(/\{notes\}/g, notesStr)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner')
      : bodyHtml;

    let notified = 0;
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'amber', banner_subtitle: 'Absence Request' })
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