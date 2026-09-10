import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getRemainingWorkProjection — Resource-Driven Monthly Projection
// ============================================================
// For each job (filtered by status, division, client, date range),
// computes a RESOURCE-DRIVEN monthly projection where each month's
// projected income is based on the actual crew (from RotaAssignment)
// and rigs (from JobCostItem rig entries) scheduled for that specific
// month, multiplied by their charge-out day rates and working days.
//
// Key logic:
//   - Crew per month: distinct staff_id from RotaAssignment where
//     assignment_type='job' and assigned_date falls in that month.
//   - Rigs per month: JobCostItem rig entries (linked to rig SiteAssets)
//     whose active period (start_date → end_date/off_hire_date) overlaps
//     that month.
//   - Crew day rates: from staff-specific RateCardItem (unit='day',
//     category='labour') — the charge-out sell price.
//   - Rig day rates: from JobCostItem unit_cost (or negotiated_unit_cost
//     if price_confirmed).
//   - Monthly projected = (sum crew day rates + sum rig day rates) ×
//     working days in that month.
//   - Fallback: when no day rates found for any resource, use the flat
//     contracted_total / total_working_days approach.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function workingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (e < s) return 0;
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function monthKey(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 7); // YYYY-MM
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

// Check if a rig's active period overlaps a given month
function rigOverlapsMonth(rigStart: string, rigEnd: string, monthStart: string, monthEnd: string): boolean {
  if (!rigStart) return false;
  // rigEnd falls back to a far-future date if null (rig still on site indefinitely)
  const effectiveEnd = rigEnd || '2099-12-31';
  return rigStart <= monthEnd && effectiveEnd >= monthStart;
}

// Resolve crew day rate from staff-specific RateCardItem records
function resolveCrewDayRate(staffId: string, staffRateMap: Record<string, any[]>): { day_rate: number; rate_item: any | null } {
  const items = staffRateMap[staffId] || [];
  // Prefer labour category with unit 'day', then any unit 'day'
  const dayRateItem = items.find((i: any) => i.unit === 'day' && i.category === 'labour')
    || items.find((i: any) => i.unit === 'day');
  if (!dayRateItem) return { day_rate: 0, rate_item: null };
  return { day_rate: Number(dayRateItem.price) || 0, rate_item: dayRateItem };
}

// Resolve rig day rate from JobCostItem
function resolveRigDayRate(costItem: any): number {
  if (costItem.price_confirmed && costItem.negotiated_unit_cost != null) {
    return Number(costItem.negotiated_unit_cost) || 0;
  }
  return Number(costItem.unit_cost) || 0;
}

// Get rig active period end date
function rigEndDate(costItem: any, jobEndDate: string): string {
  return costItem.off_hire_date || costItem.end_date || jobEndDate || '';
}

