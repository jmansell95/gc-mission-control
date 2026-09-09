// ============================================================
// AFP Population — shared line-item builders + upsert helpers
// ============================================================
// Single source of truth for mapping billable field records to AFPLineItem
// objects. Used by BOTH:
//   • syncBillableItemToAFP — real-time entity automation (single-record upsert)
//   • populateAFPFromFieldData — bulk full-population on AFP creation / Refresh
//
// Sources covered: InvestigationLog, SubcontractorLog, DeliveryLog, DailyCost,
// JobCostItem (equipment/labour), Timesheet (approved only, grouped by date),
// JobAssetAssignment (plant hire, grouped by asset).

import { resolveRate, loadActiveContract } from './rateResolver.ts';

export function toNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function inRange(date: any, start?: string, end?: string): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export function parseBreakdown(breakdownStr: any): { rate_card_item_id?: string | null; unit_price?: number; rate_source?: string | null } {
  if (!breakdownStr) return {};
  try {
    const parsed = typeof breakdownStr === 'string' ? JSON.parse(breakdownStr) : breakdownStr;
    return {
      rate_card_item_id: parsed.rate_card_item_id || null,
      unit_price: toNum(parsed.unit_price),
      rate_source: parsed.source || parsed.rate_source || null,
    };
  } catch (_) {
    return {};
  }
}

// ── Find the draft AFP for a job whose period covers recordDate ──
// Real-time upserts only target draft AFPs (submitted/approved/invoiced are locked).
// If no draft AFP covers the date, fall back to the latest draft AFP so the
// record is queued for the next period; if no draft AFP exists at all, skip
// (the record will be picked up when the next AFP is created + auto-populated).
export async function resolveDraftAfpForJob(base44: any, jobId: string, recordDate?: string): Promise<any | null> {
  if (!jobId) return null;
  const afps = await base44.entities.AFP.filter({ job_id: jobId }, 'afp_number', 50);
  const date = recordDate ? recordDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const covering = afps.find(
    (a: any) => a.status === 'draft' &&
      (a.period_start_date || '') <= date &&
      (!a.period_end_date || a.period_end_date >= date)
  );
  if (covering) return covering;
  const drafts = afps.filter((a: any) => a.status === 'draft');
  if (drafts.length > 0) return drafts[drafts.length - 1];
  return null;
}

// ── Pure builders: map a source record to an AFPLineItem object ──
// Return null when the record is not billable and should be skipped.

export function buildFromInvestigationLog(afpId: string, jobId: string, log: any): any {
  const metres = toNum(log.metres_drilled) ||
    (log.depth_to != null && log.depth_from != null ? toNum(log.depth_to) - toNum(log.depth_from) : 0);
  const units = toNum(log.units_completed) || metres || 1;
  const chargeAmount = toNum(log.charge_amount);
  const breakdown = parseBreakdown(log.charge_breakdown);
  const rateCardItemId = breakdown.rate_card_item_id || null;
  const rate = chargeAmount > 0 && units > 0 ? Math.round((chargeAmount / units) * 100) / 100 : (breakdown.unit_price || 0);
  const isNoCharge = log.billing_status === 'no_charge' || (chargeAmount === 0 && !rateCardItemId);
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'drilling', category: 'drilling',
    item: log.description || `Drilling — ${log.borehole_ref || 'Borehole'}`,
    unit: metres > 0 ? 'm' : (log.units_label || 'nr'),
    qty: units, rate, amount: chargeAmount,
    source: 'driller_log', source_date: log.date, source_id: log.id,
    is_manual: false, dispute_status: 'none',
    original_amount: chargeAmount, agreed_amount: isNoCharge ? 0 : chargeAmount,
  };
}

export function buildFromSubcontractorLog(afpId: string, jobId: string, sc: any): any {
  const amt = toNum(sc.client_charge_net || sc.purchase_cost_net);
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'plant_hire', category: 'subcontractor',
    item: sc.description || sc.work_type || 'Subcontractor Work',
    unit: sc.purchase_rate_basis || 'sum',
    qty: toNum(sc.units_completed || sc.hours_worked || 1),
    rate: toNum(sc.purchase_rate), amount: amt,
    source: 'subcontractor', source_date: sc.date, source_id: sc.id,
    is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
  };
}

