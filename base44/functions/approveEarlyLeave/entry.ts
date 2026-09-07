import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// approveEarlyLeave — Manager approves/rejects a staff early-leave request
// ============================================================
// Called by a manager from the EarlyLeaveApprovalCard in the job detail
// Schedule & Crew tab. The manager draws a signature on the approval card,
// which is stored alongside the approval timestamp and approver name so
// there is a signed audit trail for the reduced hours on the timesheet.
//
// Security: admin-only. The function verifies the caller's role before
// updating the assignment.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Auth check
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Only admins/managers can approve
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only managers can approve early-leave requests' }, { status: 403 });
    }

    // 3. Parse payload
    const body = await req.json().catch(() => ({}));
    const assignmentId: string = String(body.assignmentId || '').trim();
    const decision: string = String(body.decision || '').trim(); // 'approved' or 'rejected'
    const signatureDataUrl: string = String(body.signatureDataUrl || '').trim();
    const approverName: string = String(body.approverName || user.full_name || 'Manager').trim();

    if (!assignmentId) {
      return Response.json({ error: 'assignmentId is required' }, { status: 400 });
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      return Response.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 });
    }
    if (decision === 'approved' && !signatureDataUrl) {
      return Response.json({ error: 'Signature is required to approve' }, { status: 400 });
    }

    // 4. Fetch the assignment
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ id: assignmentId });
    const assignment = assignments[0];
    if (!assignment) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // 5. Update the assignment
    const updates: Record<string, any> = {
      early_leave_status: decision,
      early_leave_approved_by: approverName,
      early_leave_approved_at: new Date().toISOString(),
    };
    if (decision === 'approved') {
      updates.early_leave_approval_signature = signatureDataUrl;
    }

    const updated = await base44.asServiceRole.entities.RotaAssignment.update(assignmentId, updates);

    return Response.json({ success: true, assignment: updated });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}