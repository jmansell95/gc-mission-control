import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { actionItem } from '../../shared/inboxEngine.ts';

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

    return Response.json(result);
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}