export function buildFromDeliveryLog(afpId: string, jobId: string, del: any): any {
  const stampedCharge = toNum(del.charge_amount);
  const amt = stampedCharge > 0 ? stampedCharge : toNum(del.cost || del.total_cost);
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'plant_hire', category: 'delivery',
    item: `Delivery — ${del.description || del.delivery_type || ''}`,
    unit: 'sum', qty: 1, rate: amt, amount: amt,
    source: 'delivery', source_date: del.delivery_date || del.date, source_id: del.id,
    is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
  };
}

export function buildFromDailyCost(afpId: string, jobId: string, cost: any): any {
  const stampedCharge = toNum(cost.client_charge);
  const amt = stampedCharge > 0 ? stampedCharge : toNum(cost.amount || cost.cost);
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'plant_hire', category: 'materials',
    item: cost.description || cost.category || 'Daily Cost',
    unit: 'sum', qty: 1, rate: amt, amount: amt,
    source: 'cost', source_date: cost.date, source_id: cost.id,
    is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
  };
}

export function buildFromBOQVariation(afpId: string, jobId: string, variation: any): any | null {
  // Only approved variations (status='complete', is_variation=true) are billable.
  if (!variation.is_variation || variation.status !== 'complete') return null;
  const qty = toNum(variation.agreed_quantity);
  const rate = toNum(variation.agreed_unit_price);
  const amount = Math.round(qty * rate * 100) / 100;
  if (amount <= 0) return null;
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'variations',
    category: variation.category || 'other',
    item: variation.description || 'Variation',
    unit: variation.unit || 'nr', qty, rate, amount,
    source: 'job_cost_item',
    source_date: variation.approved_at ? String(variation.approved_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    source_id: `boqvar_${variation.id}`,
    is_manual: false, dispute_status: 'none',
    original_amount: amount, agreed_amount: amount,
  };
}

export function buildFromHotelBooking(afpId: string, jobId: string, booking: any): any | null {
  const totalCost = toNum(booking.total_cost);
  if (totalCost <= 0) return null;
  const checkIn = (booking.check_in_date || '').slice(0, 10);
  const checkOut = (booking.check_out_date || '').slice(0, 10);
  let nights = 1;
  if (checkIn && checkOut) {
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    if (diff > 0) nights = diff;
  }
  const staffNames = (booking.assigned_staff_names || []).join(', ') || booking.staff_name || '';
  const hotelName = booking.hotel_name || 'Accommodation';
  const rate = Math.round((totalCost / nights) * 100) / 100;
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'plant_hire', category: 'accommodation',
    item: `Accommodation — ${hotelName}${staffNames ? ' (' + staffNames + ')' : ''}`,
    unit: 'night', qty: nights, rate, amount: totalCost,
    source: 'hotel_booking', source_date: checkIn, source_id: booking.id,
    is_manual: false, dispute_status: 'none',
    original_amount: totalCost, agreed_amount: totalCost,
  };
}

export function buildFromJobCostItem(afpId: string, jobId: string, item: any): any | null {
  // Exclude contractor/client-supplied (non-billable — no cost or charge to us)
  if (item.category === 'contractor_supplied' || item.category === 'client_supplied') return null;
  const unitCost = item.price_confirmed && item.negotiated_unit_cost != null
    ? toNum(item.negotiated_unit_cost)
    : toNum(item.unit_cost);
  const qty = toNum(item.quantity) || 1;
  const amount = Math.round(unitCost * qty * 100) / 100;
  const isLabour = item.category === 'labour';
  return {
    afp_id: afpId, job_id: jobId,
    sheet_name: isLabour ? 'drilling' : 'plant_hire',
    category: isLabour ? 'labour' : 'plant_hire',
    item: item.description || 'Job Cost Item',
    unit: item.unit_label || 'day', qty, rate: unitCost, amount,
    source: 'job_cost_item',
    source_date: item.start_date || (item.created_date ? String(item.created_date).slice(0, 10) : ''),
    source_id: item.id,
    is_manual: false, dispute_status: 'none', original_amount: amount, agreed_amount: amount,
  };
}

