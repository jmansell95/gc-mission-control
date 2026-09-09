import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { createApproval } from '../../shared/inboxEngine.ts';

// ---------------------------------------------------------------------------
// Process Off-Hire — Auto-Return Reconciliation
// ---------------------------------------------------------------------------
// Scans completed 'collect' DeliveryLegs for a job and marks the linked
// JobCostItems as off-hired / returned. Hired equipment is marked
// 'returned' (back to supplier); owned equipment is marked 'yard' (back
// to depot). Returns a reconciliation summary showing what's returned
// vs what's still on site.
//
// Idempotent: items already off_hired are skipped on re-run.
// ---------------------------------------------------------------------------

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { job_id } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const TODAY = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // 1. Find all completed 'collect' DeliveryLegs for this job
    const allLegs = await base44.asServiceRole.entities.DeliveryLeg.filter({ job_id });
    const completedCollectLegs = allLegs.filter(
      l => l.leg_type === 'collect' && l.status === 'complete' && l.job_cost_item_id
    );

    // 2. Process each completed collect leg — mark the linked gear as returned
    const offHired = [];
    for (const leg of completedCollectLegs) {
      const item = await base44.asServiceRole.entities.JobCostItem.get(leg.job_cost_item_id);
      if (!item) continue;
      // Skip if already off-hired (idempotent)
      if (item.hire_status === 'off_hired' || item.current_location === 'returned') continue;

      const isHired = item.category === 'hired_equipment' && item.supplier_id;
      await base44.asServiceRole.entities.JobCostItem.update(item.id, {
        hire_status: 'off_hired',
        current_location: isHired ? 'returned' : 'yard',
        off_hire_date: TODAY,
        location_updated_at: now,
        return_destination: isHired ? item.supplier_id : 'depot',
      });
      offHired.push({
        id: item.id,
        description: item.description,
        category: item.category,
        return_destination: isHired ? 'Supplier' : 'Depot',
      });
    }

    // 3. Build reconciliation summary from all gear items on this job
    const allCostItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id });
    const gearItems = allCostItems.filter(
      ci => ci.category === 'hired_equipment' || ci.category === 'internal_equipment'
    );

    const returned = gearItems.filter(
      ci => ci.current_location === 'returned' ||
            (ci.current_location === 'yard' && ci.hire_status === 'off_hired')
    );
    const onSite = gearItems.filter(ci => ci.current_location === 'site');
    const inTransit = gearItems.filter(ci => ci.current_location === 'in_transit');

    // ── Create inbox approval for the off-hire reconciliation ──
    try {
      const myStaff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
      const jobList = await base44.asServiceRole.entities.Job.filter({ id: job_id });
      const jobName = jobList[0]?.name || 'job';
      await createApproval(base44, {
        approvalType: 'off_hire',
        requesterStaffId: myStaff[0]?.id || null,
        title: `Off-hire reconciliation — ${jobName} (${offHired.length} items returned)`,
        body: `${offHired.length} item(s) marked off-hired on ${jobName}. ${gearItems.length - returned.length} item(s) still on site. Please confirm the reconciliation is correct.`,
        sourceHub: 'logistics',
        sourceEntity: 'JobCostItem',
        sourceId: job_id,
        deepLink: `/admin?job=${job_id}&tab=logistics`,
        priority: 'normal',
      });
    } catch (_) { /* don't block on inbox failure */ }

    return Response.json({
      status: 'success',
      data: {
        job_id,
        off_hired_now: offHired.length,
        off_hired_items: offHired,
        summary: {
          total_gear: gearItems.length,
          returned: returned.length,
          on_site: onSite.length,
          in_transit: inTransit.length,
        },
        on_site_items: onSite.map(ci => ({
          id: ci.id,
          description: ci.description,
          category: ci.category,
          current_location: ci.current_location,
          hire_status: ci.hire_status,
        })),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}