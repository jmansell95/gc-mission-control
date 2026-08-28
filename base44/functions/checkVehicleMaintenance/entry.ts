import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#0e7a4f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}
function styledHtml(rawBodyHtml, cfg) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Mission Control';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Mission Control';
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + rawBodyHtml + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}
async function getAppBaseUrl(base44) {
  try { const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' }); return (list[0] && list[0].app_base_url) || ''; } catch (e) { return ''; }
}

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
    // Only the configured template is sent — no default fallback.
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

    let alertList = '';
    alerts.forEach(a => {
      alertList += a.vehicle + ' (' + a.registration + '):\n';
      a.issues.forEach(issue => {
        alertList += '  - ' + issue.type + ': ' + issue.status + ' (due ' + issue.date + ')\n';
      });
      alertList += '\n';
    });

    const subject = cfg.subject
      ? cfg.subject.replace(/\{alert_count\}/g, String(alerts.length))
      : 'Vehicle Maintenance Alert - ' + alerts.length + ' vehicle(s) need attention';
    const text = cfg.template
      .replace(/\{alert_count\}/g, String(alerts.length))
      .replace(/\{alert_list\}/g, alertList);

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(bodyHtml, cfg)
      });
    }

    return Response.json({ sent: true, alertCount: alerts.length, notifiedRecipients: recipients.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});