import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createApproval } from '../../shared/inboxEngine.ts';

// ============================================================
// createPricingReviewApproval — creates an inbox approval when an
// investigation log's pricing_review_status becomes 'pending_review'.
// Called by a workflow triggered on InvestigationLog update.
// Routes to the billing team (via the 'pricing_review' routing config).
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const logId: string = String(body.logId || body.id || '').trim();

    if (!logId) {
      return Response.json({ error: 'logId is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const logs = await sr.entities.InvestigationLog.filter({ id: logId });
    const log = logs[0];
    if (!log) {
      return Response.json({ error: 'Log not found' }, { status: 404 });
    }

    // Only create the approval when the status is 'pending_review'
    if (log.pricing_review_status !== 'pending_review') {
      return Response.json({ success: true, skipped: true, reason: 'not pending_review' });
    }

    // Resolve job name
    let jobName = 'job';
    if (log.job_id) {
      try {
        const jobs = await sr.entities.Job.filter({ id: log.job_id });
        if (jobs[0]) jobName = jobs[0].name;
      } catch (_) {}
    }

    await createApproval(base44, {
      approvalType: 'pricing_review',
      requesterStaffId: log.staff_id || null,
      title: `Pricing review — ${log.description?.slice(0, 60) || 'investigation log'} (${jobName})`,
      body: `An investigation log on ${jobName} could not be auto-priced. Description: "${log.description || '—'}". Please confirm or correct the rate card match so the charge can be stamped.`,
      sourceHub: 'billing',
      sourceEntity: 'InvestigationLog',
      sourceId: logId,
      deepLink: '/billing?tab=pricing-review',
      priority: 'normal',
    });

    return Response.json({ success: true });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}