export function buildTimesheetGroupedLine(afpId: string, jobId: string, date: string, tsList: any[]): any | null {
  const totalHours = tsList.reduce((s, t) => s + toNum(t.hours || t.total_hours || t.regular_hours), 0);
  const stampedCharge = tsList.reduce((s, t) => s + toNum(t.charge_amount), 0);
  if (totalHours <= 0 && stampedCharge <= 0) return null;
  const rate = stampedCharge > 0 && totalHours > 0 ? Math.round((stampedCharge / totalHours) * 100) / 100 : 0;
  return {
    afp_id: afpId, job_id: jobId, sheet_name: 'drilling', category: 'labour',
    item: `Labour — ${date}`,
    unit: 'hour', qty: totalHours, rate, amount: stampedCharge,
    source: 'timesheet', source_date: date, source_id: `ts_${date}`,
    is_manual: false, dispute_status: 'none',
    original_amount: stampedCharge, agreed_amount: stampedCharge,
  };
}

// ── Upsert a single AFPLineItem by (afp_id + source + source_id) ──
// Idempotent: re-runs and re-triggered automations update in place, no duplicates.
export async function upsertAFPLineItem(base44: any, afpId: string, lineItem: any): Promise<string> {
  const existing = await base44.entities.AFPLineItem.filter(
    { afp_id: afpId, source: lineItem.source, source_id: lineItem.source_id },
    null, 5,
  );
  if (existing.length > 0) {
    await base44.entities.AFPLineItem.update(existing[0].id, lineItem);
    return existing[0].id;
  }
  const created = await base44.entities.AFPLineItem.create(lineItem);
  return created.id;
}

// ── Remove a grouped line item by source + source_id ──
// Used when a previously-included timesheet is rejected/withdrawn and no
// approved timesheets remain for that date.
export async function removeAFPLineItemByKey(base44: any, afpId: string, source: string, sourceId: string): Promise<void> {
  const existing = await base44.entities.AFPLineItem.filter(
    { afp_id: afpId, source, source_id: sourceId }, null, 5,
  );
  for (const li of existing) {
    try { await base44.entities.AFPLineItem.delete(li.id); } catch (_) {}
  }
}

// ── Recalculate AFP totals from all current line items ──
export async function recalcAfpTotals(base44: any, afpId: string): Promise<void> {
  const items = await base44.entities.AFPLineItem.filter({ afp_id: afpId }, 'sort_order', 500);
  let total = 0, original = 0, disputed = 0, agreed = 0;
  for (const li of items) {
    const amt = toNum(li.amount);
    total += amt;
    original += toNum(li.original_amount) || amt;
    if (li.dispute_status === 'disputed' || li.dispute_status === 'counter_offered') disputed += amt;
    if (li.dispute_status !== 'rejected') agreed += toNum(li.agreed_amount) || amt;
  }
  await base44.entities.AFP.update(afpId, {
    total_claimed: Math.round(total * 100) / 100,
    original_total: Math.round(original * 100) / 100,
    disputed_total: Math.round(disputed * 100) / 100,
    agreed_total: Math.round(agreed * 100) / 100,
    last_populated_at: new Date().toISOString(),
  });
}

// ── Rebuild the grouped timesheet line for a specific date ──
// Re-aggregates ALL approved timesheets for the job+date so the grouped line
// stays correct when one timesheet is approved/rejected/withdrawn.
export async function rebuildTimesheetLineForDate(base44: any, afpId: string, jobId: string, date: string): Promise<any> {
  const d = date.slice(0, 10);
  const allTs = await base44.entities.Timesheet.filter({ job_id: jobId, date: d }, '-created_date', 200);
  const approved = allTs.filter((t: any) => t.status === 'approved');
  const line = buildTimesheetGroupedLine(afpId, jobId, d, approved);
  if (line) {
    await upsertAFPLineItem(base44, afpId, line);
    return { action: 'upserted', hours: line.qty, amount: line.amount };
  }
  await removeAFPLineItemByKey(base44, afpId, 'timesheet', `ts_${d}`);
  return { action: 'removed' };
}

