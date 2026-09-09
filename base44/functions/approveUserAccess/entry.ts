import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  brandedWrapper, heading, p, ctaButton, callout,
  getAppBaseUrl,
} from '../../shared/emailStyling.ts';

// ============================================================
// approveUserAccess — admin action to approve or reject a pending
// user from the Pending Access queue in Settings.
//
// • Sets the target user's access_status to 'approved' or 'rejected'.
// • On approve: sends a welcome email telling the user they can now
//   access the app.
// • Admin-only — returns 403 for non-admins.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { user_id, action } = body as { user_id: string; action: 'approve' | 'reject' };

    if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the target user's access_status
    await sr.entities.User.update(user_id, { access_status: newStatus });

    // Fetch the updated user for the email
    let targetUser: any = null;
    try { targetUser = await sr.entities.User.get(user_id); } catch (_) {}

    // Send welcome email on approve
    if (action === 'approve' && targetUser?.email) {
      try {
        const baseUrl = await getAppBaseUrl(base44);
        const loginUrl = baseUrl || '';
        const html = brandedWrapper(
          heading('Your Access Has Been Approved') +
          p(`Hi ${targetUser.full_name || targetUser.email},`) +
          p('Your access to GC Mission Control has been approved. You can now sign in and complete your onboarding.') +
          (loginUrl ? `<div style="margin-top:20px">${ctaButton(loginUrl, 'Sign In to GC Mission Control')}</div>` : '') +
          callout('If you experience any issues signing in, please contact your administrator.', 'info'),
          { banner_subtitle: 'Access Approved', headerVariant: 'emerald' }
        );
        await base44.integrations.Core.SendEmail({
          to: targetUser.email,
          subject: 'Access Approved — GC Mission Control',
          html,
        });
      } catch (_) { /* don't block on email failure */ }
    }

    return Response.json({
      success: true,
      user_id,
      access_status: newStatus,
      email_sent: action === 'approve',
    });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}