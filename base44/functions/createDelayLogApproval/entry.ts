import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createApproval } from '../../shared/inboxEngine.ts';

// ============================================================
// createDelayLogApproval — creates an inbox approval when a delay
// log is submitted. Called by a workflow triggered on JobDelayLog
// create. Routes to the submitter's manager chain (via the
// 'delay_log' routing config).
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const delayLogId: string = String(body.delayLogId || body.id || '').trim();

    if (!delayLogId) {
      return Response.json({ error: 'delayLogId is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const logs = await sr.entities.JobDelayLog.filter({ id: delayLogId });
    const log = logs[0];
    if (!log) {
      return Response.json({ error: 'Delay log not found' }, { status: 404 });
    }

    // Resolve job name
    let jobName = log.job_name || 'job';
    if (log.job_id && !jobName) {
      try {
        const jobs = await sr.entities.Job.filter({ id: log.job_id });
        if (jobs[0]) jobName = jobs[0].name;
      } catch (_) {}
    }

    await createApproval(base44, {
      approvalType: 'delay_log',
      requesterStaffId: log.staff_id || null,
      title: `Delay log — ${jobName} (${log.impacted_days || 0} day(s) impact)`,
      body: `Delay reported on ${jobName}. Reason: ${log.delay_reason || '—'}. Impact: ${log.impacted_days || 0} day(s).${log.notes ? ' Notes: ' + log.notes : ''} Approving will shift future rota assignments and extend the job end date.`,
      sourceHub: 'jobs',
      sourceEntity: 'JobDelayLog',
      sourceId: delayLogId,
      deepLink: `/admin?job=${log.job_id}&tab=delays`,
      priority: 'normal',
    });

    return Response.json({ success: true });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}