// ── Rebuild the grouped asset-hire line for a specific asset ──
// Re-aggregates all active assignments for the asset in the AFP period and
// re-resolves the daily hire rate from the rate card / contract.
export async function rebuildAssetLine(base44: any, afpId: string, jobId: string, assetId: string, activeContract?: any): Promise<any> {
  const afp = await base44.entities.AFP.get(afpId);
  const startDate = afp.period_start_date || '';
  const endDate = afp.period_end_date || new Date().toISOString().slice(0, 10);
  const allAssign = await base44.entities.JobAssetAssignment.filter(
    { job_id: jobId, asset_id: assetId }, '-created_date', 200,
  );
  const inPeriod = allAssign.filter((a: any) =>
    inRange(a.assigned_date, startDate, endDate) && (a.status === 'assigned' || a.status === 'on_site'),
  );
  if (inPeriod.length === 0) {
    await removeAFPLineItemByKey(base44, afpId, 'delivery', assetId);
    return { action: 'removed' };
  }
  const days = inPeriod.length;
  let asset: any = null;
  if (assetId) {
    try { asset = await base44.entities.SiteAsset.get(assetId); } catch (_) {}
  }
  const assetName = asset?.name || inPeriod[0].asset_name || 'Equipment';
  let rate = 0;
  const contract = activeContract || await loadActiveContract(base44, jobId);
  const resolved = await resolveRate(base44, {
    job_id: jobId, description: assetName, quantity: days,
    activeContract: contract, job_date: inPeriod[0].assigned_date,
  });
  if (resolved && resolved.unit_price > 0) {
    rate = resolved.unit_price;
  } else if (asset?.rate_card_item_id) {
    try {
      const rcItem = await base44.entities.RateCardItem.get(asset.rate_card_item_id);
      if (rcItem && Number(rcItem.price) > 0) rate = Number(rcItem.price);
    } catch (_) {}
  } else if (asset?.charge_out_price > 0) {
    rate = asset.charge_out_price;
  } else if (asset?.cost_price > 0) {
    rate = asset.cost_price;
  }
  const amount = Math.round(rate * days * 100) / 100;
  const line = {
    afp_id: afpId, job_id: jobId, sheet_name: 'plant_hire', category: 'plant_hire',
    item: `Plant Hire — ${assetName}`,
    unit: 'day', qty: days, rate, amount,
    source: 'delivery', source_date: inPeriod[0].assigned_date, source_id: assetId,
    is_manual: false, dispute_status: 'none', original_amount: amount, agreed_amount: amount,
  };
  await upsertAFPLineItem(base44, afpId, line);
  return { action: 'upserted', days, amount };
}

// ── High-level: sync a single source record to its AFP (real-time) ──
// Entry point for the syncBillableItemToAFP entity automation. Resolves the
// draft AFP, builds + upserts the line item (or rebuilds the grouped line for
// timesheet/asset sources), then recalculates AFP totals.
export async function syncSourceRecordToAFP(base44: any, sourceType: string, record: any): Promise<any> {
  const jobId = record.job_id;
  if (!jobId) return { skipped: 'no_job_id' };

  let recordDate: string | undefined;
  if (sourceType === 'timesheet') recordDate = (record.date || record.shift_date || '').slice(0, 10);
  else if (sourceType === 'asset_assignment') recordDate = (record.assigned_date || '').slice(0, 10);
  else if (sourceType === 'job_cost_item') recordDate = record.start_date || (record.created_date ? String(record.created_date).slice(0, 10) : '');
  else recordDate = (record.date || record.delivery_date || '').slice(0, 10);

  const afp = await resolveDraftAfpForJob(base44, jobId, recordDate);
  if (!afp) return { skipped: 'no_draft_afp' };

  let result: any;
  if (sourceType === 'timesheet') {
    result = await rebuildTimesheetLineForDate(base44, afp.id, jobId, recordDate);
  } else if (sourceType === 'asset_assignment') {
    result = await rebuildAssetLine(base44, afp.id, jobId, record.asset_id);
  } else {
    let line: any = null;
    if (sourceType === 'driller_log') line = buildFromInvestigationLog(afp.id, jobId, record);
    else if (sourceType === 'subcontractor') line = buildFromSubcontractorLog(afp.id, jobId, record);
    else if (sourceType === 'delivery') line = buildFromDeliveryLog(afp.id, jobId, record);
    else if (sourceType === 'cost') line = buildFromDailyCost(afp.id, jobId, record);
    else if (sourceType === 'job_cost_item') line = buildFromJobCostItem(afp.id, jobId, record);
    else if (sourceType === 'boq_variation') line = buildFromBOQVariation(afp.id, jobId, record);
    if (!line) return { skipped: 'not_billable' };
    await upsertAFPLineItem(base44, afp.id, line);
    result = { action: 'upserted', amount: line.amount };
  }
  await recalcAfpTotals(base44, afp.id);
  return { success: true, afp_id: afp.id, ...result };
}