// Get rig active period start date
function rigStartDate(costItem: any): string {
  return costItem.start_date || '';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Resilient auth check
    try {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } catch (_) { /* continue with service role */ }

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const asOfDate: string = body.as_of_date || new Date().toISOString().slice(0, 10);
    const statusFilter: string[] = Array.isArray(body.status_filter) ? body.status_filter : [];
    const divisionId: string = body.division_id || '';
    const clientId: string = body.client_id || '';
    const jobTypeId: string = body.job_type_id || '';
    const dateFrom: string = body.date_from || '';
    const dateTo: string = body.date_to || '';

    // ── Load jobs (filtered by division if provided) ──
    let jobs: any[] = [];
    try {
      jobs = await base44.asServiceRole.entities.Job.filter(
        divisionId ? { division_id: divisionId } : {},
        '-created_date', 500
      );
    } catch (_) {}

    // Filter by status
    const defaultStatuses = ['planning', 'in_progress', 'on_hold', 'decommissioning'];
    const activeStatuses = statusFilter.length > 0 ? statusFilter : defaultStatuses;
    let filteredJobs = jobs.filter((j: any) => activeStatuses.includes(j.status));

    // Filter by client
    if (clientId) filteredJobs = filteredJobs.filter((j: any) => j.client_id === clientId);

    // Filter by job type
    if (jobTypeId) filteredJobs = filteredJobs.filter((j: any) => j.job_type === jobTypeId);

    // Filter by date range
    if (dateFrom && dateTo) {
      const fromD = new Date(dateFrom + 'T00:00:00');
      const toD = new Date(dateTo + 'T00:00:00');
      filteredJobs = filteredJobs.filter((j: any) => {
        if (!j.start_date || !j.end_date) return false;
        const jStart = new Date(j.start_date + 'T00:00:00');
        const jEnd = new Date(j.end_date + 'T00:00:00');
        return jStart <= toD && jEnd >= fromD;
      });
    }

    if (filteredJobs.length === 0) {
      return Response.json({
        status: 'success',
        jobs: [],
        totals: {
          job_count: 0, total_contracted: 0, total_earned: 0,
          total_remaining: 0, total_projected: 0,
          total_people: 0, total_rigs: 0,
        },
        portfolio_monthly: [],
        as_of_date: asOfDate,
      });
    }

    const jobIds = filteredJobs.map((j: any) => j.id);

    // ── Bulk load related data ──
    let allAfps: any[] = [];
    try { allAfps = await base44.asServiceRole.entities.AFP.list('-created_date', 500); } catch (_) {}
    const jobAfps = allAfps.filter((a: any) => jobIds.includes(a.job_id));

    let allInvoices: any[] = [];
    try { allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 500); } catch (_) {}
    const jobInvoices = allInvoices.filter((i: any) =>
      jobIds.includes(i.job_id) && ['paid', 'sent', 'overdue'].includes(i.status)
    );

    let allRotas: any[] = [];
    try { allRotas = await base44.asServiceRole.entities.RotaAssignment.list('-created_date', 500); } catch (_) {}
    const jobRotas = allRotas.filter((r: any) => jobIds.includes(r.job_id) && r.assignment_type === 'job');

    let allCostItems: any[] = [];
    try { allCostItems = await base44.asServiceRole.entities.JobCostItem.list('-created_date', 500); } catch (_) {}
    const jobCostItems = allCostItems.filter((c: any) => jobIds.includes(c.job_id));

    let allSiteAssets: any[] = [];
    try { allSiteAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500); } catch (_) {}
    const siteAssetMap: Record<string, any> = {};
    for (const a of allSiteAssets) siteAssetMap[a.id] = a;

    let allStaff: any[] = [];
    try { allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500); } catch (_) {}
    const staffMap: Record<string, string> = {};
    for (const s of allStaff) staffMap[s.id] = s.name;

    // Bulk load all active rate card items (our_company source) for crew day rates
    let allRateItems: any[] = [];
    try { allRateItems = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, '-sort_order', 500); } catch (_) {}
    // Group by staff_id (only items with staff_id set are personal rate cards)
    const staffRateMap: Record<string, any[]> = {};
    for (const r of allRateItems) {
      if (r.staff_id && r.price != null && !isNaN(Number(r.price))) {
        if (!staffRateMap[r.staff_id]) staffRateMap[r.staff_id] = [];
        staffRateMap[r.staff_id].push(r);
      }
    }

    // Group by job
    const afpByJob: Record<string, any[]> = {};
    for (const a of jobAfps) { (afpByJob[a.job_id] = afpByJob[a.job_id] || []).push(a); }

    const invoiceByJob: Record<string, any[]> = {};
    for (const i of jobInvoices) { (invoiceByJob[i.job_id] = invoiceByJob[i.job_id] || []).push(i); }

    const rotaByJob: Record<string, any[]> = {};
    for (const r of jobRotas) { (rotaByJob[r.job_id] = rotaByJob[r.job_id] || []).push(r); }

    const costItemByJob: Record<string, any[]> = {};
    for (const c of jobCostItems) { (costItemByJob[c.job_id] = costItemByJob[c.job_id] || []).push(c); }

    // ── Compute per-job projection ──
    const results = filteredJobs.map((job: any) => {
      const afps = afpByJob[job.id] || [];
      const invoices = invoiceByJob[job.id] || [];
      const rotas = rotaByJob[job.id] || [];
      const costItems = costItemByJob[job.id] || [];

      // Contracted total
      let contractedTotal = 0;
      if (Number(job.budget_amount) > 0) {
        contractedTotal = Number(job.budget_amount);
      } else if (Number(job.client_charge) > 0 && job.revenue_method === 'flat_fee') {
        contractedTotal = Number(job.client_charge);
      } else {
        const cv = afps.reduce((s: number, a: any) => s + (Number(a.contract_value) || 0), 0);
        if (cv > 0) contractedTotal = cv;
        else contractedTotal = afps.reduce((s: number, a: any) => s + (Number(a.total_claimed) || 0), 0);
      }

      // Earned to date
      const afpEarned = afps
        .filter((a: any) => a.status !== 'draft')
        .reduce((s: number, a: any) => s + (Number(a.agreed_total) || Number(a.total_claimed) || 0), 0);
      const invoiceEarned = invoices.reduce((s: number, i: any) => s + (Number(i.gross_total) || 0), 0);
      const earnedToDate = Math.max(afpEarned, invoiceEarned);

      // Remaining balance
      const remainingBalance = Math.max(0, contractedTotal - earnedToDate);

      // Working days
      const totalWorkingDays = workingDays(job.start_date, job.end_date);
      const elapsedDays = workingDays(job.start_date, asOfDate);
      const remainingDays = workingDays(asOfDate, job.end_date);

      // Flat-rate daily run-rate (fallback)
      let flatDailyRate = 0;
      if (elapsedDays > 0 && earnedToDate > 0) {
        flatDailyRate = earnedToDate / elapsedDays;
      } else if (contractedTotal > 0 && totalWorkingDays > 0) {
        flatDailyRate = contractedTotal / totalWorkingDays;
      }

      // ── Identify rig cost items (JobCostItem linked to rig SiteAssets) ──
      const rigCostItems = costItems.filter((c: any) => {
        if (!c.site_asset_id) return false;
        const asset = siteAssetMap[c.site_asset_id];
        return asset && (asset.is_rig === true || asset.asset_type === 'rig');
      });

      // ── Build crew day rate lookup for this job's staff ──
      const crewDayRateCache: Record<string, number> = {};
      const crewRateItemCache: Record<string, any> = {};
      for (const r of rotas) {
        if (!r.staff_id || crewDayRateCache[r.staff_id] !== undefined) continue;
        const { day_rate, rate_item } = resolveCrewDayRate(r.staff_id, staffRateMap);
        crewDayRateCache[r.staff_id] = day_rate;
        crewRateItemCache[r.staff_id] = rate_item;
      }

      // ── Build rig day rate lookup for this job's rigs ──
      const rigRows = rigCostItems.map((c: any) => {
        const asset = siteAssetMap[c.site_asset_id] || {};
        return {
          rig_name: c.description || asset.name || 'Rig',
          rig_type: asset.rig_type || '',
          day_rate: resolveRigDayRate(c),
          start_date: rigStartDate(c),
          end_date: rigEndDate(c, job.end_date),
          current_location: c.current_location || 'yard',
        };
      });

      // ── Compute resource-driven monthly projection ──
      const monthlyProjection: any[] = [];
      const asOf = new Date(asOfDate + 'T00:00:00');
      const jobEnd = new Date(job.end_date + 'T00:00:00');

      let d = new Date(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1);
      while (d <= jobEnd) {
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const mStart = firstDayOfMonth(year, month);
        const mEnd = lastDayOfMonth(year, month);

        // Effective range (clamp to as-of and job end)
        const effectiveStart = mStart < asOfDate ? asOfDate : mStart;
        const effectiveEnd = mEnd > job.end_date ? job.end_date : mEnd;
        const wd = workingDays(effectiveStart, effectiveEnd);

        // Crew for this month: distinct staff with assigned_date in this month
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const crewInMonth: Record<string, string> = {}; // staff_id → staff_name
        for (const r of rotas) {
          if (!r.staff_id) continue;
          if (r.assigned_date && r.assigned_date.slice(0, 7) === monthPrefix) {
            crewInMonth[r.staff_id] = staffMap[r.staff_id] || r.staff_id;
          }
        }
        const crewIds = Object.keys(crewInMonth);
        const crewDetail = crewIds.map((sid) => ({
          staff_id: sid,
          staff_name: crewInMonth[sid],
          day_rate: crewDayRateCache[sid] || 0,
        }));

        // Rigs for this month: rig entries whose active period overlaps
        const rigsInMonth = rigRows.filter((rig) =>
          rigOverlapsMonth(rig.start_date, rig.end_date, mStart, mEnd)
        );
        const rigDetail = rigsInMonth.map((rig) => ({
          rig_name: rig.rig_name,
          rig_type: rig.rig_type,
          day_rate: rig.day_rate,
        }));

        // Daily rate total
        const crewDayRateSum = crewDetail.reduce((s, c) => s + c.day_rate, 0);
        const rigDayRateSum = rigDetail.reduce((s, r) => s + r.day_rate, 0);
        const dailyRateTotal = crewDayRateSum + rigDayRateSum;

        const projected = Math.round(dailyRateTotal * wd * 100) / 100;

        monthlyProjection.push({
          month: `${MONTH_NAMES[month]} ${year}`,
          month_key: monthPrefix,
          working_days: wd,
          crew_count: crewIds.length,
          rig_count: rigsInMonth.length,
          crew_detail: crewDetail,
          rig_detail: rigDetail,
          daily_rate_total: Math.round(dailyRateTotal * 100) / 100,
          projected,
          is_gap_month: crewIds.length === 0,
        });

        d.setUTCMonth(d.getUTCMonth() + 1);
      }

      // ── Determine projected earnings ──
      const resourceDrivenTotal = monthlyProjection.reduce((s, m) => s + m.projected, 0);
      let projectedEarnings: number;
      let usingFallback = false;

      if (resourceDrivenTotal > 0) {
        projectedEarnings = Math.round(resourceDrivenTotal * 100) / 100;
      } else {
        // Fallback: flat rate × remaining days
        projectedEarnings = Math.round(flatDailyRate * remainingDays * 100) / 100;
        usingFallback = true;
        // Replace monthly projection with flat-rate distribution
        for (const m of monthlyProjection) {
          m.projected = Math.round(flatDailyRate * m.working_days * 100) / 100;
          m.daily_rate_total = Math.round(flatDailyRate * 100) / 100;
          m.is_fallback = true;
        }
      }

      // People assigned (distinct staff from all rota)
      const crewIds = [...new Set(rotas.map((r: any) => r.staff_id).filter(Boolean))] as string[];
      const crewNames = crewIds.map((id: string) => staffMap[id] || id).filter(Boolean);

      // Rigs on site (all rig cost items)
      const rigNames = rigRows.map((r: any) => r.rig_name).filter(Boolean);

      return {
        job_id: job.id,
        job_name: job.name,
        job_reference: job.job_reference || '',
        status: job.status,
        start_date: job.start_date || '',
        end_date: job.end_date || '',
        division_id: job.division_id || '',
        client_id: job.client_id || '',
        revenue_method: job.revenue_method || 'none',
        contracted_total: Math.round(contractedTotal * 100) / 100,
        earned_to_date: Math.round(earnedToDate * 100) / 100,
        remaining_balance: Math.round(remainingBalance * 100) / 100,
        daily_run_rate: Math.round(flatDailyRate * 100) / 100,
        total_working_days: totalWorkingDays,
        elapsed_working_days: elapsedDays,
        remaining_working_days: remainingDays,
        projected_earnings: projectedEarnings,
        using_fallback: usingFallback,
        variance: Math.round((projectedEarnings - remainingBalance) * 100) / 100,
        people_assigned_count: crewIds.length,
        rigs_on_site_count: rigRows.length,
        crew_names: crewNames,
        rig_names: rigNames,
        monthly_projection: monthlyProjection,
      };
    });

    // Sort by remaining balance descending
    results.sort((a, b) => b.remaining_balance - a.remaining_balance);

    // ── Portfolio monthly aggregation ──
    const portfolioMonthlyMap: Record<string, { month: string; month_key: string; working_days: number; crew_count: number; rig_count: number; projected: number }> = {};
    for (const job of results) {
      for (const m of job.monthly_projection) {
        if (!portfolioMonthlyMap[m.month_key]) {
          portfolioMonthlyMap[m.month_key] = {
            month: m.month, month_key: m.month_key,
            working_days: 0, crew_count: 0, rig_count: 0, projected: 0,
          };
        }
        const pm = portfolioMonthlyMap[m.month_key];
        pm.working_days += m.working_days;
        pm.crew_count += m.crew_count;
        pm.rig_count += m.rig_count;
        pm.projected = Math.round((pm.projected + m.projected) * 100) / 100;
      }
    }
    const portfolioMonthly = Object.values(portfolioMonthlyMap).sort((a, b) => a.month_key.localeCompare(b.month_key));

    // Portfolio totals
    const totals = {
      job_count: results.length,
      total_contracted: Math.round(results.reduce((s, r) => s + r.contracted_total, 0) * 100) / 100,
      total_earned: Math.round(results.reduce((s, r) => s + r.earned_to_date, 0) * 100) / 100,
      total_remaining: Math.round(results.reduce((s, r) => s + r.remaining_balance, 0) * 100) / 100,
      total_projected: Math.round(results.reduce((s, r) => s + r.projected_earnings, 0) * 100) / 100,
      total_people: results.reduce((s, r) => s + r.people_assigned_count, 0),
      total_rigs: results.reduce((s, r) => s + r.rigs_on_site_count, 0),
    };

    return Response.json({ status: 'success', jobs: results, totals, portfolio_monthly: portfolioMonthly, as_of_date: asOfDate });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}