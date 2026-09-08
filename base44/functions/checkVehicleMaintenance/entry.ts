import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillDanger, pillWarning, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'vehicle_maintenance' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled' });
    }
    if (!cfg.template) {
      return Response.json({ skipped: true, reason: 'No template configured for vehicle maintenance' });
    }
    const daysBefore = (cfg && cfg.days_before_warning) ? cfg.days_before_warning : 30;

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    let recipients = [];
    if (cfg && cfg.recipient_emails) {
      recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      recipients = admins.map(u => u.email);
    }
    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured' });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const alerts = [];
    vehicles.forEach(v => {
      const issues = [];
      if (v.mot_expiry) {
        const motDate = new Date(v.mot_expiry + 'T00:00:00');
        if (motDate < now) {
          issues.push({ type: 'MOT', status: 'OVERDUE', date: v.mot_expiry });
        } else if (motDate <= cutoff) {
          issues.push({ type: 'MOT', status: 'Due soon', date: v.mot_expiry });
        }
      }
      if (v.service_due_date) {
        const serviceDate = new Date(v.service_due_date + 'T00:00:00');
        if (serviceDate < now) {
          issues.push({ type: 'Service', status: 'OVERDUE', date: v.service_due_date });
        } else if (serviceDate <= cutoff) {
          issues.push({ type: 'Service', status: 'Due soon', date: v.service_due_date });
        }
      }
      if (issues.length > 0) {
        alerts.push({ vehicle: v.name, registration: v.registration_number, issues });
      }
    });

    if (alerts.length === 0) {
      return Response.json({ sent: false, reason: 'No maintenance alerts', checked: vehicles.length });
    }

    const overdueCount = alerts.reduce((s, a) => s + a.issues.filter(i => i.status === 'OVERDUE').length, 0);
    const dueSoonCount = alerts.reduce((s, a) => s + a.issues.filter(i => i.status === 'Due soon').length, 0);

    // Build rich HTML with stat tiles and data table
    const tableRows = alerts.map(a => {
      const issueText = a.issues.map(i => i.type + ': ' + i.status + ' (' + i.date + ')').join('; ');
      const hasOverdue = a.issues.some(i => i.status === 'OVERDUE');
      const pill = hasOverdue ? html(pillDanger('OVERDUE')) : html(pillWarning('Due Soon'));
      return [a.vehicle, a.registration, issueText, pill];
    });

    const alertsTable = dataTable(['Vehicle', 'Reg', 'Issues', 'Status'], tableRows);

    const bodyHtml =
      heading('Vehicle maintenance alert') +
      p('The following vehicles have maintenance items that are overdue or due within ' + daysBefore + ' days. Please arrange bookings to keep your fleet roadworthy and compliant.') +
      statTileRow([
        { label: 'Overdue', value: String(overdueCount), icon: '⚠', color: '#e11d48' },
        { label: 'Due Soon', value: String(dueSoonCount), icon: '⏰', color: '#d97706' },
        { label: 'Vehicles', value: String(alerts.length), icon: '🚐', color: '#2E5A1A' },
      ]) +
      (overdueCount > 0 ? callout(overdueCount + ' maintenance item(s) are OVERDUE. Vehicles with expired MOT or overdue service must not be driven on public roads.', 'danger') : '') +
      sectionCard('Vehicle Alerts', alertsTable, { titleBg: '#b45309' }) +
      helpTip('What to do next', 'Open the Fleet Hub to book maintenance appointments. For MOT, use the DVLA-verified booking flow. For services, contact your preferred garage. Assign a driver to take the vehicle to the appointment.') +
      linkBlock(await getAppBaseUrl(base44), '/fleet', 'Open Fleet Hub');

    const subject = cfg.subject
      ? cfg.subject.replace(/\{alert_count\}/g, String(alerts.length))
      : 'Vehicle Maintenance Alert — ' + alerts.length + ' vehicle(s) need attention';

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: brandedWrapper(bodyHtml, { ...cfg, headerVariant: 'amber', banner_subtitle: 'Fleet Maintenance' })
      });
    }

    return Response.json({ sent: true, alertCount: alerts.length, notifiedRecipients: recipients.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});