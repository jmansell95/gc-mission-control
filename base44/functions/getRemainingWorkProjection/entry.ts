import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getRemainingWorkProjection — Remaining Work Value report engine
// ============================================================
// For each job (filtered by status, division, client, date range),
// computes:
//   - contracted_total: budget_amount | client_charge | AFP contract_value
//   - earned_to_date: max(AFP non-draft claimed, Invoice gross)
//   - remaining_balance: contracted_total - earned_to_date
//   - daily_run_rate: earned / elapsed working days (fallback: contract / total days)
//   - projected_earnings: daily_run_rate × remaining working days
//   - monthly_projection: per-month breakdown from as-of date to job end
//   - people_assigned + rigs_on_site counts and names

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

function monthlyBreakdown(asOf: string, endDate: string, dailyRate: number) {
  if (!endDate || !asOf) return [];
  const asOfDate = new Date(asOf + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (end < asOfDate) return [];

  const months: Array<{ month: string; working_days: number; projected: number }> = [];
  const d = new Date(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1);

  while (d <= end) {
    const monthStart = new Date(d);
    const monthEnd = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
    const effectiveStart = monthStart < asOfDate ? asOfDate : monthStart;
    const effectiveEnd = monthEnd > end ? end : monthEnd;

    const startStr = effectiveStart.toISOString().slice(0, 10);
    const endStr = effectiveEnd.toISOString().slice(0, 10);
    const wd = workingDays(startStr, endStr);

    months.push({
      month: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      working_days: wd,
      projected: Math.round(wd * dailyRate * 100) / 100,
    });

    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  return months;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Resilient auth check (read-only function, all queries use asServiceRole)
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

    // Filter by status (default: all except completed/cancelled)
    const defaultStatuses = ['planning', 'in_progress', 'on_hold', 'decommissioning'];
    const activeStatuses = statusFilter.length > 0 ? statusFilter : defaultStatuses;
    let filteredJobs = jobs.filter((j: any) => activeStatuses.includes(j.status));

    // Filter by client
    if (clientId) filteredJobs = filteredJobs.filter((j: any) => j.client_id === clientId);

    // Filter by job type
    if (jobTypeId) filteredJobs = filteredJobs.filter((j: any) => j.job_type === jobTypeId);

    // Filter by date range (jobs active within the range: jStart <= toD && jEnd >= fromD)
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
    const jobRotas = allRotas.filter((r: any) => jobIds.includes(r.job_id));

    let allRigAssignments: any[] = [];
    try { allRigAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 500); } catch (_) {}
    const jobRigAssignments = allRigAssignments.filter((a: any) =>
      jobIds.includes(a.job_id) && a.asset_type === 'rig'
    );

    let allStaff: any[] = [];
    try { allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500); } catch (_) {}
    const staffMap: Record<string, string> = {};
    for (const s of allStaff) staffMap[s.id] = s.name;

    // Group by job
    const afpByJob: Record<string, any[]> = {};
    for (const a of jobAfps) { (afpByJob[a.job_id] = afpByJob[a.job_id] || []).push(a); }

    const invoiceByJob: Record<string, any[]> = {};
    for (const i of jobInvoices) { (invoiceByJob[i.job_id] = invoiceByJob[i.job_id] || []).push(i); }

    const rotaByJob: Record<string, any[]> = {};
    for (const r of jobRotas) { (rotaByJob[r.job_id] = rotaByJob[r.job_id] || []).push(r); }

    const rigByJob: Record<string, any[]> = {};
    for (const a of jobRigAssignments) { (rigByJob[a.job_id] = rigByJob[a.job_id] || []).push(a); }

    // ── Compute per-job projection ──
    const results = filteredJobs.map((job: any) => {
      const afps = afpByJob[job.id] || [];
      const invoices = invoiceByJob[job.id] || [];
      const rotas = rotaByJob[job.id] || [];
      const rigs = rigByJob[job.id] || [];

      // Contracted total: budget_amount → client_charge (flat_fee) → AFP contract_value → AFP total_claimed
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

      // Earned to date: max(AFP non-draft claimed, Invoice gross) — avoids double-counting
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

      // Daily run-rate: actual pace if earned, else expected pace from contract
      let dailyRunRate = 0;
      if (elapsedDays > 0 && earnedToDate > 0) {
        dailyRunRate = earnedToDate / elapsedDays;
      } else if (contractedTotal > 0 && totalWorkingDays > 0) {
        dailyRunRate = contractedTotal / totalWorkingDays;
      }

      const projectedEarnings = Math.round(dailyRunRate * remainingDays * 100) / 100;

      // People assigned (distinct staff from rota)
      const crewIds = [...new Set(rotas.map((r: any) => r.staff_id).filter(Boolean))] as string[];
      const crewNames = crewIds.map((id: string) => staffMap[id] || id).filter(Boolean);

      // Rigs on site
      const rigNames = rigs.map((r: any) => r.asset_name || 'Rig').filter(Boolean);

      // Monthly projection
      const monthlyProjection = monthlyBreakdown(asOfDate, job.end_date, dailyRunRate);

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
        daily_run_rate: Math.round(dailyRunRate * 100) / 100,
        total_working_days: totalWorkingDays,
        elapsed_working_days: elapsedDays,
        remaining_working_days: remainingDays,
        projected_earnings: projectedEarnings,
        variance: Math.round((projectedEarnings - remainingBalance) * 100) / 100,
        people_assigned_count: crewIds.length,
        rigs_on_site_count: rigs.length,
        crew_names: crewNames,
        rig_names: rigNames,
        monthly_projection: monthlyProjection,
      };
    });

    // Sort by remaining balance descending
    results.sort((a, b) => b.remaining_balance - a.remaining_balance);

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

    return Response.json({ status: 'success', jobs: results, totals, as_of_date: asOfDate });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}