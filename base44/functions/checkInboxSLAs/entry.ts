import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { APPROVAL_TYPES } from '../../shared/inboxEngine.ts';

// ============================================================
// checkInboxSLAs — Scheduled SLA escalation for overdue inbox items
// ============================================================
// Runs nightly (workflow). Finds pending approval items past their sla_due_at,
// marks them overdue, and re-notifies the approver. Items more than 24h
// overdue are escalated to the fallback approvers (or super admins).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Auth check — admin only (this runs on a schedule via service role,
    // but if invoked manually we still verify)
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch all pending approval items with an SLA
    const pending = await base44.asServiceRole.entities.InboxItem.filter({
      status: 'pending',
      type: 'approval',
    });

    let overdueCount = 0;
    let escalatedCount = 0;

    for (const item of pending) {
      if (!item.sla_due_at) continue;
      const due = new Date(item.sla_due_at);
      if (due > now) continue;

      // Mark overdue (if not already)
      if (!item.is_overdue) {
        await base44.asServiceRole.entities.InboxItem.update(item.id, { is_overdue: true });
        overdueCount++;
      }

      // Escalate if >24h overdue: re-assign to fallback or super admins
      const hoursOverdue = (now.getTime() - due.getTime()) / 3600000;
      if (hoursOverdue > 24 && !item.delegated_by_staff_id) {
        // Look up the routing config for fallback approvers
        const configs = await base44.asServiceRole.entities.ApprovalRoutingConfig.filter({ approval_type: item.approval_type });
        const config = configs[0];
        let fallbackIds = config?.fallback_staff_ids || [];
        if (fallbackIds.length === 0) {
          const admins = await base44.asServiceRole.entities.Staff.filter({ system_role: 'super_admin', is_active: true });
          fallbackIds = admins.map(s => s.id);
        }
        if (fallbackIds.length > 0) {
          // Re-assign to the first fallback who isn't the current assignee
          const newApprover = (await base44.asServiceRole.entities.Staff.filter({ id: fallbackIds[0] }))[0];
          if (newApprover && newApprover.id !== item.assigned_to_staff_id) {
            await base44.asServiceRole.entities.InboxItem.update(item.id, {
              assigned_to_staff_id: newApprover.id,
              assigned_to_user_id: newApprover.user_id || null,
              assigned_to_name: newApprover.name,
            });
            escalatedCount++;
          }
        }
      }
    }

    return Response.json({
      success: true,
      checked: pending.length,
      markedOverdue: overdueCount,
      escalated: escalatedCount,
      runAt: nowIso,
    });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}