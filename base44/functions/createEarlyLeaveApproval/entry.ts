import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createApproval } from '../../shared/inboxEngine.ts';

// ============================================================
// createEarlyLeaveApproval — creates an inbox approval when a
// field crew member requests early leave. Called by a workflow
// triggered on RotaAssignment update (early_leave_status = 'pending').
//
// Resolves the requester's Staff record and routes the approval
// to their manager chain (via the 'early_leave' routing config).
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const assignmentId: string = String(body.assignmentId || body.id || '').trim();

    if (!assignmentId) {
      return Response.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const assignments = await sr.entities.RotaAssignment.filter({ id: assignmentId });
    const assignment = assignments[0];
    if (!assignment) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Only create the approval when the status is 'pending'
    if (assignment.early_leave_status !== 'pending') {
      return Response.json({ success: true, skipped: true, reason: 'not pending' });
    }

    // Resolve job name for the title
    let jobName = assignment.job_name || 'job';
    if (assignment.job_id && !jobName) {
      try {
        const jobs = await sr.entities.Job.filter({ id: assignment.job_id });
        if (jobs[0]) jobName = jobs[0].name;
      } catch (_) {}
    }

    await createApproval(base44, {
      approvalType: 'early_leave',
      requesterStaffId: assignment.staff_id || null,
      title: `Early-leave request — ${assignment.staff_name || 'crew member'} (${jobName})`,
      body: `Requested departure time: ${assignment.early_leave_time || '—'}. Reason: ${assignment.early_leave_reason || '—'}. Please approve or reject.`,
      sourceHub: 'scheduling',
      sourceEntity: 'RotaAssignment',
      sourceId: assignmentId,
      deepLink: `/admin?job=${assignment.job_id}&tab=schedule`,
      priority: 'normal',
    });

    return Response.json({ success: true });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}