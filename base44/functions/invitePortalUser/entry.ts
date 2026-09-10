import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// invitePortalUser — invites a client or subcontractor contact
// as a real platform user for secure portal login. Stores the
// resulting user_id on the Client/Contractor record and sends
// a branded welcome email with the portal login link.
//
// Called from the redesigned PortalLinkManager "Secure Login"
// mode in the job Links tab.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { recipient_type, job_id, email, name, portal_base_url } = body;
    // recipient_type: 'client' | 'subcontractor'

    if (!email || !recipient_type || !job_id) {
      return Response.json({ error: 'Email, recipient type, and job ID are required' }, { status: 400 });
    }

    // 1. Fetch the job to find the client/contractor
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // 2. Invite the user via the platform
    let result = 'sent';
    try {
      await base44.users.inviteUser(email, 'user');
    } catch (inviteErr: any) {
      const msg = String(inviteErr?.message || '');
      if (msg.match(/already|exists/i)) {
        result = 'resent';
      } else {
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    // 3. Find the user by email to get their user_id
    let portalUserId = '';
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email });
      if (users && users[0]) portalUserId = users[0].id;
    } catch (e) { /* best-effort */ }

    // 4. Store the user_id on the Client or Contractor record
    const nowIso = new Date().toISOString();
    let recordName = '';
    if (recipient_type === 'client' && job.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: job.client_id });
      if (clients[0]) {
        await base44.asServiceRole.entities.Client.update(clients[0].id, {
          portal_user_id: portalUserId,
          portal_invited_at: nowIso,
        });
        recordName = clients[0].name;
      }
    } else if (recipient_type === 'subcontractor' && job.contractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: job.contractor_id });
      if (contractors[0]) {
        await base44.asServiceRole.entities.Contractor.update(contractors[0].id, {
          portal_user_id: portalUserId,
          portal_invited_at: nowIso,
        });
        recordName = contractors[0].name;
      }
    }

    // 5. Send the welcome email with the portal login link
    const portalUrl = `${portal_base_url || ''}/portal`;
    const heading = recipient_type === 'subcontractor'
      ? 'Your secure site portal is ready'
      : 'Your secure project portal is ready';
    const intro = recipient_type === 'subcontractor'
      ? `You've been invited to access <strong>${job.name}</strong> and other jobs you're working on. Log in anytime to view schedules, site photos, documents and progress.`
      : `You've been invited to follow live progress on <strong>${job.name}</strong> and other projects. Log in anytime to view schedules, milestones, site photos and documents.`;

    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `Secure portal access for ${job.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
            <div style="background:linear-gradient(135deg,#2E5A1A,#1c4a12);padding:20px 24px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">${heading}</h2>
            </div>
            <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
              <p style="margin:0 0 12px">Hi ${name || ''},</p>
              <p style="margin:0 0 12px">${intro}</p>
              <a href="${portalUrl}" style="display:inline-block;background:#2E5A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">Log in to your portal</a>
              <p style="margin:8px 0 0;font-size:12px;color:#64748b">You'll need to set a password the first time you log in. If the button doesn't work, copy this link: ${portalUrl}</p>
            </div>
          </div>`,
      });
    } catch (e) { /* best-effort — the platform invite email is sent by inviteUser */ }

    return Response.json({
      ok: true,
      result,
      portal_user_id: portalUserId,
      record_name: recordName,
      invited_at: nowIso,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}