// ── Bulk full-population of an AFP from all billable sources in its period ──
// Used by both the user-invoked populateAFPFromFieldData (Refresh button) and
// the autoPopulateNewAFP entity automation (fires when a new AFP is created).
// Fetches every billable source for the job, filters to the AFP period,
// deletes existing auto items (preserving manual), rebuilds via the shared
// builders, bulk-creates, and recalculates totals.
export async function bulkPopulateAFP(base44: any, afpId: string, userName: string): Promise<any> {
  const afp = await base44.entities.AFP.get(afpId);
  if (!afp) throw new Error('AFP not found');

  const startDate = afp.period_start_date || '';
  const endDate = afp.period_end_date || new Date().toISOString().slice(0, 10);

  const [logs, subcons, timesheets, deliveries, costs, assignments, costItems, boqVariations] = await Promise.all([
    base44.entities.InvestigationLog.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.SubcontractorLog.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.Timesheet.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.DeliveryLog.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.DailyCost.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.JobAssetAssignment.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.JobCostItem.filter({ job_id: afp.job_id }, '-created_date', 500),
    base44.entities.JobBillOfQuantities.filter({ job_id: afp.job_id, is_variation: true, status: 'complete' }, '-approved_at', 500),
    base44.entities.HotelBooking.filter({ job_id: afp.job_id }, '-created_date', 500),
  ]);

  const fLogs = logs.filter((l: any) => inRange(l.date, startDate, endDate));
  const fSubcons = subcons.filter((s: any) => inRange(s.date, startDate, endDate));
  const fTimesheets = timesheets.filter((t: any) => t.status === 'approved' && inRange(t.date || t.shift_date, startDate, endDate));
  const fDeliveries = deliveries.filter((d: any) => inRange(d.delivery_date || d.date, startDate, endDate));
  const fCosts = costs.filter((c: any) => inRange(c.date, startDate, endDate));
  const fAssignments = assignments.filter((a: any) => inRange(a.assigned_date, startDate, endDate) && (a.status === 'assigned' || a.status === 'on_site'));
  const fCostItems = costItems.filter((ci: any) => inRange(ci.start_date, startDate, endDate));
  const fHotelBookings = hotelBookings.filter((hb: any) =>
    inRange(hb.check_in_date, startDate, endDate) && toNum(hb.total_cost) > 0
  );

  // Delete existing auto-populated items (keep manual + uploaded variation breakdowns)
  const existing = await base44.entities.AFPLineItem.filter({ afp_id: afpId }, 'sort_order', 500);
  const autoIds = existing.filter((li: any) =>
    li.source !== 'manual' && !li.is_manual &&
    !(li.is_variation_breakdown && li.source === 'afp_upload')
  ).map((li: any) => li.id);
  for (const id of autoIds) {
    try { await base44.entities.AFPLineItem.delete(id); } catch (_) {}
  }

  const newItems: any[] = [];
  let sortOrder = 0;
  const push = (line: any) => { if (line) newItems.push({ ...line, sort_order: sortOrder++ }); };

  for (const log of fLogs) push(buildFromInvestigationLog(afpId, afp.job_id, log));
  for (const sc of fSubcons) push(buildFromSubcontractorLog(afpId, afp.job_id, sc));

  const tsByDate: Record<string, any[]> = {};
  for (const ts of fTimesheets) {
    const d = (ts.date || ts.shift_date || '').slice(0, 10);
    if (!d) continue;
    if (!tsByDate[d]) tsByDate[d] = [];
    tsByDate[d].push(ts);
  }
  for (const [date, tsList] of Object.entries(tsByDate)) {
    push(buildTimesheetGroupedLine(afpId, afp.job_id, date, tsList));
  }

  for (const del of fDeliveries) push(buildFromDeliveryLog(afpId, afp.job_id, del));
  for (const cost of fCosts) push(buildFromDailyCost(afpId, afp.job_id, cost));
  for (const ci of fCostItems) push(buildFromJobCostItem(afpId, afp.job_id, ci));
  for (const bv of boqVariations) push(buildFromBOQVariation(afpId, afp.job_id, bv));
  for (const hb of fHotelBookings) push(buildFromHotelBooking(afpId, afp.job_id, hb));

  // Asset assignments (grouped by asset, rate-resolved)
  const assetGroups: Record<string, any[]> = {};
  for (const a of fAssignments) {
    const key = a.asset_id;
    if (!assetGroups[key]) assetGroups[key] = [];
    assetGroups[key].push(a);
  }
  const assetIds = [...new Set(fAssignments.map((a: any) => a.asset_id).filter(Boolean))];
  const siteAssets = assetIds.length > 0
    ? await base44.entities.SiteAsset.filter({ id: { $in: assetIds } }, '-created_date', 500)
    : [];
  const assetById = new Map(siteAssets.map((s: any) => [s.id, s]));
  const activeContract = await loadActiveContract(base44, afp.job_id);
  for (const [, assignList] of Object.entries(assetGroups)) {
    const days = assignList.length;
    const asset = assetById.get(assignList[0].asset_id);
    const assetName = asset?.name || assignList[0].asset_name || 'Equipment';
    let rate = 0;
    const resolved = await resolveRate(base44, {
      job_id: afp.job_id, description: assetName, quantity: days,
      activeContract, job_date: assignList[0].assigned_date,
    });
    if (resolved && resolved.unit_price > 0) {
      rate = resolved.unit_price;
    } else if (asset?.rate_card_item_id) {
      try {
        const rcItem = await base44.entities.RateCardItem.get(asset.rate_card_item_id);
        if (rcItem && Number(rcItem.price) > 0) rate = Number(rcItem.price);
      } catch (_) {}
    } else if (asset?.charge_out_price > 0) {
      rate = asset.charge_out_price;
    } else if (asset?.cost_price > 0) {
      rate = asset.cost_price;
    }
    const amount = Math.round(rate * days * 100) / 100;
    newItems.push({
      afp_id: afpId, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'plant_hire',
      item: `Plant Hire — ${assetName}`,
      unit: 'day', qty: days, rate, amount,
      source: 'delivery', source_date: assignList[0].assigned_date, source_id: assignList[0].asset_id,
      is_manual: false, dispute_status: 'none', original_amount: amount, agreed_amount: amount,
      sort_order: sortOrder++,
    });
  }

  // ── Pricing step: resolve rates for driller_log items with rate=0 ──
  // Imported KeyLogBook AGS logs have no billing data — price them against
  // the job rate card → global Master Price List via the rate resolver.
  for (const item of newItems) {
    if (item.source === 'driller_log' && toNum(item.rate) === 0 && toNum(item.amount) === 0) {
      try {
        const resolved = await resolveRate(base44, {
          job_id: afp.job_id,
          description: item.item,
          quantity: item.qty,
          activeContract,
          job_date: item.source_date,
        });
        if (resolved && resolved.unit_price > 0) {
          item.rate = resolved.unit_price;
          item.amount = Math.round(resolved.unit_price * toNum(item.qty) * 100) / 100;
          item.original_amount = item.amount;
          item.agreed_amount = item.amount;
        }
      } catch (_) { /* rate resolution failed — leave at 0 */ }
    }
  }

  if (newItems.length > 0) await base44.entities.AFPLineItem.bulkCreate(newItems);

  // Recalculate totals
  const remaining = await base44.entities.AFPLineItem.filter({ afp_id: afpId }, 'sort_order', 500);
  const total = remaining.reduce((s: number, li: any) => s + toNum(li.amount), 0);
  const agreedTotal = remaining
    .filter((li: any) => li.dispute_status !== 'rejected')
    .reduce((s: number, li: any) => s + toNum(li.agreed_amount || li.amount), 0);

  await base44.entities.AFP.update(afpId, {
    total_claimed: total,
    original_total: total,
    agreed_total: agreedTotal,
    last_populated_at: new Date().toISOString(),
    last_populated_by: userName,
    last_updated_at: new Date().toISOString(),
    last_updated_by: userName,
  });

  return {
    populated: newItems.length,
    total_items: remaining.length,
    sources: {
      driller_logs: fLogs.length,
      subcontractors: fSubcons.length,
      timesheets: fTimesheets.length,
      deliveries: fDeliveries.length,
      daily_costs: fCosts.length,
      asset_assignments: fAssignments.length,
      job_cost_items: fCostItems.length,
      boq_variations: boqVariations.length,
      hotel_bookings: fHotelBookings.length,
    },
    total,
    agreed_total: agreedTotal,
  };
}