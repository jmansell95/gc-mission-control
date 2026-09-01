import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, p, heading, callout } from '../../shared/emailStyling.ts';

/**
 * redirectRigToJob — staff self-redirect a rig from one site to another by
 * scanning its QR. Atomically:
 *   1. Marks the rig's current on_site/assigned JAA at the from-job as returned
 *   2. Creates a new JAA at the destination job with status 'on_site'
 *   3. Logs a SystemAuditLog entry
 *   4. Emails management (admins) a 'Staff self-redirect' notification
 *
 * Payload: { rig_id, from_job_id, to_job_id, staff_id, staff_name }
 * Returns: { success, returned_assignment_id, new_assignment_id, notified }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rigId = body?.rig_id;
    const fromJobId = body?.from_job_id;
    const toJobId = body?.to_job_id;
    const staffId = body?.staff_id || user.id;
    const staffName = body?.staff_name || user.full_name || '';

    if (!rigId || !fromJobId || !toJobId) {
      return Response.json({ error: 'rig_id, from_job_id and to_job_id are required' }, { status: 400 });
    }
    if (fromJobId === toJobId) {
      return Response.json({ error: 'Destination job is the same as the current job' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch the rig + both jobs (service role for cross-division read)
    const rig = await base44.asServiceRole.entities.SiteAsset.get(rigId);
    if (!rig) return Response.json({ error: 'Rig not found' }, { status: 404 });
    const fromJob = await base44.asServiceRole.entities.Job.get(fromJobId).catch(() => null);
    const toJob = await base44.asServiceRole.entities.Job.get(toJobId).catch(() => null);
    const fromJobName = fromJob?.name || fromJobId;
    const toJobName = toJob?.name || toJobId;

    // 1. Release the rig from its current job
    const current = await base44.asServiceRole.entities.JobAssetAssignment.filter({
      job_id: fromJobId,
      asset_id: rigId,
      status: { $in: ['on_site', 'assigned'] },
    });
    let returnedAssignmentId = '';
    if (current.length > 0) {
      await base44.asServiceRole.entities.JobAssetAssignment.update(current[0].id, {
        status: 'returned',
        returned_date: today,
        notes: `Self-redirected by ${staffName} to ${toJobName} via QR scan.`,
      });
      returnedAssignmentId = current[0].id;
    }

    // 2. Create the new on_site assignment at the destination job
    const newAssignment = await base44.asServiceRole.entities.JobAssetAssignment.create({
      job_id: toJobId,
      job_name: toJobName,
      asset_id: rigId,
      asset_name: rig.name || '',
      asset_type: 'rig',
      rig_type: rig.rig_type || 'n/a',
      role: 'primary_rig',
      compliance_status: rig.compliance_status || 'unknown',
      status: 'on_site',
      assigned_date: today,
      arrived_on_site_date: today,
      notes: `Self-redirected from ${fromJobName} by ${staffName} via QR scan.`,
    });

    // 3. Audit log
    try {
      await base44.asServiceRole.functions.invoke('logSystemAudit', {
        entity_name: 'JobAssetAssignment',
        entity_id: newAssignment.id,
        action: 'rig_self_redirect',
        source: 'qr_scan',
        actor_name: staffName,
        actor_user_id: staffId,
        details: `Rig "${rig.name}" self-redirected by ${staffName} from ${fromJobName} to ${toJobName}.`,
      });
    } catch (_) { /* non-blocking */ }

    // 4. Email admins (management notification)
    let notified = 0;
    try {
      const users = await base44.asServiceRole.entities.User.list();
      const admins = users.filter(u => u.role === 'admin' && u.email);
      if (admins.length > 0) {
        const baseUrl = await getAppBaseUrl(base44);
        const subject = `Staff self-redirect: ${rig.name} → ${toJobName}`;
        const bodyHtml =
          callout('Staff self-redirect — a crew member moved a rig between sites via QR scan.', 'warning') +
          heading('Rig movement details') +
          `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">` +
          `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:500;width:40%;vertical-align:top">Rig</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(rig.name)}</td></tr>` +
          `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:500;vertical-align:top">Redirected by</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(staffName)}</td></tr>` +
          `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:500;vertical-align:top">From job</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(fromJobName)}</td></tr>` +
          `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:500;vertical-align:top">To job</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(toJobName)}</td></tr>` +
          `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:500;vertical-align:top">Time</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }))}</td></tr>` +
          `</table>` +
          (baseUrl ? `<p style="margin-top:18px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/admin', 'Open planner')}</p>` : '');
        for (const u of admins) {
          try { await base44.asServiceRole.integrations.Core.SendEmail({ to: u.email, subject, body: brandedWrapper(bodyHtml, { banner_subtitle: 'Rig self-redirect' }) }); notified++; } catch (e) {}
        }
      }
    } catch (_) { /* non-blocking */ }

    return Response.json({
      success: true,
      returned_assignment_id: returnedAssignmentId,
      new_assignment_id: newAssignment.id,
      from_job: fromJobName,
      to_job: toJobName,
      notified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}