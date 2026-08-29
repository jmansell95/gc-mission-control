import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pushToAssetPanda } from '../../shared/assetPandaPush.ts';

// Processes asset returns scanned by crew during decommissioning.
// - Resolves manifest QR codes to their constituent asset IDs
// - Updates JobAssetAssignment records to 'returned'
// - Updates SiteAsset stock_level to 'in_stock'
// - Creates an AssetReturnLog audit record
// - Pushes stock-level updates to Asset Panda (best-effort, non-blocking)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, staff_id, staff_name, job_name, scanned_asset_ids, scanned_manifest_ids, notes } = body;
    const quantities = body?.quantities || {}; // { asset_id: number } — per-item qty for stock items

    if (!job_id || !staff_id) {
      return Response.json({ error: 'job_id and staff_id are required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // --- Resolve manifest IDs to their constituent asset IDs ---
    const allAssetIds = new Set(scanned_asset_ids || []);
    const scannedItems = [];
    const pandaIdsToUpdate = new Set();

    // Track individually-scanned assets
    for (const assetId of (scanned_asset_ids || [])) {
      scannedItems.push({
        asset_id: assetId,
        scan_type: 'individual',
      });
    }

    // Resolve manifests
    if (scanned_manifest_ids && scanned_manifest_ids.length > 0) {
      const manifests = await base44.entities.AssetManifest.filter({
        manifest_code: { $in: scanned_manifest_ids },
        is_active: true,
      });
      for (const manifest of manifests) {
        for (const assetId of (manifest.asset_ids || [])) {
          allAssetIds.add(assetId);
          scannedItems.push({
            asset_id: assetId,
            scan_type: 'manifest',
            manifest_id: manifest.id,
            manifest_name: manifest.name,
          });
        }
        for (const pandaId of (manifest.panda_asset_ids || [])) {
          pandaIdsToUpdate.add(pandaId);
        }
      }
    }

    // --- Fetch the actual SiteAsset records to get names + panda IDs ---
    const assetIdArray = Array.from(allAssetIds);
    let assets = [];
    if (assetIdArray.length > 0) {
      assets = await base44.entities.SiteAsset.filter({ id: { $in: assetIdArray } });
    }

    // Enrich scanned items with names and panda IDs
    const assetMap = {};
    for (const a of assets) {
      assetMap[a.id] = a;
      if (a.panda_asset_id) pandaIdsToUpdate.add(a.panda_asset_id);
    }
    for (const item of scannedItems) {
      const a = assetMap[item.asset_id];
      if (a) {
        item.asset_name = a.name;
        item.panda_asset_id = a.panda_asset_id || '';
      }
    }

    // --- Update JobAssetAssignment records to 'returned' ---
    let assignmentsUpdated = 0;
    if (assetIdArray.length > 0) {
      const assignments = await base44.entities.JobAssetAssignment.filter({
        job_id,
        asset_id: { $in: assetIdArray },
        status: { $ne: 'returned' },
      });
      if (assignments.length > 0) {
        const updates = assignments.map(a => ({
          id: a.id,
          status: 'returned',
          returned_date: today,
        }));
        await base44.entities.JobAssetAssignment.bulkUpdate(updates);
        assignmentsUpdated = assignments.length;
      }
    }

    // --- Update SiteAsset stock for return ---
    // - Single-unit items: set stock_level to 'in_stock'
    // - Stock/consumable items (quantity_owned > 1): increment quantity_available by the
    //   returned qty (capped at quantity_owned) and derive stock_level from the new count
    let assetsUpdated = 0;
    if (assetIdArray.length > 0) {
      const updates = assetIdArray.map(id => {
        const a = assetMap[id] || {};
        const qty = Math.max(1, Number(quantities[id] || 1));
        const isStock = a.quantity_owned != null && a.quantity_owned > 1;
        if (isStock) {
          const newAvail = Math.min(Number(a.quantity_owned) || 0, (Number(a.quantity_available) || 0) + qty);
          const lowThreshold = Math.max(1, Math.ceil(a.quantity_owned * 0.2));
          const newStockLevel = newAvail === 0 ? 'out_of_stock' : (newAvail <= lowThreshold ? 'low_stock' : 'in_stock');
          return { id, quantity_available: newAvail, stock_level: newStockLevel, sync_status: 'pending' };
        }
        return { id, stock_level: 'in_stock', sync_status: 'pending' };
      });
      await base44.entities.SiteAsset.bulkUpdate(updates);
      assetsUpdated = assetIdArray.length;
    }

    // --- Create the AssetReturnLog audit record ---
    const returnLog = await base44.entities.AssetReturnLog.create({
      job_id,
      job_name: job_name || '',
      staff_id,
      staff_name: staff_name || '',
      return_date: today,
      returned_at: now,
      scanned_items: scannedItems,
      total_items: scannedItems.length,
      notes: notes || '',
      synced_to_panda: false,
    });

    // --- Best-effort push to Asset Panda (non-blocking) ---
    let pandaResult = { attempted: false };
    if (pandaIdsToUpdate.size > 0) {
      try {
        pandaResult = await pushToAssetPanda(base44, Array.from(pandaIdsToUpdate));
        if (pandaResult.success) {
          await base44.entities.AssetReturnLog.update(returnLog.id, {
            synced_to_panda: true,
            synced_at: new Date().toISOString(),
          });
        } else {
          await base44.entities.AssetReturnLog.update(returnLog.id, {
            sync_error: pandaResult.error || 'Unknown push error',
          });
        }
      } catch (pandaErr) {
        pandaResult = { attempted: true, success: false, error: pandaErr.message };
        await base44.entities.AssetReturnLog.update(returnLog.id, {
          sync_error: pandaErr.message,
        });
      }
    }

    return Response.json({
      success: true,
      assets_returned: assetsUpdated,
      assignments_updated: assignmentsUpdated,
      return_log_id: returnLog.id,
      panda_push: pandaResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}