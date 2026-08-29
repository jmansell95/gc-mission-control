import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { totalWeight, calculateAxleGuidance } from '../../shared/loadWeight.ts';

/**
 * Batch sign-out — creates JobAssetAssignment records for all scanned assets
 * in one call and pushes the sign-out to Asset Panda so the yard dashboard
 * shows the gear as 'Out on Job'.
 *
 * Payload: { asset_ids: string[], job_id, job_name, staff_id, staff_name, vehicle_id?, vehicle_name? }
 * Returns: { success, assignments_created, panda_push }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetIds = Array.isArray(body?.asset_ids) ? body.asset_ids.filter(Boolean) : [];
    const quantities = body?.quantities || {}; // { asset_id: number } — per-item qty for stock items
    const jobId = body?.job_id || '';
    const jobName = body?.job_name || '';
    const staffId = body?.staff_id || user.id;
    const staffName = body?.staff_name || user.full_name || '';
    const vehicleId = body?.vehicle_id || '';
    const vehicleName = body?.vehicle_name || '';
    const trailerId = body?.trailer_id || '';
    const trailerName = body?.trailer_name || '';
    const overrideWeight = body?.override_weight === true;

    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });
    if (assetIds.length === 0) return Response.json({ error: 'No assets to sign out' }, { status: 400 });

    // Fetch the actual SiteAsset records first — needed for weight checks and assignment denormalisation
    const assets = await base44.entities.SiteAsset.filter({ id: { $in: assetIds } });
    const assetMap = {};
    for (const a of assets) assetMap[a.id] = a;

    // --- Weight & axle guidance ---
    // Sum loaded weight from the asset records and check against the vehicle's
    // max_weight_kg. When overweight, require an explicit override flag — the
    // UI shows a warning and an 'Override & Proceed' button that re-calls with
    // override_weight=true (logged to SystemAuditLog).
    const loadedWeight = totalWeight(assets);
    const axle = calculateAxleGuidance(assets, null);
    let vehicleRecord: any = null;
    if (vehicleId) {
      try {
        vehicleRecord = await base44.entities.Vehicle.get(vehicleId);
      } catch (_) {}
    }
    const maxWeight = vehicleRecord?.max_weight_kg || null;
    if (maxWeight && loadedWeight > maxWeight && !overrideWeight) {
      return Response.json({
        error: 'Vehicle payload exceeded',
        overweight: true,
        loaded_weight_kg: Math.round(loadedWeight),
        max_weight_kg: Math.round(maxWeight),
        message: `Loaded weight (${Math.round(loadedWeight)} kg) exceeds the vehicle's payload limit (${Math.round(maxWeight)} kg). Confirm override to proceed.`,
      }, { status: 409 });
    }
    if (overrideWeight && maxWeight && loadedWeight > maxWeight) {
      try {
        await base44.functions.invoke('logSystemAudit', {
          action: 'weight_override',
          entity_type: 'DeliveryLog',
          details: `Overweight override: ${Math.round(loadedWeight)} kg loaded on vehicle ${vehicleRecord?.registration_number || vehicleId} (limit ${Math.round(maxWeight)} kg). Job: ${jobName}.`,
        });
      } catch (_) {}
    }

    const today = new Date().toISOString().split('T')[0];

    // Build JobAssetAssignment records
    const records = assetIds.map(id => {
      const a = assetMap[id] || {};
      return {
        job_id: jobId,
        job_name: jobName,
        asset_id: id,
        asset_name: a.name || '',
        asset_type: a.asset_type || 'machinery',
        rig_type: a.rig_type || 'n/a',
        role: a.is_rig ? 'primary_rig' : a.asset_type === 'trailer' ? 'trailer' : a.asset_type === 'lifting' ? 'lifting' : 'machinery',
        compliance_status: a.compliance_status || 'unknown',
        status: 'on_site',
        assigned_date: today,
        arrived_on_site_date: today,
        vehicle_id: vehicleId || undefined,
        vehicle_name: vehicleName || undefined,
        notes: `Signed out via scanner by ${staffName}${vehicleName ? ` onto ${vehicleName}` : ''}`,
      };
    });

    // Denormalise loaded weight + axle guidance onto the active DeliveryLog
    // (if one exists for this vehicle/job today) so the driver hub can show
    // the safe-to-drive panel without re-summing.
    if (vehicleId) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const activeDeliveries = await base44.entities.DeliveryLog.filter({
          vehicle_id: vehicleId,
          job_id: jobId,
          scheduled_date: todayStr,
        });
        if (activeDeliveries.length > 0) {
          const dl = activeDeliveries[0];
          await base44.entities.DeliveryLog.update(dl.id, {
            total_loaded_weight_kg: Math.round(loadedWeight),
            axle_guidance_note: axle.note,
            weight_override: overrideWeight && maxWeight && loadedWeight > maxWeight,
            ...(trailerId ? { trailer_id: trailerId, trailer_name: trailerName } : {}),
          });
        }
      } catch (_) {}
    }

    await base44.entities.JobAssetAssignment.bulkCreate(records);

    // Update SiteAsset stock for sign-out:
    // - Single-unit items (quantity_owned <= 1): set stock_level to out_of_stock
    // - Stock/consumable items (quantity_owned > 1): decrement quantity_available by the
    //   signed-out qty (floored at 0) and derive stock_level from the new available count
    const stockUpdates = assets.map(a => {
      const qty = Math.max(1, Number(quantities[a.id] || 1));
      const isStock = a.quantity_owned != null && a.quantity_owned > 1;
      if (isStock) {
        const newAvail = Math.max(0, (Number(a.quantity_available) || 0) - qty);
        const lowThreshold = Math.max(1, Math.ceil(a.quantity_owned * 0.2));
        const newStockLevel = newAvail === 0 ? 'out_of_stock' : (newAvail <= lowThreshold ? 'low_stock' : 'in_stock');
        return { id: a.id, quantity_available: newAvail, stock_level: newStockLevel, sync_status: 'pending' };
      }
      return { id: a.id, stock_level: 'out_of_stock', sync_status: 'pending' };
    });
    if (stockUpdates.length > 0) {
      try { await base44.entities.SiteAsset.bulkUpdate(stockUpdates); } catch (_) {}
    }

    // Push sign-out to Asset Panda (best-effort, non-blocking)
    let pandaResult = { attempted: false };
    const pandaIds = assets.map(a => a.panda_asset_id).filter(Boolean);
    if (pandaIds.length > 0) {
      try {
        pandaResult = await base44.functions.invoke('pushSignOutToPanda', {
          panda_ids: pandaIds,
          job_name: jobName,
        });
        pandaResult = pandaResult.data || pandaResult;
      } catch (e) {
        pandaResult = { attempted: true, success: false, error: e.message };
      }
    }

    return Response.json({
      success: true,
      assignments_created: records.length,
      panda_push: pandaResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});