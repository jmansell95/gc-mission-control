import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr, logFinancialAudit } from '../../shared/cvrHelpers.ts';
import { bulkPopulateAFP } from '../../shared/afpPopulation.ts';

// Inline AFP date helpers (mirrors src/utils/afpDates.js for backend use)
function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const defaultCertificationDue = (end: string) => addDays(end, 5);
const defaultFinalPaymentNotice = (end: string) => addDays(end, 30);

/**
 * commitAFPParse — takes the confirmed parsed Lump Sum AFP data and creates
 * the AFP + AFPLineItem records linked to the job.
 *
 * Two modes:
 * 1. Multi-AFP split (when preview.afp_split has entries): creates one AFP per
 *    monthly period, chained via next_afp_id. Field Sheet daily quantities are
 *    aggregated into each period's Measured Works lines (Applied in Period =
 *    this period's qty, Previous Applied = cumulative prior, Gross Applied =
 *    running total). Variations assigned by VO date, Compensation Items by
 *    their date columns, Materials to the first AFP.
 * 2. Single AFP (when no afp_split): legacy behaviour — one AFP with all lines.
 *
 * All new dual-side (Application / Assessment / Balance) and variation
 * cost-agreement lifecycle fields are populated on each AFPLineItem.
 *
 * Input:  { job_id, preview, source_file_url, source_file_name }
 * Output: { afps_created, total_line_items, total_claimed, variation_count }
 */

// Seed the job's BOQ (JobBillOfQuantities) from the AFP Measured Works tab.
// Only runs when the job has NO existing BOQ lines — so re-uploading a later
// AFP never overwrites an already-established agreed scope.
async function seedBOQFromMeasuredWorks(base44, job, measuredWorks) {
  if (!measuredWorks || measuredWorks.length === 0) return { seeded: 0, skipped: false };

  // Skip if BOQ already exists for this job
  const existing = await base44.asServiceRole.entities.JobBillOfQuantities.filter(
    { job_id: job.id }, undefined, 1
  );
  if (existing.length > 0) return { seeded: 0, skipped: true };

  // Load global rate card items for auto-matching rate_card_item_id
  let rateItems: any[] = [];
  try {
    rateItems = await base44.asServiceRole.entities.RateCardItem.filter(
      { rate_card_source: 'our_company', is_active: true }, 'sort_order', 500
    );
  } catch (_) { /* non-fatal — BOQ lines created without rate link */ }

  const payload: any[] = [];
  let sortOrder = 0;

  for (const mw of measuredWorks) {
    const description = String(mw.item || '').trim();
    const qty = toNum(mw.qty);
    const rate = toNum(mw.rate);
    if (!description || qty <= 0) continue;

    // Match against rate card by description (exact first, then contains)
    let matchedRateId: string | null = null;
    if (description && rateItems.length > 0) {
      const descLower = description.toLowerCase().trim();
      const exact = rateItems.find((r: any) =>
        String(r.description || '').toLowerCase().trim() === descLower
      );
      if (exact) {
        matchedRateId = exact.id;
      } else {
        const contains = rateItems.find((r: any) => {
          const rDesc = String(r.description || '').toLowerCase().trim();
          return rDesc && (rDesc.includes(descLower) || descLower.includes(rDesc));
        });
        if (contains) matchedRateId = contains.id;
      }
    }

    payload.push({
      job_id: job.id,
      project_id: null,
      rate_card_item_id: matchedRateId,
      sor_ref: String(mw.item_ref || '').trim(),
      description,
      unit: String(mw.unit || '').trim() || 'nr',
      agreed_quantity: qty,
      agreed_unit_price: rate,
      agreed_line_total: Math.round(qty * rate * 100) / 100,
      actual_quantity: 0,
      remaining_quantity: qty,
      variation_quantity: 0,
      status: 'not_started',
      is_variation: false,
      sort_order: sortOrder++,
    });
  }

  if (payload.length === 0) return { seeded: 0, skipped: false };

  const created = await base44.asServiceRole.entities.JobBillOfQuantities.bulkCreate(payload);

  // Run variation check to populate actuals
  try {
    await base44.asServiceRole.functions.invoke('checkBOQVariations', { job_id: job.id });
  } catch (_) { /* non-fatal */ }

  return { seeded: created.length, skipped: false };
}

