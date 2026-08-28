import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getRigProfitability — per-rig earned vs cost for a date range
// ============================================================
// Aggregates AFPLineItem revenue attributed to each rig (via the
// job's primary rig assignment) across ALL billing categories (not
// just drilling), and joins internal cost data from the linked rate
// card (cost_price × days on site) to produce a per-rig P&L.
//
// Every job that has a rig assigned appears in that rig's job
// breakdown — even when it has £0 earned in the period — so no
// rigged jobs go missing. Filterable by date range and division.
//
// Returns: [{ rig_id, rig_name, earned, cost, margin, margin_pct,
//             operating_hours, jobs_count, has_cost_data, job_breakdown }]

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, division_id } = body;

    // 1. Fetch all rigs — is_rig is the single source of truth for rig identity
    const rigsFilter: any = { is_rig: true };
    if (division_id) rigsFilter.division_id = division_id;
    const rigs = await base44.asServiceRole.entities.SiteAsset.filter(rigsFilter);

    // 2. Fetch all rig→job assignments. Build jobToRig (primary rig per job)
    //    and rigToJobIds (every job each rig is assigned to). Returned rigs are
    //    excluded — the rig is no longer on that job.
    const assignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ asset_type: 'rig' });
    const jobToRig: Record<string, string> = {};
    const rigToJobIds: Record<string, Set<string>> = {};
    for (const a of assignments) {
      if (a.status === 'returned') continue;
      if (a.role === 'primary_rig' || !jobToRig[a.job_id]) {
        jobToRig[a.job_id] = a.asset_id;
      }
      if (!rigToJobIds[a.asset_id]) rigToJobIds[a.asset_id] = new Set();
      rigToJobIds[a.asset_id].add(a.job_id);
    }

    // 3. Fetch AFPLineItems in the date range — ALL categories, not just
    //    drilling. Revenue is attributed to the job's primary rig so the
    //    full value of a rigged job (mobilisation, plant, labour, materials)
    //    is captured, not only the meterage.
    const lineItems = await base44.asServiceRole.entities.AFPLineItem.list('-source_date', 2000);
    const filteredItems = lineItems.filter(li => {
      if (date_from && li.source_date && li.source_date < date_from) return false;
      if (date_to && li.source_date && li.source_date > date_to) return false;
      return true;
    });

    // 4. Fetch JobCostItems for rigs to compute internal cost from the linked
    //    rate card cost_price (per day × quantity). This replaces the
    //    deprecated SiteAsset.cost_price figure.
    const rigIdSet = new Set(rigs.map(r => r.id));
    const costItems = await base44.asServiceRole.entities.JobCostItem.list('-created_date', 2000);
    const rigCostItems = costItems.filter(c => c.site_asset_id && rigIdSet.has(c.site_asset_id));
    const rigCostItemsInRange = rigCostItems.filter(c => {
      // Items with no start_date are treated as active/current so cost is never
      // silently dropped just because the arrival date wasn't stamped.
      if (!c.start_date) return true;
      if (date_from && c.start_date < date_from) return false;
      if (date_to && c.start_date > date_to) return false;
      return true;
    });

    // 5. Fetch RateCardItems for cost_price lookup
    const rateCardItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
    const rateCardById: Record<string, any> = {};
    for (const r of rateCardItems) rateCardById[r.id] = r;

    // 6. Aggregate earned per rig (with per-job breakdown)
    const rigEarned: Record<string, number> = {};
    const rigJobEarned: Record<string, Record<string, number>> = {};
    for (const li of filteredItems) {
      const rigId = jobToRig[li.job_id];
      if (!rigId) continue;
      const amt = li.dispute_status === 'rejected' ? 0 : (li.agreed_amount != null ? Number(li.agreed_amount) : (Number(li.amount) || 0));
      rigEarned[rigId] = (rigEarned[rigId] || 0) + amt;
      if (!rigJobEarned[rigId]) rigJobEarned[rigId] = {};
      rigJobEarned[rigId][li.job_id] = (rigJobEarned[rigId][li.job_id] || 0) + amt;
    }

    // 7. Aggregate cost per rig from JobCostItems (rate card cost_price × qty)
    const rigCost: Record<string, number> = {};
    const rigJobCost: Record<string, Record<string, number>> = {};
    for (const c of rigCostItemsInRange) {
      const rc = c.rate_card_item_id ? rateCardById[c.rate_card_item_id] : null;
      const unitCost = rc && rc.cost_price != null ? Number(rc.cost_price) || 0 : 0;
      const qty = Number(c.quantity) || 1;
      const cost = unitCost * qty;
      if (cost <= 0) continue;
      rigCost[c.site_asset_id] = (rigCost[c.site_asset_id] || 0) + cost;
      if (!rigJobCost[c.site_asset_id]) rigJobCost[c.site_asset_id] = {};
      rigJobCost[c.site_asset_id][c.job_id] = (rigJobCost[c.site_asset_id][c.job_id] || 0) + cost;
    }

    // 8. Fetch job names for ALL jobs assigned to rigs (not just those with
    //    AFP items) so every rigged job appears in the breakdown.
    const allJobIds = new Set<string>();
    for (const ids of Object.values(rigToJobIds)) for (const jid of ids) allJobIds.add(jid);
    for (const jid of Object.keys(jobToRig)) allJobIds.add(jid);
    const jobNames: Record<string, { name: string; reference: string }> = {};
    for (const jid of allJobIds) {
      try {
        const j = await base44.asServiceRole.entities.Job.get(jid);
        jobNames[jid] = { name: j.name || '—', reference: j.job_reference || '' };
      } catch (_) { jobNames[jid] = { name: '—', reference: '' }; }
    }

    // 9. Build results — include EVERY job assigned to each rig (even £0 earned)
    const results = rigs.map(rig => {
      const earned = round2(rigEarned[rig.id] || 0);
      const cost = round2(rigCost[rig.id] || 0);
      const margin = round2(earned - cost);
      const marginPct = earned > 0 ? round2((margin / earned) * 100) : 0;
      const operatingHours = Number(rig.operating_hours) || 0;
      const assignedJobIds = rigToJobIds[rig.id] || new Set<string>();
      const jobEarnedMap = rigJobEarned[rig.id] || {};
      const jobCostMap = rigJobCost[rig.id] || {};
      const job_breakdown = Array.from(assignedJobIds).map(jid => ({
        job_id: jid,
        job_name: jobNames[jid]?.name || '—',
        job_reference: jobNames[jid]?.reference || '',
        earned: round2(jobEarnedMap[jid] || 0),
        cost: round2(jobCostMap[jid] || 0),
      })).sort((a, b) => b.earned - a.earned);
      return {
        rig_id: rig.id,
        rig_name: rig.name,
        rig_type: rig.rig_type || 'n/a',
        division_id: rig.division_id,
        earned,
        cost,
        margin,
        margin_pct: marginPct,
        operating_hours: operatingHours,
        jobs_count: assignedJobIds.size,
        has_cost_data: cost > 0,
        compliance_status: rig.compliance_status || 'unknown',
        maintenance_status: rig.maintenance_status || 'unknown',
        job_breakdown,
      };
    });

    // Sort by earned descending
    results.sort((a, b) => b.earned - a.earned);

    // Totals
    const totals = {
      total_earned: round2(results.reduce((s, r) => s + r.earned, 0)),
      total_cost: round2(results.reduce((s, r) => s + r.cost, 0)),
      total_margin: round2(results.reduce((s, r) => s + r.margin, 0)),
      rigs_count: results.length,
    };

    return Response.json({ ok: true, rigs: results, totals });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}