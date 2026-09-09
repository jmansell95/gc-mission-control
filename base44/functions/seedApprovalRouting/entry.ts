import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { APPROVAL_TYPES } from '../../shared/inboxEngine.ts';

// ============================================================
// seedApprovalRouting — Seeds default ApprovalRoutingConfig records
// ============================================================
// Idempotent: creates a config for each APPROVAL_TYPES entry if one doesn't
// already exist. Called from the Settings → Approval Routing page on first
// load, and safe to re-run. Admin-only.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const existing = await base44.asServiceRole.entities.ApprovalRoutingConfig.list('-created_date', 200);
    const existingTypes = new Set(existing.map(c => c.approval_type));

    let created = 0;
    for (const t of APPROVAL_TYPES) {
      if (existingTypes.has(t.key)) continue;
      await base44.asServiceRole.entities.ApprovalRoutingConfig.create({
        approval_type: t.key,
        label: t.label,
        hub: t.hub,
        approver_mode: t.defaultMode,
        approver_staff_ids: [],
        fallback_staff_ids: [],
        sla_hours: t.defaultSlaHours,
        requires_multiple_signoffs: false,
        is_active: true,
        last_edited_by: user.full_name || user.email || 'System',
      });
      created++;
    }

    return Response.json({ success: true, created, total: APPROVAL_TYPES.length });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}