function matchActivityToMeasuredWork(activity, measuredWorks) {
  const desc = (activity.description || activity.activity || '').toLowerCase().trim();
  const itemRef = (activity.item || '').toLowerCase().trim();
  if (!desc && !itemRef) return null;
  // Exact item_ref match first
  if (itemRef) {
    const byRef = measuredWorks.find(mw => (mw.item_ref || '').toLowerCase().trim() === itemRef);
    if (byRef) return byRef;
  }
  // Exact description match
  if (desc) {
    const byDesc = measuredWorks.find(mw => (mw.item || '').toLowerCase().trim() === desc);
    if (byDesc) return byDesc;
  }
  // Contains match (activity description contained in MW description or vice versa)
  if (desc) {
    const contains = measuredWorks.find(mw => {
      const mwDesc = (mw.item || '').toLowerCase().trim();
      return mwDesc && (mwDesc.includes(desc) || desc.includes(mwDesc));
    });
    if (contains) return contains;
  }
  return null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, preview, source_file_url, source_file_name } = body;
    if (!job_id || !preview) return Response.json({ error: 'job_id and preview are required' }, { status: 400 });

    const jobs = await base44.entities.Job.filter({ id: job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const cd = preview.contract_details || {};
    const measuredWorks = preview.measured_works || [];
    const variations = preview.variations || [];
    const variationBreakdowns = preview.variation_breakdowns || [];
    const materials = preview.materials || [];
    const fieldActivities = preview.field_sheet_activities || [];
    const compensationItems = preview.compensation_items || [];
    const afpSplit = preview.afp_split || [];

    const userName = user.full_name || user.email || '';
    const now = new Date().toISOString();

    // ── EWR direct-parse override ──
    // EWR jobs are parsed directly from the EWR-specific Excel format.
    // The uploaded file IS the AFP — no template or field-data population is used.
    if (preview.is_ewr) {
      const ewrSheets = preview.ewr_sheets || {};
      const afpPeriods = preview.afp_periods || [];

      const existingAfps = await base44.entities.AFP.filter({ job_id }, 'afp_number', 50);
      const createdAfpIds: string[] = [];
      let totalLineItems = 0;
      let totalClaimed = 0;

      for (const period of afpPeriods) {
        const afpNumber = period.afp_number;
        const existing = existingAfps.find(a => a.afp_number === afpNumber);
        if (existing && existing.status !== 'draft') continue;

        const periodStart = period.period_start || '';
        const periodEnd = period.period_end || '';
        const afpData: any = {
          job_id, job_name: job.name, job_reference: job.job_reference || '',
          division_id: job.division_id || '', afp_number: afpNumber,
          period_start_date: periodStart, period_end_date: periodEnd,
          certification_due_date: periodEnd ? defaultCertificationDue(periodEnd) : '',
          final_payment_notice_date: periodEnd ? defaultFinalPaymentNotice(periodEnd) : '',
          client_po: cd.client_purchase_order || '',
          gc_job_number: cd.gc_job_number || job.job_reference || '',
          client_name: cd.client || '',
          contract_value: toNum(cd.contract_award_value) || 0,
          status: 'draft',
          source_file_url: source_file_url || '',
          source_file_name: source_file_name || '',
          last_updated_at: now, last_updated_by: userName,
        };

        let afpId: string;
        if (existing) {
          await base44.entities.AFPLineItem.deleteMany({ afp_id: existing.id });
          await base44.entities.AFP.update(existing.id, afpData);
          afpId = existing.id;
        } else {
          const afp = await base44.entities.AFP.create(afpData);
          afpId = afp.id;
        }
        createdAfpIds.push(afpId);

        const lineItems: any[] = [];
        let sortOrder = 0;

        // Drilling lines (Rotary + CP) — one line item per drilling row per AFP period
        const drillingSheets: [string, string][] = [
          ['rotary_drilling', 'ewr_rotary_drilling'],
          ['cp_drilling', 'ewr_cp_drilling'],
        ];
        for (const [sheetKey, sheetName] of drillingSheets) {
          for (const item of (ewrSheets[sheetKey] || [])) {
            const periodData = item.per_period?.[afpNumber];
            if (!periodData || periodData.period_qty === 0) continue;
            lineItems.push({
              afp_id: afpId, job_id, sheet_name: sheetName, category: 'drilling',
              item: item.description, unit: item.unit || '',
              qty: periodData.period_qty, rate: item.rate,
              amount: periodData.period_amount, unit_price: item.rate,
              applied_in_period: periodData.period_amount,
              week_breakdown: periodData.boreholes.map((b: any) => ({ week_date: b.ref, qty: b.qty })),
              source: 'afp_upload', source_date: periodStart,
              is_manual: false, dispute_status: 'none',
              original_amount: periodData.period_amount, agreed_amount: periodData.period_amount,
              sort_order: sortOrder++,
            });
          }
        }

        // Dayworks lines (Rotary + CP)
        const dayworksSheets: [string, string][] = [
          ['rotary_dayworks', 'ewr_rotary_dayworks'],
          ['cp_dayworks', 'ewr_cp_dayworks'],
        ];
        for (const [sheetKey, sheetName] of dayworksSheets) {
          for (const entry of (ewrSheets[sheetKey] || [])) {
            if (entry.afp_number !== afpNumber) continue;
            const ctx = [entry.crew, entry.bh_location, entry.start_time, entry.end_time].filter(Boolean).join(' · ');
            lineItems.push({
              afp_id: afpId, job_id, sheet_name: sheetName, category: 'labour',
              item: ctx ? `${entry.description} — ${ctx}` : entry.description,
              unit: 'hour', qty: entry.qty, rate: entry.rate,
              amount: entry.net_total, unit_price: entry.rate,
              applied_in_period: entry.net_total,
              assessed_in_period: entry.assessed_total || 0,
              source: 'afp_upload', source_date: entry.date || periodStart,
              is_manual: false, dispute_status: 'none',
              original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
              sort_order: sortOrder++,
            });
          }
        }

        // Enabling crew
        for (const entry of (ewrSheets.enabling_crew || [])) {
          if (entry.afp_number !== afpNumber) continue;
          lineItems.push({
            afp_id: afpId, job_id, sheet_name: 'ewr_enabling_crew', category: 'labour',
            item: entry.resource_name, unit: 'Day', qty: entry.qty,
            rate: entry.rate, amount: entry.net_total, unit_price: entry.rate,
            applied_in_period: entry.net_total, assessed_in_period: entry.assessed_total || 0,
            source: 'afp_upload', source_date: entry.start_date || periodStart,
            is_manual: false, dispute_status: 'none',
            original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
            sort_order: sortOrder++,
          });
        }

        // Accommodation
        for (const entry of (ewrSheets.accommodation || [])) {
          if (entry.afp_number !== afpNumber) continue;
          lineItems.push({
            afp_id: afpId, job_id, sheet_name: 'ewr_accommodation', category: 'other',
            item: `Accommodation — ${entry.resource_name}`, unit: 'night', qty: entry.nights,
            rate: entry.rate, amount: entry.net_total, unit_price: entry.rate,
            applied_in_period: entry.net_total, assessed_in_period: entry.assessed_total || 0,
            source: 'afp_upload', source_date: entry.start_date || periodStart,
            is_manual: false, dispute_status: 'none',
            original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
            sort_order: sortOrder++,
          });
        }

        // Misc
        for (const entry of (ewrSheets.misc || [])) {
          if (entry.afp_number !== afpNumber) continue;
          lineItems.push({
            afp_id: afpId, job_id, sheet_name: 'ewr_misc', category: 'other',
            item: entry.resource_name, unit: entry.unit || '', qty: entry.qty,
            rate: entry.rate, amount: entry.net_total, unit_price: entry.rate,
            applied_in_period: entry.net_total, assessed_in_period: entry.assessed_total || 0,
            source: 'afp_upload', source_date: entry.date || periodStart,
            is_manual: false, dispute_status: 'none',
            original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
            sort_order: sortOrder++,
          });
        }

        // Hires
        for (const entry of (ewrSheets.hires || [])) {
          if (entry.afp_number !== afpNumber) continue;
          lineItems.push({
            afp_id: afpId, job_id, sheet_name: 'ewr_hires', category: 'plant_hire',
            item: entry.resource_name, unit: entry.unit || '', qty: entry.qty,
            rate: entry.rate, amount: entry.net_total, unit_price: entry.rate,
            applied_in_period: entry.net_total, assessed_in_period: entry.assessed_total || 0,
            source: 'afp_upload', source_date: entry.date || periodStart,
            is_manual: false, dispute_status: 'none',
            original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
            sort_order: sortOrder++,
          });
        }

        // Mileage — assign all to the first AFP
        if (afpNumber === 1) {
          for (const entry of (ewrSheets.mileage || [])) {
            lineItems.push({
              afp_id: afpId, job_id, sheet_name: 'ewr_mileage', category: 'delivery',
              item: `Mileage — ${entry.vehicle_driver || ''}`, unit: 'mile',
              qty: entry.chargeable || entry.total || 0,
              rate: entry.rate, amount: entry.net_total, unit_price: entry.rate,
              applied_in_period: entry.net_total, assessed_in_period: entry.assessed_total || 0,
              source: 'afp_upload', source_date: entry.date || periodStart,
              is_manual: false, dispute_status: 'none',
              original_amount: entry.net_total, agreed_amount: entry.assessed_total || entry.net_total,
              sort_order: sortOrder++,
            });
          }
        }

        // Bulk create with verification
        if (lineItems.length > 0) {
          await base44.entities.AFPLineItem.bulkCreate(lineItems);
          const verify = await base44.entities.AFPLineItem.filter({ afp_id: afpId }, undefined, 1);
          if (verify.length === 0) {
            for (const li of lineItems) await base44.entities.AFPLineItem.create(li);
          }
          totalLineItems += lineItems.length;
        }

        const periodClaimed = lineItems.reduce((s, li) => s + toNum(li.applied_in_period), 0);
        totalClaimed += periodClaimed;
        await base44.entities.AFP.update(afpId, {
          total_claimed: Math.round(periodClaimed * 100) / 100,
          original_total: Math.round(periodClaimed * 100) / 100,
          agreed_total: Math.round(periodClaimed * 100) / 100,
        });
      }

      // Chain AFPs via next_afp_id
      for (let i = 0; i < createdAfpIds.length - 1; i++) {
        await base44.entities.AFP.update(createdAfpIds[i], { next_afp_id: createdAfpIds[i + 1] });
      }

      await logFinancialAudit(base44, {
        entity_name: 'AFP', entity_id: createdAfpIds[0], action: 'create',
        record_summary: `EWR direct-parse AFP import for ${job.name}: ${createdAfpIds.length} AFPs, ${totalLineItems} line items, £${Math.round(totalClaimed).toLocaleString()} total`,
        actor_user_id: user.id, actor_name: userName,
      });

      return Response.json({
        afps_created: createdAfpIds.length, afp_ids: createdAfpIds,
        total_line_items: totalLineItems, total_claimed: Math.round(totalClaimed * 100) / 100,
        variation_count: 0, ewr_direct_parse: true,
      });
    }

    // ── Multi-AFP split mode ──
    if (afpSplit.length > 0) {
      // Fetch existing AFPs for this job so we can upsert by afp_number.
      // Only draft AFPs are updated in place; submitted/approved/invoiced AFPs
      // are never touched — their periods are skipped entirely.
      const existingAfps = await base44.entities.AFP.filter({ job_id }, 'afp_number', 50);

      const createdAfpIds: string[] = [];
      let totalLineItems = 0;
      let totalClaimed = 0;
      let variationCount = 0;

      // Pre-compute cumulative applied quantities per measured work line across periods
      // Keyed by item_ref (or description) → running cumulative qty
      const cumulativeApplied: Record<string, number> = {};

      for (let i = 0; i < afpSplit.length; i++) {
        const period = afpSplit[i];
        const periodStart = period.period_start;
        const periodEnd = period.period_end;
        const periodMonth = period.month;

        const afpData: any = {
          job_id,
          job_name: job.name,
          job_reference: job.job_reference || '',
          division_id: job.division_id || '',
          afp_number: period.afp_number,
          period_start_date: periodStart,
          period_end_date: periodEnd,
          certification_due_date: defaultCertificationDue(periodEnd),
          final_payment_notice_date: defaultFinalPaymentNotice(periodEnd),
          client_po: cd.client_purchase_order || '',
          gc_job_number: cd.gc_job_number || job.job_reference || '',
          client_name: cd.client || '',
          contract_value: toNum(cd.contract_award_value),
          status: 'draft',
          source_file_url: source_file_url || '',
          source_file_name: source_file_name || '',
          last_updated_at: now,
          last_updated_by: userName,
        };

        // Upsert by afp_number: reuse existing draft AFP if present, skip
        // non-draft AFPs entirely, create new when no match exists.
        const existingForNumber = existingAfps.find(a => a.afp_number === period.afp_number);
        if (existingForNumber && existingForNumber.status !== 'draft') {
          continue; // already submitted/approved/invoiced — don't touch
        }
        let afpId: string;
        if (existingForNumber) {
          await base44.entities.AFPLineItem.deleteMany({ afp_id: existingForNumber.id });
          await base44.entities.AFP.update(existingForNumber.id, afpData);
          afpId = existingForNumber.id;
        } else {
          const afp = await base44.entities.AFP.create(afpData);
          afpId = afp.id;
        }
        createdAfpIds.push(afpId);

        const lineItems: any[] = [];
        let sortOrder = 0;

        // ── Measured Works lines (with dual-side from Field Sheet daily data) ──
        for (const mw of measuredWorks) {
          const key = mw.item_ref || mw.item || '';
          const rate = toNum(mw.rate);
          // Find matching field sheet activity
          const matchingActivity = fieldActivities.find(act => matchActivityToMeasuredWork(act, [mw]) !== null);

          // Sum daily quantities in this period
          let periodQty = 0;
          let periodAmount = 0;
          if (matchingActivity && matchingActivity.daily) {
            for (const [d, q] of Object.entries(matchingActivity.daily)) {
              if (d.slice(0, 7) === periodMonth) periodQty += toNum(q);
            }
            periodAmount = periodQty * rate;
          }
          // Fallback: if no Field Sheet data and this is AFP 1, use the MW sheet's
          // applied_in_period (already an AMOUNT, not a quantity) directly.
          if (periodAmount === 0 && i === 0 && toNum(mw.applied_in_period) > 0) {
            periodAmount = toNum(mw.applied_in_period);
            periodQty = rate > 0 ? periodAmount / rate : 0;
          }

          const previousApplied = cumulativeApplied[key] || toNum(mw.previous_applied);
          const grossApplied = previousApplied + periodQty;
          cumulativeApplied[key] = grossApplied;

          const contractedQty = toNum(mw.qty);
          const contractedAmount = toNum(mw.amount);
          const balanceQty = Math.max(0, contractedQty - grossApplied);
          const balanceValue = Math.max(0, contractedAmount - (grossApplied * rate));

          // Client assessment side (from the Excel if present, else 0)
          const assessedInPeriodAmount = toNum(mw.assessed_in_period);
          const previousAssessedAmount = toNum(mw.previous_assessed);
          const grossAssessedAmount = previousAssessedAmount + assessedInPeriodAmount;

          lineItems.push({
            afp_id: afpId,
            job_id,
            sheet_name: 'measured_works',
            category: 'other',
            item_ref: mw.item_ref || '',
            item: mw.item || mw.item_ref || '',
            unit: mw.unit || '',
            qty: contractedQty,
            rate,
            amount: contractedAmount,
            unit_price: rate,
            qty_complete: grossApplied,
            gross_applied: grossApplied * rate,
            previous_applied: previousApplied * rate,
            applied_in_period: periodAmount,
            assessed_qty: toNum(mw.assessed_qty) || (rate > 0 ? grossAssessedAmount / rate : 0),
            gross_assessed: grossAssessedAmount,
            previous_assessed: previousAssessedAmount,
            assessed_in_period: assessedInPeriodAmount,
            balance_qty: balanceQty,
            balance_value: balanceValue,
            source: 'afp_upload',
            source_date: periodStart,
            is_manual: false,
            dispute_status: 'none',
            original_amount: periodAmount,
            agreed_amount: assessedInPeriodAmount > 0 ? assessedInPeriodAmount : periodAmount,
            sort_order: sortOrder++,
          });
        }

        // ── Variation lines assigned to this period by VO date ──
        for (const v of variations) {
          if (!v.vo_date || v.vo_date.slice(0, 7) !== periodMonth) continue;
          const totalCost = toNum(v.total_cost);
          lineItems.push({
            afp_id: afpId,
            job_id,
            sheet_name: 'variations',
            category: 'other',
            item_ref: v.vo_ref || '',
            item: v.description || v.vo_ref || '',
            unit: v.unit || '',
            qty: toNum(v.qty),
            rate: toNum(v.rate),
            amount: totalCost,
            unit_price: toNum(v.rate),
            vo_ref: v.vo_ref || '',
            vo_date: v.vo_date || '',
            time_impact: !!v.time_impact,
            time_impact_days: toNum(v.time_impact_days),
            budget_cost_issue_date: v.budget_cost_issue_date || '',
            firm_cost_issue_date: v.firm_cost_issue_date || '',
            client_assessment_issue_date: v.client_assessment_issue_date || '',
            cost_agreed_date: v.cost_agreed_date || '',
            applied_in_period: toNum(v.applied_in_period) || totalCost,
            assessed_in_period: toNum(v.assessed_in_period),
            source: 'afp_upload',
            source_date: v.vo_date || periodStart,
            is_manual: false,
            dispute_status: v.cost_agreed_date ? 'agreed' : 'none',
            original_amount: totalCost,
            agreed_amount: toNum(v.assessed_in_period) || totalCost,
            sort_order: sortOrder++,
          });
          variationCount++;
        }

        // ── Variation breakdown lines (component items per VO ref) ──
        // For each variation assigned to this period, find its breakdown sheet
        // and persist each component line as is_variation_breakdown=true so it
        // renders in the per-ref tab but not the Variation Summary list.
        for (const v of variations) {
          if (!v.vo_date || v.vo_date.slice(0, 7) !== periodMonth) continue;
          const ref = (v.vo_ref || '').toUpperCase().replace(/\s+/g, '');
          if (!ref) continue;
          const breakdown = variationBreakdowns.find((b: any) => b.ref === ref);
          if (!breakdown) continue;
          for (const bl of breakdown.lines) {
            lineItems.push({
              afp_id: afpId,
              job_id,
              sheet_name: 'variations',
              category: bl.category || 'other',
              item: bl.description,
              unit: bl.unit || 'nr',
              qty: toNum(bl.qty),
              rate: toNum(bl.rate),
              amount: toNum(bl.amount),
              unit_price: toNum(bl.rate),
              vo_ref: v.vo_ref || '',
              vo_date: v.vo_date || '',
              is_variation_breakdown: true,
              applied_in_period: toNum(bl.amount),
              source: 'afp_upload',
              source_date: v.vo_date || periodStart,
              is_manual: false,
              dispute_status: 'none',
              original_amount: toNum(bl.amount),
              agreed_amount: toNum(bl.amount),
              sort_order: sortOrder++,
            });
          }
        }

        // ── Compensation item lines assigned to this period ──
        for (const ci of compensationItems) {
          if (!ci.daily) continue;
          let periodQty = 0;
          for (const [d, q] of Object.entries(ci.daily)) {
            if (d.slice(0, 7) === periodMonth) periodQty += toNum(q);
          }
          if (periodQty === 0) continue;
          const amount = periodQty * toNum(ci.rate);
          lineItems.push({
            afp_id: afpId,
            job_id,
            sheet_name: 'compensation_item',
            category: 'other',
            item_ref: ci.sheet || '',
            item: ci.description || ci.activity || '',
            unit: ci.unit || '',
            qty: periodQty,
            rate: toNum(ci.rate),
            amount,
            unit_price: toNum(ci.rate),
            applied_in_period: amount,
            source: 'afp_upload',
            source_date: periodStart,
            is_manual: false,
            dispute_status: 'none',
            original_amount: amount,
            agreed_amount: amount,
            sort_order: sortOrder++,
          });
        }

        // ── Materials (assign to the first AFP only) ──
        if (i === 0) {
          for (const m of materials) {
            const cost = toNum(m.cost);
            const qty = toNum(m.qty);
            const amount = qty * cost;
            if (amount === 0 && !m.description) continue;
            lineItems.push({
              afp_id: afpId,
              job_id,
              sheet_name: 'materials',
              category: 'materials',
              item: m.description || m.item || '',
              unit: m.unit || '',
              qty,
              rate: cost,
              amount,
              unit_price: cost,
              assessed_in_period: toNum(m.assessed) * cost,
              source: 'afp_upload',
              source_date: periodStart,
              is_manual: false,
              dispute_status: 'none',
              original_amount: amount,
              agreed_amount: toNum(m.assessed) > 0 ? toNum(m.assessed) * cost : amount,
              sort_order: sortOrder++,
            });
          }
        }

        // Bulk create line items, verifying they actually persisted
        // (bulkCreate can silently fail for certain batch compositions)
        if (lineItems.length > 0) {
          await base44.entities.AFPLineItem.bulkCreate(lineItems);
          const verifyItems = await base44.entities.AFPLineItem.filter({ afp_id: afpId }, undefined, 1);
          if (verifyItems.length === 0) {
            for (const li of lineItems) {
              await base44.entities.AFPLineItem.create(li);
            }
          }
          totalLineItems += lineItems.length;
        }

        // Calculate AFP totals
        const periodClaimed = lineItems
          .filter(li => li.sheet_name !== 'materials')
          .reduce((s, li) => s + toNum(li.applied_in_period), 0);
        totalClaimed += periodClaimed;
        await base44.entities.AFP.update(afpId, {
          total_claimed: Math.round(periodClaimed * 100) / 100,
          original_total: Math.round(periodClaimed * 100) / 100,
          agreed_total: Math.round(periodClaimed * 100) / 100,
        });
      }

      // Chain the AFPs via next_afp_id
      for (let i = 0; i < createdAfpIds.length - 1; i++) {
        await base44.entities.AFP.update(createdAfpIds[i], { next_afp_id: createdAfpIds[i + 1] });
      }

      // Mirror variations as VariationOrder records (to the first AFP's CVR)
      if (variations.length > 0) {
        let cvrs = await base44.entities.CVR.filter({ job_id });
        let cvrId = cvrs[0]?.id;
        if (!cvrId) {
          const newCVR = await base44.entities.CVR.create({
            job_id,
            job_name: job.name,
            job_reference: job.job_reference || '',
            division_id: job.division_id || '',
            client_name: cd.client || '',
            last_updated_at: now,
            last_updated_by: userName,
          });
          cvrId = newCVR.id;
        }
        await base44.entities.VariationOrder.deleteMany({ cvr_id: cvrId });
        const voRecords = variations.map((v, i) => ({
          cvr_id: cvrId,
          job_id,
          vo_number: i + 1,
          description: v.description || v.vo_ref || '',
          agreed_value: toNum(v.total_cost),
          sort_order: i,
        }));
        if (voRecords.length > 0) {
          await base44.entities.VariationOrder.bulkCreate(voRecords);
        }
      }

      await logFinancialAudit(base44, {
        entity_name: 'AFP',
        entity_id: createdAfpIds[0],
        action: 'create',
        record_summary: `Multi-AFP import for ${job.name}: ${createdAfpIds.length} AFPs created, ${totalLineItems} line items, £${Math.round(totalClaimed).toLocaleString()} total claimed, ${variationCount} variations`,
        actor_user_id: user.id,
        actor_name: userName,
      });

      // Seed BOQ from Measured Works if the job has no existing BOQ lines
      const boqResult = await seedBOQFromMeasuredWorks(base44, job, measuredWorks);

      return Response.json({
        afps_created: createdAfpIds.length,
        afp_ids: createdAfpIds,
        total_line_items: totalLineItems,
        total_claimed: Math.round(totalClaimed * 100) / 100,
        variation_count: variationCount,
        boq_seeded: boqResult.seeded,
        boq_skipped: boqResult.skipped,
      });
    }

    // ── Legacy single-AFP mode (no afp_split) ──
    const periodDate = toDateStr(cd.date) || new Date().toISOString().slice(0, 10);

    const allItems: any[] = [];
    let sortOrder = 0;
    for (const mw of measuredWorks) {
      const qty = toNum(mw.qty), rate = toNum(mw.rate);
      allItems.push({
        sheet_name: 'measured_works', item_ref: mw.item_ref || '', item: mw.item || '',
        unit: mw.unit || '', qty, rate, amount: toNum(mw.amount) || qty * rate,
        unit_price: rate, qty_complete: toNum(mw.qty_complete), gross_applied: toNum(mw.gross_applied),
        previous_applied: toNum(mw.previous_applied), applied_in_period: toNum(mw.applied_in_period),
        assessed_qty: toNum(mw.assessed_qty), gross_assessed: toNum(mw.gross_assessed),
        previous_assessed: toNum(mw.previous_assessed), assessed_in_period: toNum(mw.assessed_in_period),
        balance_qty: toNum(mw.balance_qty), source: 'afp_upload', is_manual: false,
        dispute_status: 'none', sort_order: sortOrder++,
      });
    }
    for (const v of variations) {
      allItems.push({
        sheet_name: 'variations', item_ref: v.vo_ref || '', item: v.description || v.vo_ref || '',
        unit: v.unit || '', qty: toNum(v.qty), rate: toNum(v.rate), amount: toNum(v.total_cost),
        unit_price: toNum(v.rate), vo_ref: v.vo_ref || '', vo_date: v.vo_date || '',
        time_impact: !!v.time_impact, time_impact_days: toNum(v.time_impact_days),
        budget_cost_issue_date: v.budget_cost_issue_date || '', firm_cost_issue_date: v.firm_cost_issue_date || '',
        client_assessment_issue_date: v.client_assessment_issue_date || '', cost_agreed_date: v.cost_agreed_date || '',
        source: 'afp_upload', is_manual: false, dispute_status: v.cost_agreed_date ? 'agreed' : 'none',
        sort_order: sortOrder++,
      });
      // Persist breakdown component lines for this variation
      const ref = (v.vo_ref || '').toUpperCase().replace(/\s+/g, '');
      if (ref) {
        const breakdown = variationBreakdowns.find((b: any) => b.ref === ref);
        if (breakdown) {
          for (const bl of breakdown.lines) {
            allItems.push({
              sheet_name: 'variations', category: bl.category || 'other',
              item: bl.description, unit: bl.unit || 'nr',
              qty: toNum(bl.qty), rate: toNum(bl.rate), amount: toNum(bl.amount),
              unit_price: toNum(bl.rate), vo_ref: v.vo_ref || '', vo_date: v.vo_date || '',
              is_variation_breakdown: true, applied_in_period: toNum(bl.amount),
              source: 'afp_upload', is_manual: false, dispute_status: 'none',
              original_amount: toNum(bl.amount), agreed_amount: toNum(bl.amount),
              sort_order: sortOrder++,
            });
          }
        }
      }
    }
    for (const m of materials) {
      const qty = toNum(m.qty), cost = toNum(m.cost);
      allItems.push({
        sheet_name: 'materials', item: m.description || m.item || '', unit: m.unit || '',
        qty, rate: cost, amount: qty * cost, unit_price: cost,
        assessed_in_period: toNum(m.assessed) * cost, source: 'afp_upload', is_manual: false,
        dispute_status: 'none', sort_order: sortOrder++,
      });
    }

    const totalClaimed = allItems.reduce((s, li) => s + toNum(li.applied_in_period || li.amount), 0);

    const existingAFPs = await base44.entities.AFP.filter({ job_id });
    const existingAFP = existingAFPs.find(a => a.period_date === periodDate);

    const afpData: any = {
      job_id, job_name: job.name, job_reference: job.job_reference || '',
      division_id: job.division_id || '', period_date: periodDate,
      period_start_date: periodDate, period_end_date: periodDate,
      certification_due_date: defaultCertificationDue(periodDate),
      final_payment_notice_date: defaultFinalPaymentNotice(periodDate),
      client_po: cd.client_purchase_order || '', gc_job_number: cd.gc_job_number || job.job_reference || '',
      client_name: cd.client || '', contract_value: toNum(cd.contract_award_value),
      total_claimed: totalClaimed, status: existingAFP?.status || 'draft',
      source_file_url: source_file_url || '', source_file_name: source_file_name || '',
      last_updated_at: now, last_updated_by: userName,
    };

    let afpId;
    if (existingAFP) {
      await base44.entities.AFPLineItem.deleteMany({ afp_id: existingAFP.id });
      await base44.entities.AFP.update(existingAFP.id, afpData);
      afpId = existingAFP.id;
    } else {
      const created = await base44.entities.AFP.create(afpData);
      afpId = created.id;
    }

    if (allItems.length > 0) {
      await base44.entities.AFPLineItem.bulkCreate(
        allItems.map(li => ({ ...li, afp_id: afpId, job_id }))
      );
    }

    await logFinancialAudit(base44, {
      entity_name: 'AFP', entity_id: afpId, action: existingAFP ? 'update' : 'create',
      record_summary: `AFP for ${job.name} (${periodDate}): £${Math.round(totalClaimed).toLocaleString()} claimed, ${allItems.length} line items`,
      actor_user_id: user.id, actor_name: userName,
    });

    // Seed BOQ from Measured Works if the job has no existing BOQ lines
    const boqResult = await seedBOQFromMeasuredWorks(base44, job, measuredWorks);

    return Response.json({
      afps_created: 1,
      afp_id: afpId,
      line_item_count: allItems.length,
      total_claimed: Math.round(totalClaimed * 100) / 100,
      variation_count: variations.length,
      boq_seeded: boqResult.seeded,
      boq_skipped: boqResult.skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}