import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * stampRigOnSiteFromDelivery — invoked after a driver signs off a delivery.
 * Drives the rig's on-site state from the delivery sign-off:
 *   - site_delivery / supplier_delivery  → stamp linked rigs as 'on_site' at the job
 *   - supplier_collection                → return linked rigs (release to yard pool)
 *   - sample_collection / sample_delivery / item_handover → no rig action
 *
 * Payload: { delivery_id }
 * Returns: { stamped, returned, skipped, summary }
 *
 * Rigs are identified by the delivery's `linked_rig_ids` (comma-separated
 * SiteAsset IDs). For site deliveries with no linked rigs, falls back to
 * stamping every rig currently assigned to the job (the common case where the
 * delivery IS the rig delivery and the dispatcher didn't tag it explicitly).
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const deliveryId = body?.delivery_id;
    if (!deliveryId) return Response.json({ error: 'delivery_id is required' }, { status: 400 });

    // Fetch the completed delivery (service role — driver may be division-scoped)
    const delivery = await base44.asServiceRole.entities.DeliveryLog.get(deliveryId);
    if (!delivery) return Response.json({ error: 'Delivery not found' }, { status: 404 });
    if (delivery.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'Delivery not completed' });
    }

    const jobId = delivery.job_id || '';
    const jobName = delivery.job_name || '';
    const deliveryType = delivery.delivery_type || '';
    const today = new Date().toISOString().split('T')[0];

    // Resolve the set of rig SiteAsset IDs to act on
    const linkedRigIds = String(delivery.linked_rig_ids || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    let rigIds = [...linkedRigIds];

    // Fallback for site deliveries with no explicit rig link: stamp every rig
    // currently assigned to the job (status 'assigned' or 'on_site').
    if (rigIds.length === 0 && (deliveryType === 'site_delivery' || deliveryType === 'supplier_delivery') && jobId) {
      const assigned = await base44.asServiceRole.entities.JobAssetAssignment.filter({
        job_id: jobId,
        asset_type: 'rig',
        status: { $in: ['assigned', 'on_site'] },
      });
      rigIds = assigned.map(a => a.asset_id).filter(Boolean);
    }

    if (rigIds.length === 0) {
      return Response.json({ stamped: 0, returned: 0, skipped: true, reason: 'No rigs linked to this delivery' });
    }

    const isDelivery = deliveryType === 'site_delivery' || deliveryType === 'supplier_delivery';
    const isCollection = deliveryType === 'supplier_collection';

    if (!isDelivery && !isCollection) {
      return Response.json({ stamped: 0, returned: 0, skipped: true, reason: `${deliveryType} does not move rigs` });
    }

    // Fetch the rig SiteAsset records (for names + audit)
    const rigs = await base44.asServiceRole.entities.SiteAsset.filter({ id: { $in: rigIds } });
    const rigMap = {};
    for (const r of rigs) rigMap[r.id] = r;

    let stamped = 0;
    let returned = 0;

    if (isDelivery) {
      // Stamp each rig on-site at the job: upsert a JAA to 'on_site'
      for (const rigId of rigIds) {
        const rig = rigMap[rigId];
        if (!rig) continue;
        // Find an existing active JAA for this rig at this job
        const existing = await base44.asServiceRole.entities.JobAssetAssignment.filter({
          job_id: jobId,
          asset_id: rigId,
          status: { $in: ['assigned', 'on_site'] },
        });
        if (existing.length > 0) {
          // Update the first active assignment to on_site
          await base44.asServiceRole.entities.JobAssetAssignment.update(existing[0].id, {
            status: 'on_site',
            arrived_on_site_date: today,
            notes: `Stamped on site by delivery sign-off (${deliveryType}) — ${delivery.signed_by_name || 'driver'}`,
          });
        } else {
          // No existing assignment — create one
          await base44.asServiceRole.entities.JobAssetAssignment.create({
            job_id: jobId,
            job_name: jobName,
            asset_id: rigId,
            asset_name: rig.name || '',
            asset_type: 'rig',
            rig_type: rig.rig_type || 'n/a',
            role: 'primary_rig',
            compliance_status: rig.compliance_status || 'unknown',
            status: 'on_site',
            assigned_date: today,
            arrived_on_site_date: today,
            notes: `Stamped on site by delivery sign-off (${deliveryType}) — ${delivery.signed_by_name || 'driver'}`,
          });
        }
        stamped++;
      }
    } else if (isCollection) {
      // Return each linked rig: mark its on_site/assigned JAA at the job as returned
      for (const rigId of rigIds) {
        const onSite = await base44.asServiceRole.entities.JobAssetAssignment.filter({
          job_id: jobId,
          asset_id: rigId,
          status: { $in: ['on_site', 'assigned'] },
        });
        if (onSite.length > 0) {
          await base44.asServiceRole.entities.JobAssetAssignment.update(onSite[0].id, {
            status: 'returned',
            returned_date: today,
            notes: `Released by collection sign-off (${deliveryType}) — ${delivery.signed_by_name || 'driver'}`,
          });
          returned++;
        }
        // Also set the rig's stock back to in_stock so it's available for the next job
        const rig = rigMap[rigId];
        if (rig) {
          const isStock = rig.quantity_owned != null && rig.quantity_owned > 1;
          const newAvail = isStock
            ? Math.min(Number(rig.quantity_owned) || 0, (Number(rig.quantity_available) || 0) + 1)
            : 0;
          await base44.asServiceRole.entities.SiteAsset.update(rigId, {
            stock_level: isStock ? (newAvail === 0 ? 'out_of_stock' : 'in_stock') : 'in_stock',
            ...(isStock ? { quantity_available: newAvail } : {}),
            sync_status: 'pending',
          });
        }
      }
    }

    // Audit log entry
    try {
      await base44.asServiceRole.functions.invoke('logSystemAudit', {
        entity_name: 'DeliveryLog',
        entity_id: deliveryId,
        action: 'rig_on_site_stamp',
        source: 'delivery_signoff',
        actor_name: delivery.signed_by_name || user.full_name || 'driver',
        details: `${isDelivery ? 'Stamped on site' : 'Released'} ${rigIds.length} rig(s) via ${deliveryType} for job ${jobName || jobId}.`,
      });
    } catch (_) { /* non-blocking */ }

    return Response.json({
      stamped,
      returned,
      rig_ids: rigIds,
      summary: isDelivery
        ? `${stamped} rig(s) stamped on site at ${jobName || 'job'}`
        : `${returned} rig(s) released from ${jobName || 'job'}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}