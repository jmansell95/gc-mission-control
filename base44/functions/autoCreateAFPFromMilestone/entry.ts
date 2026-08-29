import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Milestone-Triggered Auto-AFP — entity automation on JobMilestone.
 *
 * When a job milestone is marked complete (or a billing period ends), this
 * function auto-creates the next AFP for the job and populates it from all
 * field data since the last AFP (driller logs, deliveries, timesheets, asset
 * assignments). The billing team reviews instead of building from scratch.
 *
 * Trigger: entity automation on JobMilestone update (status → 'completed').
 * Leverages: populateAFPFromFieldData, AFP, AFPLineItem
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const milestone = body.data || body;
    if (!milestone || !milestone.job_id) {
      return Response.json({ ok: true, skipped: true, reason: 'No milestone data' });
    }

    // Only trigger when the milestone is marked complete
    if (milestone.status !== 'completed') {
      return Response.json({ ok: true, skipped: true, reason: 'Milestone not completed' });
    }

    const jobId = milestone.job_id;

    // 1. Load the job
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) {
      return Response.json({ ok: true, skipped: true, reason: 'Job not found' });
    }

    // 2. Find the current AFPs for this job
    const afps = await base44.asServiceRole.entities.AFP.filter({ job_id: jobId });
    const lastAfp = afps.sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''))[0];

    // 3. Determine the next AFP period (day after the last AFP end, or job start)
    const periodStart = lastAfp?.period_end
      ? new Date(new Date(lastAfp.period_end).getTime() + 86400000).toISOString().slice(0, 10)
      : (job.start_date || new Date().toISOString().slice(0, 10));
    const periodEnd = new Date().toISOString().slice(0, 10); // up to today

    // 4. Check if an AFP already exists for this period (idempotent)
    const existing = afps.find((a) => a.period_start === periodStart && a.period_end === periodEnd);
    if (existing) {
      // Already exists — just refresh from field data
      await base44.asServiceRole.functions.invoke('populateAFPFromFieldData', {
        afp_id: existing.id,
        job_id: jobId,
        period_start: periodStart,
        period_end: periodEnd,
      });
      return Response.json({ ok: true, refreshed: true, afp_id: existing.id });
    }

    // 5. Create the new AFP
    const nextAfpNumber = `AFP-${(afps.length + 1).toString().padStart(3, '0')}`;
    const newAfp = await base44.asServiceRole.entities.AFP.create({
      job_id: jobId,
      job_name: job.name || job.site_name || '',
      afp_number: nextAfpNumber,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
      total_claimed: 0,
      agreed_total: 0,
    });

    // 6. Auto-populate from field data
    await base44.asServiceRole.functions.invoke('populateAFPFromFieldData', {
      afp_id: newAfp.id,
      job_id: jobId,
      period_start: periodStart,
      period_end: periodEnd,
    });

    return Response.json({
      ok: true,
      created: true,
      afp_id: newAfp.id,
      afp_number: nextAfpNumber,
      period_start: periodStart,
      period_end: periodEnd,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}