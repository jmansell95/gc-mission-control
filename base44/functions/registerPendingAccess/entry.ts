import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  brandedWrapper, heading, p, ctaButton, infoTable, callout,
  getAppBaseUrl, BRAND,
} from '../../shared/emailStyling.ts';

// ============================================================
// registerPendingAccess — called from AuthContext when a non-admin
// user logs in and their access_status is not 'approved'.
//
// • If access_status is undefined (first login): sets it to 'pending',
//   sends a notification email to all configured approvers, and returns
//   the approver contact info for the pending screen.
// • If access_status is already 'pending': just returns the approver
//   contact info (no re-notification).
// • If access_status is 'rejected': returns that status.
// • If access_status is 'approved': returns that status (user can proceed).
//
// Idempotent — safe to call on every login for pending users.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admins always bypass
    if (user.role === 'admin') {
      return Response.json({ access_status: 'approved', bypassed: true });
    }

    const sr = base44.asServiceRole;
    const currentStatus = user.access_status || null;

    // Already approved — no action needed
    if (currentStatus === 'approved') {
      return Response.json({ access_status: 'approved' });
    }

    // Rejected — return that status
    if (currentStatus === 'rejected') {
      return Response.json({ access_status: 'rejected' });
    }

    // Fetch approver config
    const configSettings = await sr.entities.AppSetting.filter({ key: 'access_gate_config' });
    const config = (configSettings[0]?.value as any) || {};
    const approverIds: string[] = config.approver_user_ids || [];

    // Fetch approver user details
    let approvers: any[] = [];
    if (approverIds.length > 0) {
      const allUsers = await sr.entities.User.list('-created_date', 500);
      approvers = allUsers
        .filter((u: any) => approverIds.includes(u.id))
        .map((u: any) => ({ name: u.full_name || u.email, email: u.email }));
    }

    // First login (no status set) — set to pending and notify approvers
    if (!currentStatus) {
      try {
        await sr.entities.User.update(user.id, { access_status: 'pending' });
      } catch (e) {
        // If the update fails, still show the pending screen
      }

      // Send notification email to approvers
      if (approvers.length > 0) {
        const baseUrl = await getAppBaseUrl(base44);
        const queueUrl = baseUrl ? baseUrl.replace(/\/+$/, '') + '/admin?tab=pending-access' : '';
        const userName = user.full_name || user.email || 'A new user';

        for (const approver of approvers) {
          try {
            const html = brandedWrapper(
              heading('New Access Request') +
              p(`${userName} has signed in to GC Mission Control and is waiting for access approval.`) +
              infoTable([
                ['Name', userName],
                ['Email', user.email || '—'],
                ['Requested', new Date().toLocaleString('en-GB')],
              ]) +
              (queueUrl ? `<div style="margin-top:20px">${ctaButton(queueUrl, 'Review in Pending Access Queue')}</div>` : '') +
              callout('If you recognise this person, approve them from the Pending Access queue. If not, reject them.', 'info'),
              { banner_subtitle: 'Access Request' }
            );
            await base44.integrations.Core.SendEmail({
              to: approver.email,
              subject: `New Access Request — ${userName}`,
              html,
            });
          } catch (_) { /* don't block on email failure */ }
        }
      }
    }

    return Response.json({
      access_status: 'pending',
      approvers,
      contact_instructions: config.contact_instructions || '',
    });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}