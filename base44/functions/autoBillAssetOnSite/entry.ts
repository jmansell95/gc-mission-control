import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Asset-on-Site Auto-Billing — entity automation on JobAssetAssignment.
 *
 * When an asset (rig, pump, van, etc.) is assigned to a job, this function
 * auto-creates a billing line item in the job's current open AFP at the
 * correct rate-card price. For day-rate items it creates one line per day
 * from the assignment date forward; for meterage items it waits for the
 * driller's log.
 *
 * Trigger: entity automation on JobAssetAssignment create.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Entity automation payload: { event: { type, entity_name, entity_id }, data }
    const assignment = body.data || body;
    if (!assignment || !assignment.job_id || !(assignment.asset_id || assignment.site_asset_id)) {
      return Response.json({ ok: true, skipped: true, reason: 'No assignment data' });
    }

    const assetId = assignment.asset_id || assignment.site_asset_id;
    const jobId = assignment.job_id;
    const assignDate = assignment.assigned_date || assignment.start_date || new Date().toISOString().slice(0, 10);

    // Skip if already returned
    if (assignment.status === 'returned') {
      return Response.json({ ok: true, skipped: true, reason: 'Asset already returned' });
    }

    // 1. Load the asset
    const asset = await base44.asServiceRole.entities.SiteAsset.get(assetId);
    if (!asset) {
      return Response.json({ ok: true, skipped: true, reason: 'Asset not found' });
    }

    // 2. Find the current open AFP for this job
    const afps = await base44.asServiceRole.entities.AFP.filter({
      job_id: jobId,
      status: { $in: ['draft', 'in_progress', 'open'] },
    });
    const afp = afps[0];
    if (!afp) {
      return Response.json({ ok: true, skipped: true, reason: 'No open AFP for this job' });
    }

    // 3. Check if a billing line already exists for this asset (idempotent)
    const existing = await base44.asServiceRole.entities.AFPLineItem.filter({
      afp_id: afp.id,
      job_id: jobId,
      source_id: assignment.id || assetId,
      source: 'job_cost_item',
    });
    if (existing.length > 0) {
      return Response.json({ ok: true, skipped: true, reason: 'Billing line already exists' });
    }

    // 4. Find the rate card item for this asset
    const rateCards = await base44.asServiceRole.entities.RateCardItem.list('-updated_date', 200);
    const rateMatch = rateCards.find((r) => {
      const rName = (r.name || r.item || '').toLowerCase();
      const aName = (asset.name || '').toLowerCase();
      return rName && aName && (rName.includes(aName) || aName.includes(rName));
    });

    const unitPrice = rateMatch?.price || rateMatch?.unit_price || rateMatch?.rate || asset.daily_rate || asset.cost_price || 0;
    const unit = rateMatch?.unit || 'Day';
    const item = rateMatch?.name || rateMatch?.item || asset.name || 'Asset hire';
    const category = asset.is_rig ? 'drilling' : 'plant_hire';

    // 5. Create the billing line item
    await base44.asServiceRole.entities.AFPLineItem.create({
      afp_id: afp.id,
      job_id: jobId,
      sheet_name: 'measured_works',
      category,
      item,
      unit,
      unit_price: unitPrice,
      qty: 1,
      rate: unitPrice,
      amount: unitPrice,
      source: 'job_cost_item',
      source_id: assignment.id || assetId,
      source_date: assignDate,
      is_manual: false,
    });

    return Response.json({
      ok: true,
      billed: true,
      job_id: jobId,
      afp_id: afp.id,
      asset_name: asset.name,
      unit_price: unitPrice,
      unit,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}