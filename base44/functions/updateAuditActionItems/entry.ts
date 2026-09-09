import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ============================================================
// updateAuditActionItems — persists action item changes
// ============================================================
// Accepts an audit_id and an updated action_items array (each with
// description, priority, assignee, due_date, status). Finds the
// matching SafetyReport by safetyculture_audit_id and updates the
// action_items field. Admin-only.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const auditId = String(body?.audit_id || body?.safetyculture_audit_id || '');
    const actionItems = body?.action_items;

    if (!auditId) return Response.json({ error: 'audit_id is required' }, { status: 422 });
    if (!Array.isArray(actionItems)) return Response.json({ error: 'action_items must be an array' }, { status: 422 });

    // Find the stored SafetyReport
    const reports = await base44.asServiceRole.entities.SafetyReport.filter({ safetyculture_audit_id: auditId });
    if (!reports || reports.length === 0) {
      return Response.json({ error: 'Audit not found' }, { status: 404 });
    }
    const report = reports[0];

    // Normalize action items — ensure each has the expected shape
    const normalized = actionItems.map((a: any) => ({
      description: String(a.description || a.action || a.text || ''),
      priority: String(a.priority || 'medium').toLowerCase(),
      assignee: String(a.assignee || a.assigned_to || ''),
      due_date: a.due_date ? String(a.due_date).slice(0, 10) : '',
      status: String(a.status || 'open').toLowerCase(),
    }));

    // Update the action_items on the SafetyReport
    await base44.asServiceRole.entities.SafetyReport.update(report.id, {
      action_items: normalized,
      status: normalized.some(a => a.status === 'open' || a.status === 'in_progress') ? 'open' : 'closed',
    });

    return Response.json({ success: true, action_items: normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}