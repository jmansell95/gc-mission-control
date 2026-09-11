import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { actionItem } from '../../shared/inboxEngine.ts';
import {
  brandedWrapper, heading, p, ctaButton, callout, getAppBaseUrl,
} from '../../shared/emailStyling.ts';

// ============================================================
// actionInboxItem — Approve / reject / dismiss an inbox item
// ============================================================
// Called by the Inbox UI. Closes the item (+ siblings for group approvals),
// notifies the requester with the outcome, and returns the updated item.
// Payload: { itemId, decision, note }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { itemId, decision, note } = body;
    if (!itemId) return Response.json({ error: 'itemId is required' }, { status: 400 });
    if (!['approved', 'rejected', 'dismissed'].includes(decision)) {
      return Response.json({ error: 'decision must be approved, rejected, or dismissed' }, { status: 400 });
    }

    // Verify the caller owns this item (RLS would catch it, but explicit check
    // gives a clearer error and prevents acting on items the user can read but
    // shouldn't action, e.g. as a requester).
    const items = await base44.entities.InboxItem.filter({ id: itemId });
    const item = items[0];
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });
    if (item.assigned_to_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the assigned approver can action this item' }, { status: 403 });
    }

    const result = await actionItem(base44, {
      itemId,
      decision,
      note: note || '',
      actionedByName: user.full_name || user.email || 'Manager',
    });

    // ── Access request special handling ───────────────────────────────
    // When an access_request approval is actioned, update the pending
    // user's access_status to approved/rejected and send a welcome email
    // on approve — mirroring the old approveUserAccess function.
    if (
      item.approval_type === 'access_request' &&
      item.source_entity === 'User' &&
      item.source_id &&
      (decision === 'approved' || decision === 'rejected')
    ) {
      const sr = base44.asServiceRole;
      const newStatus = decision === 'approved' ? 'approved' : 'rejected';
      try {
        await sr.entities.User.update(item.source_id, { access_status: newStatus });
      } catch (_) { /* don't fail the inbox action on user update error */ }

      if (decision === 'approved') {
        try {
          const targetUser: any = await sr.entities.User.get(item.source_id);
          if (targetUser?.email) {
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
          }
        } catch (_) { /* best-effort email */ }
      }
    }

    return Response.json(result);
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}