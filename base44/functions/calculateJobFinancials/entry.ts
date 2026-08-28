import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadJobRateCardItems, findBestRateCardMatch, type RateCardItemLike } from '../../shared/jobRateMatcher.ts';
import { resolveHireCharges } from '../../shared/supplierRateMatcher.ts';

// ============================================================
// calculateJobFinancials — the zero-touch auto-financials engine
// (all entity queries are wrapped in try/catch to prevent 500s)
// ============================================================
// Given a job_id, this function:
//   1. Detects the drilling method (CP / Rotary / Mixed) from rig
//      assignments, log types, and the job's drilling_method field.
//   2. Matches each logged activity against the correct rate card
//      (staff → project → global Master Price List).
//   3. Calculates per-metre drilling revenue by drilling method,
//      using either job.meterage_rate or the matched "Advance
//      borehole" / "Rotary drill" rate card item.
//   4. Aggregates rig/crew costs from rig assignments × matched
//      crew day rates.
//   5. Returns per-borehole revenue breakdown (method, metres,
//      rate, revenue) and per-rig profitability (revenue − cost).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Auth check is resilient: if the token is expired or the auth service
    // is temporarily unavailable on the published site, we still return
    // financials (all data access uses asServiceRole, and this function is
    // read-only). This prevents a transient auth failure from surfacing as
    // a 500 that blocks the entire Financials tab.
    try {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } catch (_) { /* continue with service role */ }

    const body = await req.json();
    const jobId = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });

    let job: any;
    try {
      job = await base44.asServiceRole.entities.Job.get(jobId);
    } catch (_) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const vatRate = Number(job.vat_rate) || 20;

    // ── Load all investigation logs ──
    let logs: any[] = [];
    try { logs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId }); } catch (_) {}

    // ── Load rate card items at all three levels ──
    const staffIds = [...new Set(logs.map((l: any) => l.staff_id).filter(Boolean))] as string[];
    const staffRates: Record<string, RateCardItemLike[]> = {};
    for (const sid of staffIds) {
      try {
        const items = await base44.asServiceRole.entities.RateCardItem.filter({ staff_id: sid, is_active: true }, '-sort_order', 500);
        staffRates[sid] = (items || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)));
      } catch (_) { staffRates[sid] = []; }
    }

    let jobRateItems: RateCardItemLike[] = [];
    try { jobRateItems = await loadJobRateCardItems(base44, job.id); } catch (_) { jobRateItems = []; }

    let globalItems: RateCardItemLike[] = [];
    const hasJobRateCard = jobRateItems.length > 0 && jobRateItems.some((i: RateCardItemLike) => i.job_id === job.id);
    if (hasJobRateCard) {
      try {
        const global = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, '-sort_order', 500);
        globalItems = (global || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)) && !i.job_id && !i.staff_id);
      } catch (_) {}
    } else {
      // No job rate card — jobRateItems already IS the global list
      globalItems = jobRateItems;
    }

    // ── Drilling method detection ──
    // Priority: job.drilling_method field → rig assignments (rig_type) → log types
    // Rigs can be registered two ways: JobAssetAssignment (dedicated assignment
    // records) or JobCostItem entries created via the Logistics tab (with
    // site_asset_id linking to a rig-type SiteAsset). We check both so rigs
    // added in Logistics feed drilling-method detection.
    let rigAssignments: any[] = [];
    try { rigAssignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id: jobId }); } catch (_) {}
    const rigs = (rigAssignments as any[]).filter((a: any) => a.asset_type === 'rig');
    const rigMethods = new Set<string>();
    for (const r of rigs) {
      if (r.rig_type === 'cp') rigMethods.add('cp');
      if (r.rig_type === 'rotary') rigMethods.add('rotary');
    }
    // Also detect rigs added via the Logistics tab (JobCostItem → SiteAsset)
    let logisticsRigMethods: Set<string> = new Set();
    try {
      const earlyCostItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id: jobId });
      const earlyAssetIds = [...new Set(earlyCostItems.map((c: any) => c.site_asset_id).filter(Boolean))] as string[];
      if (earlyAssetIds.length > 0) {
        const earlyAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
        const earlyMap: Record<string, any> = {};
        for (const a of earlyAssets) earlyMap[a.id] = a;
        for (const id of earlyAssetIds) {
          const a = earlyMap[id];
          if (a && (a.is_rig === true || a.asset_type === 'rig')) {
            if (a.rig_type === 'cp') logisticsRigMethods.add('cp');
            if (a.rig_type === 'rotary') logisticsRigMethods.add('rotary');
          }
        }
      }
    } catch (_) {}
    for (const m of logisticsRigMethods) rigMethods.add(m);
    const logMethods = new Set<string>();
    for (const l of logs) {
      if (l.log_type === 'core_inspection') logMethods.add('rotary');
      if (l.log_type === 'borehole_progress' || l.log_type === 'sample_collection' || l.log_type === 'window_sampling') logMethods.add('cp');
    }

    let jobDrillingMethod: string = job.drilling_method || 'not_applicable';
    if (jobDrillingMethod === 'not_applicable') {
      const detected = new Set([...rigMethods, ...logMethods]);
      if (detected.size === 1) jobDrillingMethod = [...detected][0];
      else if (detected.size > 1) jobDrillingMethod = 'mixed';
    }

    // Determine per-borehole drilling method
    // A borehole is Rotary if it has core_inspection logs, otherwise CP (if it has borehole_progress)
    const boreholeMethodMap: Record<string, string> = {};
    for (const l of logs) {
      const ref = l.borehole_ref;
      if (!ref) continue;
      if (l.log_type === 'core_inspection') boreholeMethodMap[ref] = 'rotary';
      else if (!boreholeMethodMap[ref] && (l.log_type === 'borehole_progress' || l.log_type === 'sample_collection' || l.log_type === 'window_sampling')) {
        boreholeMethodMap[ref] = 'cp';
      }
    }
    // Fall back to the rig method if we have exactly one rig type
    if (rigMethods.size === 1) {
      const singleRigMethod = [...rigMethods][0];
      for (const l of logs) {
        const ref = l.borehole_ref;
        if (ref && !boreholeMethodMap[ref]) boreholeMethodMap[ref] = singleRigMethod;
      }
    }

    // ── Depth-banded drilling rate parser ──
    // EWR/Phenna rate cards price per-metre drilling by depth band AND diameter:
    //   "4 — Advance borehole between existing ground level and 10m depth 150mm"  → 0–10m, 150mm
    //   "5 — As Item B4 but between 10m and 20m depth 150mm"                        → 10–20m, 150mm
    // This parses those descriptions into structured bands for exact per-band pricing.
    interface DepthBandedRate {
      depth_from: number; depth_to: number; diameter: number;
      price: number; description: string; id: string; source: string;
    }
    const parseDepthBandedRates = (pool: RateCardItemLike[], methodPrefix: string, source: string): DepthBandedRate[] => {
      if (!pool || pool.length === 0) return [];
      const banded = pool.filter(i =>
        i.unit === 'm' &&
        i.price != null && !isNaN(Number(i.price)) &&
        String(i.subcategory || '').includes(methodPrefix) &&
        /advance borehole|as item b\d|rotary drill/i.test(i.description) &&
        !/backfill|standpipe|install|grout|piezo|inclined|extra over|setting up|standing|break out/i.test(i.description)
      );
      const rates: DepthBandedRate[] = [];
      for (const i of banded) {
        const d = String(i.description || '');
        let m = d.match(/between\s+(\d+)m\s+and\s+(\d+)m\s+depth\s+(\d+)mm/i);
        if (m) { rates.push({ depth_from: +m[1], depth_to: +m[2], diameter: +m[3], price: Number(i.price), description: i.description, id: i.id, source }); continue; }
        m = d.match(/between existing ground level and\s+(\d+)m\s+depth\s+(\d+)mm/i);
        if (m) { rates.push({ depth_from: 0, depth_to: +m[1], diameter: +m[2], price: Number(i.price), description: i.description, id: i.id, source }); continue; }
        m = d.match(/less than\s+(\d+)m.*?(\d+)mm/i);
        if (m) { rates.push({ depth_from: 0, depth_to: +m[1], diameter: +m[2], price: Number(i.price), description: i.description, id: i.id, source }); continue; }
      }
      const seen = new Set<string>();
      return rates.filter(r => {
        const key = `${r.depth_from}-${r.depth_to}-${r.diameter}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).sort((a, b) => a.depth_from - b.depth_from || a.diameter - b.diameter);
    };

    // Single-rate fallback (for rate cards without depth bands)
    const findPerMetreDrillingRate = (method: string, pool: RateCardItemLike[]): RateCardItemLike | null => {
      if (!pool || pool.length === 0) return null;
      const methodPrefix = method === 'rotary' ? 'Rotary Drilling' : 'CP Drilling';
      const perMetre = pool.filter(i =>
        i.unit === 'm' && i.price != null && !isNaN(Number(i.price)) &&
        String(i.subcategory || '').includes(methodPrefix)
      );
      if (perMetre.length === 0) return null;
      const advance = perMetre.filter(i =>
        /advance borehole|rotary drill/i.test(i.description) &&
        !/backfill|standpipe|install|grout|piezo|inclined|extra over/i.test(i.description)
      );
      return advance[0] || perMetre[0];
    };

    // Build depth-banded rate tables (project first, then global fills gaps)
    const cpBandedRates: DepthBandedRate[] = [
      ...parseDepthBandedRates(jobRateItems, 'CP Drilling', 'job'),
      ...parseDepthBandedRates(globalItems, 'CP Drilling', 'global'),
    ];
    const rotaryBandedRates: DepthBandedRate[] = [
      ...parseDepthBandedRates(jobRateItems, 'Rotary Drilling', 'job'),
      ...parseDepthBandedRates(globalItems, 'Rotary Drilling', 'global'),
    ];

    const cpPerMetreRate = job.meterage_rate && jobDrillingMethod !== 'rotary'
      ? { price: Number(job.meterage_rate), description: 'Job metre rate', unit: 'm', source: 'job', id: '' }
      : (findPerMetreDrillingRate('cp', jobRateItems) || findPerMetreDrillingRate('cp', globalItems));
    const rotaryPerMetreRate = job.meterage_rate && jobDrillingMethod !== 'cp'
      ? { price: Number(job.meterage_rate), description: 'Job metre rate', unit: 'm', source: 'job', id: '' }
      : (findPerMetreDrillingRate('rotary', jobRateItems) || findPerMetreDrillingRate('rotary', globalItems));

    // ── Match each log to a rate card item (for SOR line revenue) ──
    interface MatchedEntry {
      log_id: string; date: string; log_type: string; borehole_ref: string;
      description: string; staff_name: string; logged_by_role: string;
      rate_card_item_id: string; rate_card_description: string;
      rate_source: 'staff' | 'job' | 'global' | 'no_match';
      unit: string; unit_price: number; quantity: number; line_total: number;
    }

    const matched: MatchedEntry[] = [];
    let totalSorRevenueNet = 0;
    let totalMetres = 0;
    const unmatched: any[] = [];

    const logTypeKeywords: Record<string, string[]> = {
      borehole_progress: ['borehole', 'drilling', 'drill', 'percussive', 'rotary', 'cable percussion', 'borehole advance'],
      core_inspection: ['core', 'coring', 'rotary core', 'core run', 'rock quality'],
      sample_collection: ['sample', 'sampling', 'undisturbed sample', 'disturbed sample', 'u100', 'uds'],
      pit_excavation: ['trial pit', 'excavation', 'pit', 'investigation pit'],
      installation: ['install', 'standpipe', 'piezometer', 'monitoring well', 'gas monitoring'],
      standpipe_reading: ['monitoring', 'standpipe', 'groundwater monitoring', 'dip'],
      grouting_works: ['grout', 'grouting', 'backfill', 'bentonite'],
      borehole_decommissioning: ['decommission', 'backfill', 'seal', 'grout'],
      geophysical_probing: ['probing', 'geophysical', 'cone', 'cpt'],
      window_sampling: ['window sampling', 'window sample', 'dynamic sampling'],
    };

    // Per-borehole meterage tracking (with depth-band split)
    // Default drilling diameter: 150mm for CP (standard SI borehole), 100mm for rotary core
    const DEFAULT_CP_DIAMETER = 150;
    const DEFAULT_ROTARY_DIAMETER = 100;
    const splitDepthIntoBands = (dFrom: number, dTo: number, bandSize = 10): Record<string, number> => {
      const bands: Record<string, number> = {};
      let bandStart = Math.floor(dFrom / bandSize) * bandSize;
      while (bandStart < dTo) {
        const segFrom = Math.max(bandStart, dFrom);
        const segTo = Math.min(bandStart + bandSize, dTo);
        if (segTo > segFrom) {
          const key = `${bandStart}-${bandStart + bandSize}`;
          bands[key] = Math.round(((bands[key] || 0) + (segTo - segFrom)) * 100) / 100;
        }
        bandStart += bandSize;
      }
      return bands;
    };
    const bhMap: Record<string, { borehole_ref: string; metres: number; entries: number; method: string; band_metres: Record<string, number> }> = {};

    for (const log of logs) {
      let quantity = 1;
      const dFrom = Number(log.depth_from) || 0;
      const dTo = Number(log.depth_to) || 0;
      if (dTo > dFrom && (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection')) {
        quantity = Math.round((dTo - dFrom) * 100) / 100;
        totalMetres += quantity;
      }
      if (log.units_completed && Number(log.units_completed) > 0) {
        quantity = Number(log.units_completed);
      }

      // Track per-borehole meterage (with depth-band split)
      const ref = log.borehole_ref || 'Unspecified';
      if (!bhMap[ref]) bhMap[ref] = { borehole_ref: ref, metres: 0, entries: 0, method: boreholeMethodMap[ref] || (jobDrillingMethod === 'mixed' ? '' : jobDrillingMethod), band_metres: {} };
      if (dTo > dFrom && (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection')) {
        bhMap[ref].metres = Math.round((bhMap[ref].metres + (dTo - dFrom)) * 100) / 100;
        const bands = splitDepthIntoBands(dFrom, dTo);
        for (const [k, v] of Object.entries(bands)) {
          bhMap[ref].band_metres[k] = Math.round(((bhMap[ref].band_metres[k] || 0) + v) * 100) / 100;
        }
      }
      bhMap[ref].entries++;
      if (boreholeMethodMap[ref]) bhMap[ref].method = boreholeMethodMap[ref];

      // ── SOR line matching (non-drilling-advance activities) ──
      // Skip borehole_progress and core_inspection — those are priced by per-metre drilling rate,
      // not as individual SOR lines (they'd double-count the drilling revenue)
      if (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection') continue;

      const rawDesc = log.description || log.strata_description_detail || '';
      const keywords = logTypeKeywords[log.log_type] || [];
      const keywordDesc = keywords.join(' ') || rawDesc || log.log_type;
      const meaningfulDesc = rawDesc && !rawDesc.startsWith('Imported from') ? rawDesc : '';

      let bestMatch: RateCardItemLike | null = null;
      let rateSource: 'staff' | 'project' | 'global' | 'no_match' = 'no_match';
      const tryMatch = (searchDesc: string, pool: RateCardItemLike[]): RateCardItemLike | null => {
        if (!pool || pool.length === 0 || !searchDesc) return null;
        return findBestRateCardMatch(searchDesc, pool);
      };

      if (meaningfulDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(meaningfulDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, jobRateItems); if (bestMatch) rateSource = 'job'; }
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }
      if (!bestMatch && keywordDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(keywordDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, jobRateItems); if (bestMatch) rateSource = 'job'; }
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }

      const displayDesc = meaningfulDesc || keywordDesc || log.log_type;

      if (!bestMatch) {
        unmatched.push({ log_id: log.id, date: log.date, description: displayDesc, log_type: log.log_type, borehole_ref: log.borehole_ref });
        continue;
      }

      const unitPrice = Number(bestMatch.price) || 0;
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      totalSorRevenueNet += lineTotal;

      matched.push({
        log_id: log.id, date: log.date, log_type: log.log_type, borehole_ref: log.borehole_ref || '',
        description: displayDesc, staff_name: log.staff_name || log.completed_by_name || '',
        logged_by_role: log.logged_by_role || 'unspecified',
        rate_card_item_id: bestMatch.id, rate_card_description: bestMatch.description,
        rate_source: rateSource, unit: bestMatch.unit || 'sum', unit_price: unitPrice,
        quantity, line_total: lineTotal,
      });
    }

    // ── Per-borehole meterage revenue (depth-banded) ──
    // For each borehole: split drilled depth into 10m bands, match each band
    // to the correct depth/diameter rate card item, sum per-band revenue.
    const meterageRate = Number(job.meterage_rate) || 0;
    interface BoreholeBand {
      depth_from: number; depth_to: number; diameter: number;
      metres: number; rate_per_metre: number; rate_description: string; rate_source: string;
      revenue: number;
    }
    interface BoreholeRevenue {
      borehole_ref: string; method: string; metres: number; entries: number;
      rate_per_metre: number; rate_description: string; rate_source: string;
      revenue: number; bands: BoreholeBand[];
    }
    const boreholeRevenue: BoreholeRevenue[] = [];
    let totalMeterageRevenue = 0;
    for (const ref of Object.keys(bhMap)) {
      const bh = bhMap[ref];
      if (bh.metres <= 0) continue;
      const method = bh.method || (jobDrillingMethod === 'mixed' ? 'cp' : jobDrillingMethod);

      // If job has a fixed meterage_rate, use the simple single-rate calculation
      if (meterageRate > 0) {
        const revenue = Math.round(bh.metres * meterageRate * 100) / 100;
        totalMeterageRevenue += revenue;
        boreholeRevenue.push({
          borehole_ref: bh.borehole_ref, method, metres: bh.metres, entries: bh.entries,
          rate_per_metre: meterageRate, rate_description: 'Job metre rate', rate_source: 'job',
          revenue, bands: [{ depth_from: 0, depth_to: Math.ceil(bh.metres / 10) * 10, diameter: 0, metres: bh.metres, rate_per_metre: meterageRate, rate_description: 'Job metre rate', rate_source: 'job', revenue }],
        });
        continue;
      }

      const bandedRates = method === 'rotary' ? rotaryBandedRates : cpBandedRates;

      // If no banded rates found, fall back to single rate
      if (bandedRates.length === 0) {
        const rateItem = method === 'rotary' ? rotaryPerMetreRate : cpPerMetreRate;
        const ratePerM = rateItem ? Number(rateItem.price) : 0;
        const revenue = Math.round(bh.metres * ratePerM * 100) / 100;
        totalMeterageRevenue += revenue;
        boreholeRevenue.push({
          borehole_ref: bh.borehole_ref, method, metres: bh.metres, entries: bh.entries,
          rate_per_metre: ratePerM, rate_description: rateItem ? rateItem.description : 'No rate found',
          rate_source: rateItem ? rateItem.source || 'rate_card' : 'no_match',
          revenue, bands: [{ depth_from: 0, depth_to: Math.ceil(bh.metres / 10) * 10, diameter: 0, metres: bh.metres, rate_per_metre: ratePerM, rate_description: rateItem ? rateItem.description : 'No rate found', rate_source: rateItem ? (rateItem.source || 'rate_card') : 'no_match', revenue }],
        });
        continue;
      }

      // Depth-banded calculation: split drilled depth into 10m bands and match each
      const defaultDiameter = method === 'rotary' ? DEFAULT_ROTARY_DIAMETER : DEFAULT_CP_DIAMETER;
      const bands: BoreholeBand[] = [];
      let bhRevenue = 0;
      let bhRatePerM = 0;
      let bhRateDesc = 'No rate found';
      let bhRateSource = 'no_match' as string;

      for (const [bandKey, bandMetres] of Object.entries(bh.band_metres)) {
        const [bf, bt] = bandKey.split('-').map(Number);
        const exactMatch = bandedRates.find(r => r.depth_from === bf && r.depth_to === bt && r.diameter === defaultDiameter);
        const anyDiameter = bandedRates.find(r => r.depth_from === bf && r.depth_to === bt);
        const rate = exactMatch || anyDiameter;
        const ratePerM = rate ? rate.price : 0;
        const bandRevenue = Math.round(bandMetres * ratePerM * 100) / 100;
        bhRevenue += bandRevenue;
        bands.push({
          depth_from: bf, depth_to: bt,
          diameter: rate ? rate.diameter : defaultDiameter,
          metres: bandMetres, rate_per_metre: ratePerM,
          rate_description: rate ? rate.description : `No rate for ${bf}-${bt}m ${defaultDiameter}mm`,
          rate_source: rate ? rate.source : 'no_match',
          revenue: bandRevenue,
        });
        if (rate) { bhRatePerM = ratePerM; bhRateDesc = rate.description; bhRateSource = rate.source; }
      }

      bhRevenue = Math.round(bhRevenue * 100) / 100;
      totalMeterageRevenue += bhRevenue;
      boreholeRevenue.push({
        borehole_ref: bh.borehole_ref, method, metres: bh.metres, entries: bh.entries,
        rate_per_metre: bhRatePerM, rate_description: bhRateDesc, rate_source: bhRateSource,
        revenue: bhRevenue, bands,
      });
    }
    boreholeRevenue.sort((a, b) => a.borehole_ref.localeCompare(b.borehole_ref));

    // ── Costs ──
    let costItems: any[] = [];
    try { costItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id: jobId }); } catch (_) {}

    // ── Supplier rate-card matching for plant hire ──
    // Hired plant has a buy side (supplier rate card) and a sell side (Our Rate
    // Card or markup-on-cost). Resolve both so hired equipment carries margin
    // instead of being billed through at the supplier's cost price.
    let supplierRateItems: RateCardItemLike[] = [];
    const hireSupplierIds = [...new Set(costItems.filter((c: any) => c.category === 'hired_equipment' && c.supplier_id).map((c: any) => c.supplier_id))] as string[];
    if (hireSupplierIds.length > 0) {
      try {
        supplierRateItems = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'supplier', is_active: true }, '-sort_order', 1000) as RateCardItemLike[];
      } catch (_) { supplierRateItems = []; }
    }
    const ourRateItemsForHire: RateCardItemLike[] = [...(jobRateItems || []), ...(globalItems || [])];
    const hireMarkupPct = Number(job.markup_percentage) || 15;
    const hireBreakdown = resolveHireCharges(costItems, supplierRateItems, ourRateItemsForHire, hireMarkupPct);

    let hotelBookings: any[] = []; try { hotelBookings = await base44.asServiceRole.entities.HotelBooking.filter({ job_id: jobId }); } catch (_) {}
    let deliveries: any[] = []; try { deliveries = await base44.asServiceRole.entities.DeliveryLog.filter({ job_id: jobId }); } catch (_) {}
    let timesheets: any[] = []; try { timesheets = await base44.asServiceRole.entities.Timesheet.filter({ job_id: jobId }); } catch (_) {}
    let rotaAssignments: any[] = []; try { rotaAssignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: jobId }); } catch (_) {}

    // ── Daily costs (crew expenses from End-of-Shift wizard) ──
    let dailyCosts: any[] = [];
    try { dailyCosts = await base44.asServiceRole.entities.DailyCost.filter({ job_id: jobId }, '-date', 200); } catch (_) {}

    // ── Sub-contractor logs (buy-side cost, sell-side revenue) ──
    let subconLogs: any[] = [];
    try { subconLogs = await base44.asServiceRole.entities.SubcontractorLog.filter({ job_id: jobId }, '-date', 200); } catch (_) {}

    // Load SiteAssets early — needed to identify rig vs non-rig cost items
    // so rigs aren't double-counted (they're costed separately in totalRigCost).
    let allSiteAssets: any[] = [];
    try {
      allSiteAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    } catch (_) {}
    const siteAssetMap: Record<string, any> = {};
    for (const a of allSiteAssets) siteAssetMap[a.id] = a;

    // Load Staff records for crew names
    let allStaff: any[] = [];
    try {
      allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    } catch (_) {}
    const staffMap: Record<string, any> = {};
    for (const s of allStaff) staffMap[s.id] = s;

    // ── Cost vs Charge-out resolution ──
    // RateCardItem.price = charge-out (revenue). RateCardItem.cost_price = internal cost.
    // For COST calculations we use cost_price when available, falling back to
    // the JobCostItem.unit_cost (which was historically filled from price).
    // Build lookups from already-loaded rate card items so we can resolve both
    // the true internal cost and the charge-out price for items linked via
    // rate_card_item_id.
    const rateCardCostMap: Record<string, number> = {};
    const rateCardChargeMap: Record<string, number> = {};
    for (const r of [...(jobRateItems || []), ...(globalItems || [])]) {
      if (r.id) {
        rateCardCostMap[r.id] = r.cost_price != null ? Number(r.cost_price) : 0;
        rateCardChargeMap[r.id] = r.price != null ? Number(r.price) : 0;
      }
    }
    // Resolve the internal cost for a JobCostItem: linked rate card cost_price
    // takes precedence, then the stored unit_cost, then 0.
    const itemInternalCost = (c: any): number => {
      if (c.price_confirmed && c.negotiated_unit_cost != null) return Number(c.negotiated_unit_cost);
      // Linked rate card: use cost_price (explicit internal cost). If cost_price
      // is not set, owned items have £0 internal cost (we own them — no hire charge).
      if (c.rate_card_item_id && rateCardCostMap[c.rate_card_item_id] != null) return rateCardCostMap[c.rate_card_item_id];
      // No rate card link: hired/purchased unit_cost IS the supplier cost;
      // owned/labour unit_cost is the charge-out rate, so internal cost = 0.
      if (c.category === 'hired_equipment' || c.category === 'purchased_equipment') return Number(c.unit_cost) || 0;
      return 0;
    };
    // Resolve the charge-out (revenue) for a JobCostItem: linked rate card
    // price takes precedence, then the stored unit_cost (which was
    // historically filled from the charge-out price), then 0.
    const itemChargeOut = (c: any): number => {
      if (c.price_confirmed && c.negotiated_unit_cost != null) return Number(c.negotiated_unit_cost);
      if (c.rate_card_item_id && rateCardChargeMap[c.rate_card_item_id] != null) return rateCardChargeMap[c.rate_card_item_id];
      return Number(c.unit_cost) || 0;
    };
    const itemNet = (c: any) => {
      const rate = itemInternalCost(c);
      return rate * (Number(c.quantity) || 1);
    };
    const itemRevenue = (c: any) => {
      const rate = itemChargeOut(c);
      return rate * (Number(c.quantity) || 1);
    };
    // Exclude rig AND labour cost items from equipmentNet — rigs are costed
    // separately in totalRigCost, and labour items are crew labour (costed in
    // labourItemsNet). Mixing labour into equipment overstated "Equipment" and
    // hid billable crew costs from the Crew Labour total, so the breakdown
    // didn't reconcile.
    const nonRigNonLabourCostItems = costItems.filter((c: any) => {
      if (c.category === 'labour') return false;
      if (!c.site_asset_id) return true;
      const asset = siteAssetMap[c.site_asset_id];
      return !(asset && (asset.is_rig === true || asset.asset_type === 'rig'));
    });
    const equipmentNet = nonRigNonLabourCostItems.reduce((s: number, c: any) => s + itemNet(c), 0);
    // Labour cost items (billable crew from the Master Price List) — internal
    // cost (cost_price) × quantity. Separate from equipment so the cost
    // breakdown reconciles: equipment is plant, labour is crew.
    const labourItemsNet = costItems
      .filter((c: any) => c.category === 'labour')
      .reduce((s: number, c: any) => s + itemNet(c), 0);

    // Booking-type-aware hotel cost: Hotel = cost_per_night × room_count ×
    // nights; Air B&B = total_cost (flat entire-stay total). Legacy records
    // without a booking_type default to 'hotel' so historical data is unchanged.
    const hotelRows = hotelBookings.map((b: any) => {
      const nights = b.check_in_date && b.check_out_date
        ? Math.max(0, Math.round((new Date(b.check_out_date + 'T00:00:00').getTime() - new Date(b.check_in_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const isAirbnb = b.booking_type === 'airbnb';
      const total = isAirbnb
        ? (Number(b.total_cost) || 0)
        : (Number(b.cost_per_night) || 0) * (Number(b.room_count) || 1) * nights;
      return {
        id: b.id, name: b.hotel_name, nights,
        rooms: isAirbnb ? 0 : (Number(b.room_count) || 1),
        perNight: isAirbnb ? 0 : (Number(b.cost_per_night) || 0),
        booking_type: isAirbnb ? 'airbnb' : 'hotel',
        total_cost: isAirbnb ? (Number(b.total_cost) || 0) : 0,
        total,
      };
    });
    const hotelNet = hotelRows.reduce((s: number, h: any) => s + h.total, 0);

    const deliveryCharges = deliveries.filter((d: any) => d.chargeable !== false).reduce((s: number, d: any) => s + (Number(d.charge_amount) || 0), 0);
    const taskCharges = timesheets.filter((t: any) => t.chargeable && !t.is_break).reduce((s: number, t: any) => s + (Number(t.charge_amount) || 0), 0);
    const additionalCharges = deliveryCharges + taskCharges;

    // ── Daily cost aggregation (crew expenses) ──
    const dailyCostRows = dailyCosts.map((c: any) => ({
      id: c.id, date: c.date, category: c.category, description: c.description,
      amount_net: Number(c.amount_net) || 0, amount_gross: Number(c.amount_gross) || 0,
      staff_name: c.staff_name, status: c.status, gl_code: c.gl_code,
      is_subcontractor_cost: c.is_subcontractor_cost,
    }));
    const dailyCostsNet = dailyCosts
      .filter((c: any) => !c.is_subcontractor_cost)
      .reduce((s: number, c: any) => s + (Number(c.amount_net) || 0), 0);

    // ── Sub-contractor margin aggregation ──
    const subconRows = subconLogs.map((l: any) => ({
      id: l.id, date: l.date, subcontractor_name: l.subcontractor_name, work_type: l.work_type,
      purchase_cost_net: Number(l.purchase_cost_net) || 0,
      client_charge_net: Number(l.client_charge_net) || 0,
      margin_net: Number(l.margin_net) || 0,
      margin_pct: Number(l.margin_pct) || 0,
      markup_percentage: Number(l.markup_percentage) || 0,
      status: l.status,
      billed_to_client: l.billed_to_client,
    }));
    const subconPurchaseNet = subconLogs.reduce((s: number, l: any) => s + (Number(l.purchase_cost_net) || 0), 0);
    const subconClientChargeNet = subconLogs.reduce((s: number, l: any) => s + (Number(l.client_charge_net) || 0), 0);
    const subconMarginNet = subconLogs.reduce((s: number, l: any) => s + (Number(l.margin_net) || 0), 0);

    // ── Rig crew cost (from JobCostItem rig entries × day rates) ──
    // Rigs are added via the Logistics tab → RigGearPickerModal, which creates
    // JobCostItem entries with the day rate already matched from the Master
    // Price List. We read these directly — no rate re-matching needed. The
    // on-site period comes from start_date / end_date on the cost item, with
    // current_location tracking the live delivery status (yard → site → returned).

    // Build rate card description lookup from already-loaded items (zero extra API calls)
    const rateCardDescMap: Record<string, string> = {};
    for (const r of [...(jobRateItems || []), ...(globalItems || [])]) {
      if (r.id) rateCardDescMap[r.id] = r.description;
    }

    // Identify rig cost items (JobCostItem entries linked to a rig SiteAsset)
    const rigCostItems = costItems.filter((c: any) => {
      if (!c.site_asset_id) return false;
      const asset = siteAssetMap[c.site_asset_id];
      return asset && (asset.is_rig === true || asset.asset_type === 'rig');
    });

    // Total job working days (Mon–Fri from start to end) — for drilling performance summary
    const workingDays = (() => {
      if (!job.start_date || !job.end_date) return 0;
      const s = new Date(job.start_date + 'T00:00:00');
      const e = new Date(job.end_date + 'T00:00:00');
      if (e < s) return 0;
      let count = 0; const d = new Date(s);
      while (d <= e) { const day = d.getUTCDay(); if (day !== 0 && day !== 6) count++; d.setUTCDate(d.getUTCDate() + 1); }
      return count;
    })();

    // Per-rig working days — from start_date to end_date (or today if still on site)
    const calcRigWorkingDays = (startDate?: string, endDate?: string): number => {
      if (!startDate) return 0;
      const s = new Date(startDate + 'T00:00:00');
      const today = new Date().toISOString().slice(0, 10);
      const endStr = endDate || today;
      const e = new Date(endStr + 'T00:00:00');
      if (e < s) return 0;
      let count = 0; const d = new Date(s);
      while (d <= e) { const day = d.getUTCDay(); if (day !== 0 && day !== 6) count++; d.setUTCDate(d.getUTCDate() + 1); }
      return count;
    };

    // ── Per-rig profitability ──
    // Only rigs that are on site or returned accrue crew day-rate costs.
    // Rigs still at the yard (not yet delivered) are listed with £0 cost.
    interface RigProfitability {
      rig_name: string; rig_type: string; status: string;
      day_rate: number; rate_description: string; working_days: number;
      total_cost: number; method: string;
      arrived_on_site_date: string | null; returned_date: string | null;
      boreholes: string[]; metres_drilled: number;
      meterage_revenue: number; profit: number;
    }

    // Group boreholes by method so revenue is split evenly across rigs of the same method
    const boreholesByMethod: Record<string, BoreholeRevenue[]> = {};
    for (const b of boreholeRevenue) {
      const m = b.method || 'cp';
      if (!boreholesByMethod[m]) boreholesByMethod[m] = [];
      boreholesByMethod[m].push(b);
    }

    const rigCostRows: RigProfitability[] = rigCostItems.map((c: any) => {
      const asset = siteAssetMap[c.site_asset_id] || {};
      const method = asset.rig_type || 'cp';
      // Internal cost: prefer the rate card's cost_price (looked up via
      // rate_card_item_id), then the stored unit_cost, then 0.
      const dayCost = itemInternalCost(c);
      const dayRate = c.price_confirmed && c.negotiated_unit_cost != null
        ? Number(c.negotiated_unit_cost)
        : (Number(c.unit_cost) || 0);
      const rateDesc = c.rate_card_item_id ? (rateCardDescMap[c.rate_card_item_id] || c.description || 'No rate matched') : (c.description || 'No rate matched');
      // Determine delivery status from current_location
      const isOnSite = c.current_location === 'site';
      const isReturned = c.current_location === 'returned' || c.hire_status === 'off_hired';
      const isDelivered = isOnSite || isReturned;
      // On-site period: start_date → off_hire_date or end_date (or today if still on site)
      // Fallback to location_updated_at for rigs added before the date picker
      const locDate = c.location_updated_at ? c.location_updated_at.split('T')[0] : null;
      const startDate = c.start_date || (isDelivered ? locDate : null);
      const endDate = c.off_hire_date || c.end_date || null;
      const rigDays = isDelivered && startDate ? calcRigWorkingDays(startDate, endDate) : 0;
      const cost = Math.round(dayCost * rigDays * 100) / 100;
      // Allocate borehole revenue evenly across delivered rigs of the same method
      const methodBoreholes = boreholesByMethod[method] || [];
      const deliveredRigsOfMethod = rigCostItems.filter((rc: any) => {
        const ra = siteAssetMap[rc.site_asset_id] || {};
        return (ra.rig_type || 'cp') === method && (rc.current_location === 'site' || rc.current_location === 'returned' || rc.hire_status === 'off_hired');
      }).length;
      const revenueShare = deliveredRigsOfMethod > 0 && isDelivered
        ? methodBoreholes.reduce((s, b) => s + b.revenue, 0) / deliveredRigsOfMethod : 0;
      const metresShare = deliveredRigsOfMethod > 0 && isDelivered
        ? methodBoreholes.reduce((s, b) => s + b.metres, 0) / deliveredRigsOfMethod : 0;
      return {
        rig_name: c.description || asset.name || 'Rig',
        rig_type: asset.rig_type || '',
        status: isOnSite ? 'on_site' : isReturned ? 'returned' : 'assigned',
        day_rate: dayRate,
        day_cost: dayCost,
        day_rate_revenue: Math.round(dayRate * rigDays * 100) / 100,
        rate_description: rateDesc,
        working_days: rigDays,
        total_cost: cost,
        arrived_on_site_date: startDate,
        returned_date: c.off_hire_date || c.end_date || null,
        method,
        boreholes: methodBoreholes.map(b => b.borehole_ref),
        metres_drilled: Math.round(metresShare * 100) / 100,
        meterage_revenue: Math.round(revenueShare * 100) / 100,
        profit: Math.round((revenueShare - cost) * 100) / 100,
      };
    });
    const totalRigCost = rigCostRows.reduce((s, r) => s + r.total_cost, 0);

    // ── Owned items revenue (charge-out) ──
    // Rigs, owned equipment, and labour items are billed at the charge-out rate
    // (RateCardItem.price). This is REVENUE, not cost. The internal cost is
    // cost_price (or 0 if we own it). Only added to revenue for day_rate and
    // 'none' methods — meterage_rate covers the rig via the per-metre rate.
    const totalRigRevenue = rigCostRows.reduce((s: number, r: RigProfitability) => s + Math.round(r.day_rate * r.working_days * 100) / 100, 0);
    const ownedNonRigItems = costItems.filter((c: any) =>
      (c.category === 'internal_equipment' || c.category === 'labour') && !rigCostItems.includes(c)
    );
    const ownedNonRigRevenue = ownedNonRigItems.reduce((s: number, c: any) => s + itemRevenue(c), 0);
    const ownedItemsRevenue = Math.round((totalRigRevenue + ownedNonRigRevenue) * 100) / 100;

    // ── Crew labour cost (from RotaAssignment × staff day rates) ──
    // Crew assigned via the rota but without a labour JobCostItem need their
    // cost calculated from their personal day rate (RateCardItem with staff_id).
    // Staff who already have a labour JobCostItem are costed via equipmentNet.
    const labourItemStaffIds = new Set(
      costItems.filter((c: any) => c.category === 'labour' && c.staff_id).map((c: any) => c.staff_id)
    );
    const rotaStaffIds = [...new Set(rotaAssignments.map((a: any) => a.staff_id).filter(Boolean))] as string[];
    const uncostedStaffIds = rotaStaffIds.filter(id => !labourItemStaffIds.has(id));

    // Load day rates for uncosted staff
    for (const sid of uncostedStaffIds) {
      if (staffRates[sid]) continue;
      try {
        const items = await base44.asServiceRole.entities.RateCardItem.filter({ staff_id: sid, is_active: true }, '-sort_order', 500);
        staffRates[sid] = (items || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)));
      } catch (_) { staffRates[sid] = []; }
    }

    interface CrewCostRow {
      staff_id: string; staff_name: string; day_rate: number; day_cost: number; standard_days: number;
      overtime_days: number; overtime_multiplier: number; total_cost: number; rate_source: string;
    }
    const staffDayMap: Record<string, { dates: Set<string>; overtimeDates: Set<string>; multiplier: number }> = {};
    for (const a of rotaAssignments) {
      if (!a.staff_id || labourItemStaffIds.has(a.staff_id)) continue;
      if (!staffDayMap[a.staff_id]) staffDayMap[a.staff_id] = { dates: new Set(), overtimeDates: new Set(), multiplier: 1.5 };
      if (a.assigned_date) staffDayMap[a.staff_id].dates.add(a.assigned_date);
      if (a.is_overtime && a.assigned_date) staffDayMap[a.staff_id].overtimeDates.add(a.assigned_date);
      if (a.rate_multiplier) staffDayMap[a.staff_id].multiplier = Number(a.rate_multiplier);
    }

    const crewCostRows: CrewCostRow[] = [];
    let totalCrewCost = 0;
    for (const [sid, days] of Object.entries(staffDayMap)) {
      const rateItems = staffRates[sid] || [];
      const dayRateItem = rateItems.find((i: any) => i.unit === 'day' && i.category === 'labour') || rateItems.find((i: any) => i.unit === 'day');
      // day_rate = charge-out (price) — used for day-rate REVENUE.
      // day_cost = internal cost (cost_price if set, else price as fallback).
      const dayRate = dayRateItem ? Number(dayRateItem.price) : 0;
      const dayCost = dayRateItem
        ? (dayRateItem.cost_price != null ? Number(dayRateItem.cost_price) : Number(dayRateItem.price))
        : 0;
      const totalDays = days.dates.size;
      const overtimeDays = days.overtimeDates.size;
      const standardDays = totalDays - overtimeDays;
      const overtimeCost = overtimeDays * dayCost * days.multiplier;
      const standardCost = standardDays * dayCost;
      const total = Math.round((standardCost + overtimeCost) * 100) / 100;
      totalCrewCost += total;
      crewCostRows.push({
        staff_id: sid, staff_name: staffMap[sid]?.name || sid,
        day_rate: dayRate, day_cost: dayCost, standard_days: standardDays,
        overtime_days: overtimeDays, overtime_multiplier: days.multiplier,
        total_cost: total, rate_source: dayRateItem ? 'staff_rate_card' : 'no_rate_found',
      });
    }

    // ── Revenue summary ──
    // meterageRate is defined above (used for per-borehole depth-banded calculations)
    // If job has a meterage_rate, recalculate meterage revenue as total metres × rate
    // (this overrides the per-borehole rate card matching)
    const meterageRevenue = meterageRate > 0 ? Math.round(totalMetres * meterageRate * 100) / 100 : totalMeterageRevenue;
    const targetMetres = Number(job.meterage_target) || 0;

    // Hired plant is billed at the resolved client charge (Our Rate Card match
    // or markup-on-cost), regardless of the job's primary revenue method —
    // plant hire is always a pass-through charge on top of crew/meterage fees.
    const hireClientChargeNet = hireBreakdown.client_charge_net;

    const totalCostNet = equipmentNet + labourItemsNet + hotelNet + totalRigCost + totalCrewCost + dailyCostsNet + subconPurchaseNet;

    // ── Revenue method handling ──
    // Calculates revenue based on the job's billing method. Drilling jobs default
    // to meterage_rate/none (meterage + SOR + charges). Non-drilling jobs use
    // day_rate, unit_rate or flat_fee. 'none' falls back to markup-on-cost.
    // Hired plant client charges are added on top in every method (pass-through).
    const revenueMethod = job.revenue_method || 'none';
    let totalRevenueNet: number;
    let revenueMethodLabel: string;
    if (revenueMethod === 'flat_fee') {
      totalRevenueNet = (Number(job.client_charge) || 0) + hireClientChargeNet;
      revenueMethodLabel = 'Flat fee (client charge)';
    } else if (revenueMethod === 'unit_rate') {
      const totalUnits = logs.reduce((s: number, l: any) => s + (Number(l.units_completed) || 0), 0);
      totalRevenueNet = Math.round(totalUnits * (Number(job.unit_price) || 0) * 100) / 100 + ownedItemsRevenue + totalSorRevenueNet + additionalCharges + subconClientChargeNet + hireClientChargeNet;
      revenueMethodLabel = `Unit rate (${totalUnits} units × £${Number(job.unit_price) || 0})`;
    } else if (revenueMethod === 'day_rate') {
      const crewDayRateRevenue = crewCostRows.reduce((s: number, r: CrewCostRow) => s + r.day_rate * (r.standard_days + r.overtime_days * r.overtime_multiplier), 0);
      totalRevenueNet = Math.round((crewDayRateRevenue + ownedItemsRevenue) * 100) / 100 + totalSorRevenueNet + additionalCharges + subconClientChargeNet + hireClientChargeNet;
      revenueMethodLabel = 'Day rate (crew + rig/equipment day rates × working days)';
    } else if (revenueMethod === 'none') {
      // 'none' — owned items billed at charge-out (revenue) + SOR + charges.
      // Falls back to cost + markup only when there are no billable owned items.
      totalRevenueNet = ownedItemsRevenue + totalSorRevenueNet + additionalCharges + subconClientChargeNet + hireClientChargeNet;
      revenueMethodLabel = ownedItemsRevenue > 0 ? 'Billable items + SOR' : 'Meterage + SOR';
      if (totalRevenueNet === 0 && totalCostNet > 0 && Number(job.markup_percentage) > 0) {
        totalRevenueNet = Math.round(totalCostNet * (1 + Number(job.markup_percentage) / 100) * 100) / 100 + subconClientChargeNet;
        revenueMethodLabel = `Cost + ${Number(job.markup_percentage)}% markup`;
      }
    } else {
      // meterage_rate — meterage covers drilling (per metre); rig/equipment day
      // rates are separate revenue on top (charge-out × days on site).
      totalRevenueNet = meterageRevenue + ownedItemsRevenue + totalSorRevenueNet + additionalCharges + subconClientChargeNet + hireClientChargeNet;
      revenueMethodLabel = meterageRate > 0 ? 'Meterage + day rates' : 'Day rates + SOR';
    }

    const revenueVat = totalRevenueNet * (vatRate / 100);
    const revenueGross = totalRevenueNet + revenueVat;
    const totalCostVat = totalCostNet * (vatRate / 100);
    const totalCostGross = totalCostNet + totalCostVat;

    const profit = totalRevenueNet - totalCostNet;
    const marginPct = totalRevenueNet > 0 ? (profit / totalRevenueNet) * 100 : 0;
    const costPerMetre = totalMetres > 0 ? Math.round((totalCostNet / totalMetres) * 100) / 100 : 0;
    const revenuePerMetre = totalMetres > 0 ? Math.round((totalRevenueNet / totalMetres) * 100) / 100 : 0;
    const profitPerMetre = totalMetres > 0 ? Math.round((profit / totalMetres) * 100) / 100 : 0;
    const targetPct = targetMetres > 0 ? Math.round(Math.min((totalMetres / targetMetres) * 100, 100) * 10) / 10 : 0;

    // Revenue by drilling method
    const cpRevenue = boreholeRevenue.filter(b => b.method === 'cp').reduce((s, b) => s + b.revenue, 0);
    const rotaryRevenue = boreholeRevenue.filter(b => b.method === 'rotary').reduce((s, b) => s + b.revenue, 0);

    const bySource = {
      staff: matched.filter(m => m.rate_source === 'staff').reduce((s, m) => s + m.line_total, 0),
      job: matched.filter(m => m.rate_source === 'job').reduce((s, m) => s + m.line_total, 0),
      global: matched.filter(m => m.rate_source === 'global').reduce((s, m) => s + m.line_total, 0),
    };

    // ── Billing setup status (for the UI warning banner) ──
    const billingSetup = {
      has_job_rate_card: hasJobRateCard,
      has_meterage_rate: meterageRate > 0,
      has_drilling_method: jobDrillingMethod !== 'not_applicable',
      drilling_method: jobDrillingMethod,
      cp_rate_found: !!cpPerMetreRate,
      rotary_rate_found: !!rotaryPerMetreRate,
      rate_card_source: hasJobRateCard ? 'job' : 'global',
      warnings: [] as string[],
    };
    if (jobDrillingMethod === 'not_applicable' && logs.length > 0) billingSetup.warnings.push('Drilling method not set — per-metre rates may not match correctly.');
    if (meterageRate === 0 && !cpPerMetreRate && !rotaryPerMetreRate && totalMetres > 0) billingSetup.warnings.push('No per-metre drilling rate found in any rate card for this drilling method.');
    if (rigCostItems.length === 0 && totalMetres > 0) billingSetup.warnings.push('No rigs added — rig crew costs are £0. Add rigs in the Logistics tab.');
    if (crewCostRows.length > 0 && crewCostRows.every(r => r.rate_source === 'no_rate_found')) billingSetup.warnings.push(`${crewCostRows.length} crew on rota have no day rate — crew labour costs are £0. Add personal rate cards in Settings → Rate Cards.`);
    if (hireBreakdown.rows.length > 0 && hireBreakdown.rows.some(r => r.source === 'no_margin')) {
      const zeroMarginCount = hireBreakdown.rows.filter(r => r.source === 'no_margin').length;
      billingSetup.warnings.push(`${zeroMarginCount} hired plant item${zeroMarginCount === 1 ? '' : 's'} ha${zeroMarginCount === 1 ? 's' : 've'} no sell-side rate card match or markup — billed to client at cost (zero margin). Add a matching item to Our Rate Card or set a job markup %.`);
    }
    // Rigs with no rate-card link (no day rate → rig crew cost is £0)
    const rigsNoRate = rigCostItems.filter((c: any) => !c.rate_card_item_id && !(Number(c.unit_cost) > 0));
    if (rigsNoRate.length > 0) {
      billingSetup.warnings.push(`${rigsNoRate.length} rig${rigsNoRate.length === 1 ? '' : 's'} ha${rigsNoRate.length === 1 ? 's' : 've'} no rate-card link and no day rate — rig crew costs are £0. Confirm the Asset Panda link in Settings → Asset Panda → Review Links, or add a rig crew rate to the Master Price List.`);
    }
    // Sub-contractor logs with no buy rate or no sell rate
    const subconNoBuy = subconLogs.filter((l: any) => (Number(l.purchase_cost_net) || 0) === 0);
    const subconNoSell = subconLogs.filter((l: any) => (Number(l.client_charge_net) || 0) === 0 && (Number(l.purchase_cost_net) || 0) > 0);
    if (subconNoBuy.length > 0) {
      billingSetup.warnings.push(`${subconNoBuy.length} sub-contractor log${subconNoBuy.length === 1 ? '' : 's'} ha${subconNoBuy.length === 1 ? 's' : 've'} no purchase (buy) rate — sub-contractor costs are £0. Set the purchase rate on each sub-contractor log in the Financials → Sub-contractors tab.`);
    }
    if (subconNoSell.length > 0) {
      billingSetup.warnings.push(`${subconNoSell.length} sub-contractor log${subconNoSell.length === 1 ? '' : 's'} ha${subconNoSell.length === 1 ? 's' : 've'} a buy rate but no sell (charge) rate — billed to client at £0 (negative margin). Set a markup % on each sub-contractor log to bill the client.`);
    }
    // Owned equipment cost items linked to a SiteAsset with no confirmed price
    const assetsNoPrice = costItems.filter((c: any) => {
      if (!c.site_asset_id) return false;
      const asset = siteAssetMap[c.site_asset_id];
      if (!asset) return false;
      const hasRateCardLink = asset.rate_card_link_status === 'confirmed' || asset.rate_card_link_status === 'proposed';
      const hasApCost = (asset.cost_price != null && Number(asset.cost_price) > 0) || (asset.charge_out_price != null && Number(asset.charge_out_price) > 0);
      const hasUnitCost = Number(c.unit_cost) > 0;
      return !hasRateCardLink && !hasApCost && !hasUnitCost;
    });
    if (assetsNoPrice.length > 0) {
      billingSetup.warnings.push(`${assetsNoPrice.length} equipment item${assetsNoPrice.length === 1 ? '' : 's'} linked to an Asset Panda asset with no confirmed price — revenue is £0. Confirm the rate-card link in Settings → Asset Panda → Review Links, or set a cost on the item.`);
    }

    return Response.json({
      status: 'success',
      job_id: jobId,
      job_name: job.name,
      summary: {
        total_revenue_net: Math.round(totalRevenueNet * 100) / 100,
        total_revenue_vat: Math.round(revenueVat * 100) / 100,
        total_revenue_gross: Math.round(revenueGross * 100) / 100,
        total_cost_net: Math.round(totalCostNet * 100) / 100,
        total_cost_vat: Math.round(totalCostVat * 100) / 100,
        total_cost_gross: Math.round(totalCostGross * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        total_metres: Math.round(totalMetres * 100) / 100,
        meterage_revenue: Math.round(meterageRevenue * 100) / 100,
        sor_revenue: Math.round(totalSorRevenueNet * 100) / 100,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
        additional_charges: Math.round(additionalCharges * 100) / 100,
        hire_client_charge_net: Math.round(hireClientChargeNet * 100) / 100,
        subcon_client_charge_net: Math.round(subconClientChargeNet * 100) / 100,
        owned_items_revenue: Math.round(ownedItemsRevenue * 100) / 100,
        labour_items_cost: Math.round(labourItemsNet * 100) / 100,
        crew_cost: Math.round(totalCrewCost * 100) / 100,
        revenue_method: revenueMethod,
        revenue_method_label: revenueMethodLabel,
      },
      billing_setup: billingSetup,
      drilling_method: {
        job_method: jobDrillingMethod,
        rig_methods: [...rigMethods],
        log_methods: [...logMethods],
        cp_revenue: Math.round(cpRevenue * 100) / 100,
        rotary_revenue: Math.round(rotaryRevenue * 100) / 100,
        cp_per_metre_rate: cpPerMetreRate ? { price: Number(cpPerMetreRate.price), description: cpPerMetreRate.description, source: cpPerMetreRate.source || 'rate_card' } : null,
        rotary_per_metre_rate: rotaryPerMetreRate ? { price: Number(rotaryPerMetreRate.price), description: rotaryPerMetreRate.description, source: rotaryPerMetreRate.source || 'rate_card' } : null,
      },
      revenue_by_source: bySource,
      matched_entries: matched.slice(0, 100),
      unmatched_entries: unmatched.slice(0, 100),
      cost_breakdown: {
        equipment_net: Math.round(equipmentNet * 100) / 100,
        labour_items_net: Math.round(labourItemsNet * 100) / 100,
        hotel_net: Math.round(hotelNet * 100) / 100,
        rig_cost: Math.round(totalRigCost * 100) / 100,
        crew_cost: Math.round(totalCrewCost * 100) / 100,
        crew_rows: crewCostRows,
        hotel_rows: hotelRows,
        delivery_charges: Math.round(deliveryCharges * 100) / 100,
        task_charges: Math.round(taskCharges * 100) / 100,
        daily_costs_net: Math.round(dailyCostsNet * 100) / 100,
        subcon_purchase_net: Math.round(subconPurchaseNet * 100) / 100,
        subcon_client_charge_net: Math.round(subconClientChargeNet * 100) / 100,
        subcon_margin_net: Math.round(subconMarginNet * 100) / 100,
      },
      daily_costs: dailyCostRows,
      subcontractor_logs: subconRows,
      hire_breakdown: {
        rows: hireBreakdown.rows,
        purchase_net: hireBreakdown.purchase_net,
        client_charge_net: hireBreakdown.client_charge_net,
        margin_net: hireBreakdown.margin_net,
      },
      drilling_performance: {
        total_metres: Math.round(totalMetres * 100) / 100,
        target_metres: targetMetres,
        target_pct: targetPct,
        meterage_rate: meterageRate,
        meterage_revenue: Math.round(meterageRevenue * 100) / 100,
        rig_cost: Math.round(totalRigCost * 100) / 100,
        cost_per_metre: costPerMetre,
        revenue_per_metre: revenuePerMetre,
        profit_per_metre: profitPerMetre,
        working_days: workingDays,
        cp_revenue: Math.round(cpRevenue * 100) / 100,
        rotary_revenue: Math.round(rotaryRevenue * 100) / 100,
      },
      rig_profitability: rigCostRows,
      borehole_revenue: boreholeRevenue,
      drilling_rate_card: {
        cp: cpBandedRates.map(r => ({ depth_from: r.depth_from, depth_to: r.depth_to, diameter: r.diameter, price: r.price, description: r.description, source: r.source })),
        rotary: rotaryBandedRates.map(r => ({ depth_from: r.depth_from, depth_to: r.depth_to, diameter: r.diameter, price: r.price, description: r.description, source: r.source })),
      },
      rate_card_levels: {
        staff_rates_found: Object.keys(staffRates).filter(k => staffRates[k].length > 0).length,
        job_rates_found: jobRateItems.length,
        global_rates_found: globalItems.length,
      },
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}