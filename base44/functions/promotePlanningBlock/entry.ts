import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// promotePlanningBlock — converts a PlanningBlock into a real
// Job + RotaAssignments and marks the block as 'promoted'.
// Called from the PlanningBlockModal when a manager clicks
// "Promote to Job".
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const blockId = body.block_id || body.blockId;
    if (!blockId) return Response.json({ error: 'Block ID required' }, { status: 400 });

    const blocks = await base44.asServiceRole.entities.PlanningBlock.filter({ id: blockId });
    const block = blocks[0];
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });
    if (block.status === 'promoted') return Response.json({ error: 'Block already promoted', jobId: block.promoted_job_id }, { status: 400 });

    // 1. Create the Job
    const drillingMethod = block.rig_type === 'rotary' ? 'rotary'
      : block.rig_type === 'cp' ? 'cp'
      : block.rig_type === 'mixed' ? 'mixed'
      : 'not_applicable';

    const job = await base44.asServiceRole.entities.Job.create({
      name: block.name || 'Promoted from Planning Block',
      division_id: block.division_id || '',
      location: block.location || '',
      start_date: block.start_date,
      end_date: block.end_date,
      status: 'planning',
      drilling_method: drillingMethod,
    });

    // 2. Create RotaAssignments for each crew member on each working day
    const crewIds = block.tentative_crew_ids || [];
    if (crewIds.length > 0) {
      const assignments: any[] = [];
      let d = new Date(block.start_date + 'T00:00:00');
      const end = new Date(block.end_date + 'T00:00:00');
      while (d <= end) {
        const dow = d.getDay();
        // Skip weekends by default
        if (dow !== 0 && dow !== 6) {
          const ds = d.toISOString().slice(0, 10);
          // Compute week_start (Monday of this week)
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - ((dow + 6) % 7));
          const weekStartStr = weekStart.toISOString().slice(0, 10);

          for (const sid of crewIds) {
            assignments.push({
              job_id: job.id,
              division_id: block.division_id || '',
              staff_id: sid,
              assigned_date: ds,
              week_start: weekStartStr,
              assignment_type: 'job',
              rig_asset_id: block.rig_asset_id || '',
            });
          }
        }
        d = new Date(d.getTime() + 86400000);
      }

      if (assignments.length > 0) {
        await base44.asServiceRole.entities.RotaAssignment.bulkCreate(assignments);
      }
    }

    // 3. Mark block as promoted
    await base44.asServiceRole.entities.PlanningBlock.update(block.id, {
      status: 'promoted',
      promoted_job_id: job.id,
    });

    return Response.json({ ok: true, jobId: job.id, blockId: block.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}