import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// delegateApprovals — Delegate pending approvals to another staff member
// ============================================================
// Called by a manager from their inbox. Reassigns all their pending approval
// items (and optionally future ones for a time window) to a colleague.
// Payload: { toStaffId, untilDate (ISO, optional) }
// If untilDate is set, new approvals arriving before that date also route to
// the delegate (the engine checks active delegations when resolving approvers).
// For now, this reassigns existing pending items immediately.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { toStaffId, untilDate } = body;
    if (!toStaffId) return Response.json({ error: 'toStaffId is required' }, { status: 400 });

    // Resolve the current user's Staff record
    const myStaff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
    const me = myStaff[0];
    if (!me) return Response.json({ error: 'Your staff record was not found' }, { status: 404 });

    // Resolve the delegate
    const delegates = await base44.asServiceRole.entities.Staff.filter({ id: toStaffId });
    const delegate = delegates[0];
    if (!delegate) return Response.json({ error: 'Delegate staff record not found' }, { status: 404 });

    // Find all my pending approval items
    const myPending = await base44.asServiceRole.entities.InboxItem.filter({
      assigned_to_user_id: user.id,
      status: 'pending',
      type: 'approval',
    });

    let count = 0;
    for (const item of myPending) {
      await base44.asServiceRole.entities.InboxItem.update(item.id, {
        assigned_to_staff_id: delegate.id,
        assigned_to_user_id: delegate.user_id || null,
        assigned_to_name: delegate.name,
        delegated_by_staff_id: me.id,
        delegated_until: untilDate || null,
      });
      count++;
    }

    return Response.json({ success: true, delegatedCount: count, delegateName: delegate.name });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}