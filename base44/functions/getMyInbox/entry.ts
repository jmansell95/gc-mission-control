import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getMyInbox — Returns the current user's inbox items + badge counts
// ============================================================
// Called by the Inbox page and the InboxBadge component. Returns:
//   { items, counts: { total, approvals, alerts, notices, urgent, overdue } }
// Items are sorted: pending first (urgent > overdue > normal), then by date.
// Resolves the current user's linked Staff record to filter by user_id.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all items where the user is assignee or requester (RLS handles this,
    // but we query as the user so RLS applies — use the user-scoped client).
    const allItems = await base44.entities.InboxItem.list('-created_date', 500);

    // Sort: pending first, then urgent/overdue, then newest
    const rank = (it) => {
      if (it.status !== 'pending') return 100;
      let r = 0;
      if (it.priority === 'urgent') r -= 30;
      if (it.is_overdue) r -= 20;
      return r;
    };
    const items = allItems.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
    });

    const pending = items.filter(i => i.status === 'pending');
    const counts = {
      total: pending.length,
      approvals: pending.filter(i => i.type === 'approval').length,
      alerts: pending.filter(i => i.type === 'alert').length,
      notices: pending.filter(i => i.type === 'notice').length,
      urgent: pending.filter(i => i.priority === 'urgent').length,
      overdue: pending.filter(i => i.is_overdue).length,
    };

    return Response.json({ items, counts });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}