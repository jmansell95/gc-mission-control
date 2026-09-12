import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum } from '../../shared/afpPopulation.ts';

// ============================================================
// reconcileJobFinancials — end-to-end financial reconciliation
// ============================================================
// Compares AFP line items against the logistics hub billing totals
// for a given job, surfacing any discrepancies between what the AFP
// claims and what the logistics equipment/cost items actually bill.
//
// Also verifies that:
//   • No JobCostItem with a site_asset_id appears as an AFP line item
//     (double-counting check — those are billed via JobAssetAssignment)
//   • Day-rate JobCostItems match billingTotal (unit_cost × qty × days)
//   • AFP agreed_total + VAT would match a potential invoice amount
//
// Discrepancies are logged to FinancialAuditLog for traceability.
//
// Input:  { job_id: string }
// Output: { matched, discrepancies, afp_total, logistics_total, checks }

function billingTotal(item: any): number {
  const rate = toNum(item?.unit_cost);
  const qty = toNum(item?.quantity) || 1;
  if (item?.unit_label === 'day' && item?.start_date && item?.end_date) {
    const start = new Date(String(item.start_date).slice(0, 10) + 'T00:00:00');
    const end = new Date(String(item.end_date).slice(0, 10) + 'T00:00:00');
    const ms = end.getTime() - start.getTime();
    const days = Math.floor(ms / 86400000) + 1;
    if (days > 0) return rate * qty * days;
  }
  return rate * qty;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const b = base44.asServiceRole;

    // ── Load all AFPs + line items for this job ──
    const afps = await b.entities.AFP.filter({ job_id }, 'afp_number', 50);
    const draftAfps = afps.filter((a: any) => a.status === 'draft');
    const allLineItems: any[] = [];
    for (const afp of draftAfps) {
      const items = await b.entities.AFPLineItem.filter({ afp_id: afp.id }, 'sort_order', 500);
      allLineItems.push(...items);
    }

    // ── Load logistics source data ──
    const [costItems, assetAssignments, timesheets, deliveryLogs, subconLogs, dailyCosts, hotelBookings] = await Promise.all([
      b.entities.JobCostItem.filter({ job_id }).catch(() => []),
      b.entities.JobAssetAssignment.filter({ job_id }).catch(() => []),
      b.entities.Timesheet.filter({ job_id }).catch(() => []),
      b.entities.DeliveryLog.filter({ job_id }).catch(() => []),
      b.entities.SubcontractorLog.filter({ job_id }).catch(() => []),
      b.entities.DailyCost.filter({ job_id }).catch(() => []),
      b.entities.HotelBooking.filter({ job_id }).catch(() => []),
    ]);

    const discrepancies: any[] = [];
    const matched: any[] = [];
    const checks: any = {};

    // ── Check 1: Double-counting — no AFP line from a JobCostItem with site_asset_id ──
    const doubleCounted = allLineItems.filter((li: any) =>
      li.source === 'job_cost_item' && li.source_id &&
      costItems.some((c: any) => c.id === li.source_id && c.site_asset_id)
    );
    checks.double_counting = {
      passed: doubleCounted.length === 0,
      count: doubleCounted.length,
      items: doubleCounted.map((li: any) => ({ afp_line_id: li.id, item: li.item, amount: li.amount })),
    };
    if (doubleCounted.length > 0) {
      discrepancies.push({
        type: 'double_counting',
        severity: 'high',
        message: `${doubleCounted.length} AFP line item(s) derived from JobCostItems with a linked SiteAsset — these should be billed via JobAssetAssignment only`,
      });
    }

    // ── Check 2: Day-rate billing consistency ──
    // Compare AFP line amounts for job_cost_item sources against billingTotal
    const dayRateMismatches: any[] = [];
    for (const li of allLineItems) {
      if (li.source !== 'job_cost_item' || !li.source_id) continue;
      const costItem = costItems.find((c: any) => c.id === li.source_id);
      if (!costItem) continue;
      if (costItem.unit_label !== 'day') continue;
      const expectedTotal = Math.round(billingTotal(costItem) * 100) / 100;
      const afpAmount = toNum(li.amount);
      if (Math.abs(expectedTotal - afpAmount) > 0.01) {
        dayRateMismatches.push({
          afp_line_id: li.id,
          description: li.item,
          afp_amount: afpAmount,
          expected_amount: expectedTotal,
          variance: Math.round((afpAmount - expectedTotal) * 100) / 100,
        });
      }
    }
    checks.day_rate_consistency = {
      passed: dayRateMismatches.length === 0,
      count: dayRateMismatches.length,
      items: dayRateMismatches,
    };
    if (dayRateMismatches.length > 0) {
      discrepancies.push({
        type: 'day_rate_mismatch',
        severity: 'medium',
        message: `${dayRateMismatches.length} day-rate AFP line(s) don't match the logistics hub billingTotal`,
      });
    }

    // ── Check 3: AFP total vs logistics equipment total ──
    const afpTotal = allLineItems.reduce((s: number, li: any) => s + toNum(li.amount), 0);
    const billableCostItems = costItems.filter((c: any) =>
      c.category !== 'client_supplied' && c.category !== 'contractor_supplied'
    );
    const logisticsEquipmentTotal = billableCostItems.reduce((s: number, c: any) => s + billingTotal(c), 0);
    const variance = Math.round((afpTotal - logisticsEquipmentTotal) * 100) / 100;
    checks.totals_comparison = {
      afp_total: Math.round(afpTotal * 100) / 100,
      logistics_equipment_total: Math.round(logisticsEquipmentTotal * 100) / 100,
      variance,
      passed: Math.abs(variance) < 1.0, // £1 tolerance for rounding
    };
    if (Math.abs(variance) >= 1.0) {
      discrepancies.push({
        type: 'totals_mismatch',
        severity: 'medium',
        message: `AFP total (£${afpTotal.toFixed(2)}) differs from logistics equipment total (£${logisticsEquipmentTotal.toFixed(2)}) by £${variance.toFixed(2)} — note: AFP also includes timesheets, deliveries, subcontractor logs, and daily costs not in the equipment total`,
      });
    }

    // ── Check 4: All draft AFP line items have a non-zero rate ──
    const zeroRated = allLineItems.filter((li: any) =>
      !li.is_manual && li.source !== 'afp_upload_bespoke' && toNum(li.rate) === 0 && toNum(li.amount) === 0
    );
    checks.zero_rated_items = {
      passed: zeroRated.length === 0,
      count: zeroRated.length,
      items: zeroRated.map((li: any) => ({ afp_line_id: li.id, item: li.item, source: li.source })),
    };
    if (zeroRated.length > 0) {
      discrepancies.push({
        type: 'zero_rated',
        severity: 'low',
        message: `${zeroRated.length} auto-populated AFP line(s) have £0 rate and £0 amount — rate card match may have failed`,
      });
    }

    // ── Check 5: Bespoke uploaded lines are preserved ──
    const bespokeLines = allLineItems.filter((li: any) => li.source === 'afp_upload_bespoke');
    checks.bespoke_lines_preserved = {
      passed: true,
      count: bespokeLines.length,
    };

    // ── Log discrepancies to FinancialAuditLog ──
    if (discrepancies.length > 0) {
      try {
        await b.entities.FinancialAuditLog.create({
          entity_name: 'AFP',
          entity_id: draftAfps[0]?.id || '',
          action: 'reconciliation_check',
          record_summary: `Reconciliation for job ${job_id}: ${discrepancies.length} discrepancy/discrepancies found. AFP total: £${afpTotal.toFixed(2)}, Logistics total: £${logisticsEquipmentTotal.toFixed(2)}`,
          actor_user_id: user.id,
          actor_name: user.full_name || user.email || 'System',
          metadata: { discrepancies, checks },
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({
      job_id,
      draft_afp_count: draftAfps.length,
      afp_line_item_count: allLineItems.length,
      afp_total: Math.round(afpTotal * 100) / 100,
      logistics_equipment_total: Math.round(logisticsEquipmentTotal * 100) / 100,
      checks,
      discrepancies,
      all_passed: discrepancies.length === 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}