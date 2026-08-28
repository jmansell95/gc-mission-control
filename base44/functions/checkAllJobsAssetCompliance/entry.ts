import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    // Get all in-progress jobs
    const jobs = await base44.asServiceRole.entities.Job.list();
    const activeJobs = jobs.filter(j => j.status === 'in_progress');

    if (activeJobs.length === 0) {
      return Response.json({ sent: false, reason: 'No active jobs', checked: 0 });
    }

    // Get all asset assignments and site assets in bulk
    const allAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list();
    const allAssets = await base44.asServiceRole.entities.SiteAsset.list();
    const assetMap = {};
    allAssets.forEach(a => { assetMap[a.id] = a; });

    const today = new Date().toISOString().split('T')[0];
    const alerts = [];

    activeJobs.forEach(job => {
      const jobAssignments = allAssignments.filter(a => a.job_id === job.id);
      jobAssignments.forEach(a => {
        const asset = assetMap[a.asset_id];
        const liveStatus = asset?.compliance_status || a.compliance_status || 'unknown';
        const expiry = asset?.compliance_expiry_date || null;

        // Skip date-based derivation for machinery/trailers (CoC lasts lifetime of equipment)
        const isEvergreen = asset?.asset_type === 'machinery' || asset?.asset_type === 'trailer' ||
          a.asset_type === 'machinery' || a.asset_type === 'trailer';
        let effectiveStatus = liveStatus;
        if (!isEvergreen && expiry && liveStatus !== 'expired') {
          if (expiry < today) {
            effectiveStatus = 'expired';
          } else {
            const daysUntil = Math.ceil((new Date(expiry) - new Date(today)) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 30) {
              effectiveStatus = 'expiring';
            } else {
              effectiveStatus = 'compliant';
            }
          }
        }

        if (effectiveStatus !== 'compliant') {
          alerts.push({
            job_name: job.name,
            asset_name: a.asset_name || asset?.name || 'Unknown',
            asset_type: a.asset_type || asset?.asset_type,
            role: a.role,
            compliance_status: effectiveStatus,
            expiry: expiry,
          });
        }
      });
    });

    if (alerts.length === 0) {
      return Response.json({ sent: false, reason: 'All assets compliant', checked: activeJobs.length });
    }

    // Send email to all admins
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');
    const recipients = admins.map(u => u.email).filter(Boolean);

    if (recipients.length === 0) {
      return Response.json({ sent: false, reason: 'No admin recipients', checked: activeJobs.length, alerts });
    }

    const alertRows = alerts.map(a =>
      '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">' + escapeHtml(a.job_name) + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">' + escapeHtml(a.asset_name) + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-transform:capitalize">' + escapeHtml(a.compliance_status) + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">' + (a.expiry ? escapeHtml(a.expiry) : '\u2014') + '</td></tr>'
    ).join('');

    var bodyHtml =
      '<h2 style="margin:0 0 12px;color:#0e7a4f;font-size:16px">Asset Compliance Alert</h2>' +
      '<p style="margin:0 0 16px;color:#475569;font-size:14px">' + alerts.length + ' non-compliant asset' + (alerts.length !== 1 ? 's' : '') +
      ' found across ' + activeJobs.length + ' active job' + (activeJobs.length !== 1 ? 's' : '') + '.</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Arial,Helvetica,sans-serif">' +
      '<thead><tr style="background:#0e7a4f;color:#fff">' +
      '<th style="padding:8px 12px;text-align:left">Job</th>' +
      '<th style="padding:8px 12px;text-align:left">Asset</th>' +
      '<th style="padding:8px 12px;text-align:left">Status</th>' +
      '<th style="padding:8px 12px;text-align:left">Expiry</th>' +
      '</tr></thead><tbody>' + alertRows + '</tbody></table>' +
      '<p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Check GC Compliance Manager for full details and update asset compliance status in Settings \u2192 Assets.</p>';

    var emailHtml =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
      '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
      '<tr><td style="background:#0e7a4f;padding:18px 24px"><h1 style="margin:0;color:#fff;font-size:18px">GC Mission Control</h1></td></tr>' +
      '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + bodyHtml + '</td></tr>' +
      '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">GC Mission Control</td></tr>' +
      '</table></body></html>';

    var subject = 'Asset Compliance Alert \u2014 ' + alerts.length + ' non-compliant asset' + (alerts.length !== 1 ? 's' : '') + ' on active jobs';

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: to, subject: subject, body: emailHtml });
    }

    return Response.json({
      sent: true,
      checked: activeJobs.length,
      alertCount: alerts.length,
      notifiedRecipients: recipients.length,
      alerts: alerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});