import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { brandedWrapper, heading, p, dataTable, callout, escapeHtml as escHtml, getAppBaseUrl, ctaButton } from '../../shared/emailStyling.ts';

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

    const baseUrl = await getAppBaseUrl(base44);
    const rows = alerts.map(a => [
      a.job_name,
      a.asset_name,
      a.compliance_status === 'expired' ? `<strong style="color:#e11d48">Expired</strong>` :
      a.compliance_status === 'expiring' ? `<strong style="color:#d97706">Expiring</strong>` :
      escHtml(a.compliance_status),
      a.expiry || '—',
    ]);
    const content = heading('Asset Compliance Alert') +
      p(`${alerts.length} non-compliant asset${alerts.length !== 1 ? 's' : ''} found across ${activeJobs.length} active job${activeJobs.length !== 1 ? 's' : ''}.`) +
      callout('Expired or expiring assets may not be legally operable on site. Update compliance status in Settings → Assets.', 'warning') +
      dataTable(['Job', 'Asset', 'Status', 'Expiry'], rows) +
      (baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/assets', 'Open Assets Hub')}</div>` : '');

    const emailHtml = brandedWrapper(content, { banner_subtitle: 'Asset Compliance', headerVariant: 'amber' });
    var subject = 'Asset Compliance Alert — ' + alerts.length + ' non-compliant asset' + (alerts.length !== 1 ? 's' : '') + ' on active jobs';

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: to, subject: subject, html: emailHtml });
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