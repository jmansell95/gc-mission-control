import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// createMonthlyAFPs — scheduled function (1st of each month)
// ============================================================
// Creates one draft AFP per active project for the current billing
// month. Each AFP covers one calendar month (1st → last day).
// The autoPopulateNewAFP entity automation fires on creation and
// immediately fills it with billable field data (driller logs,
// deliveries, timesheets, cost items, asset hire) for that period.
//
// Period chaining:
//   • First AFP: period_start = job.start_date (or month start)
//   • Subsequent: period_start = day after previous AFP's period_end
//   • period_end = last day of the current month
//   • certification_due = period_end + 5 days
//   • final_payment_notice = period_end + 30 days
//
// Idempotent: skips jobs that already have a draft AFP covering
// the current month.

function lastDayOfMonth(year: number, month: number): string {
  // month is 0-indexed
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const b = base44.asServiceRole;

    // Allow manual trigger from admin dashboard
    const body = await req.json().catch(() => ({}));
    const targetMonth = body.month; // optional: YYYY-MM override
    const targetJobId = body.job_id; // optional: single job only

    const now = new Date();
    const year = targetMonth ? parseInt(targetMonth.slice(0, 4)) : now.getUTCFullYear();
    const month = targetMonth ? parseInt(targetMonth.slice(5, 2)) - 1 : now.getUTCMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = lastDayOfMonth(year, month);

    // 1. Get active jobs (in_progress or decommissioning)
    const filter: any = { status: { $in: ['in_progress', 'decommissioning'] } };
    if (targetJobId) filter.id = targetJobId;
    const jobs = await b.entities.Job.filter(filter, '-start_date', 500);

    const created = [];
    const skipped = [];
    let errors = 0;

    for (const job of jobs) {
      try {
        // 2. Get existing AFPs for this job
        const afps = await b.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50);

        // 3. Check if a draft AFP already covers this month (idempotent)
        const covering = afps.find(
          (a: any) =>
            a.status === 'draft' &&
            (a.period_start_date || '') <= monthStart &&
            (a.period_end_date || monthEnd) >= monthEnd
        );
        if (covering) {
          skipped.push({ job_id: job.id, job_name: job.name, reason: 'already_has_draft', afp_id: covering.id });
          continue;
        }

        // 4. Determine period_start (day after last AFP end, or job start, or month start)
        const sortedByEnd = [...afps].sort((a: any, b: any) =>
          (b.period_end_date || '').localeCompare(a.period_end_date || '')
        );
        const lastAfp = sortedByEnd[0];
        let periodStart: string;
        if (lastAfp?.period_end_date) {
          periodStart = addDays(lastAfp.period_end_date, 1);
        } else if (job.start_date) {
          periodStart = job.start_date < monthStart ? monthStart : job.start_date;
        } else {
          periodStart = monthStart;
        }

        // Don't create if the period would start after the month end
        if (periodStart > monthEnd) {
          skipped.push({ job_id: job.id, job_name: job.name, reason: 'period_starts_after_month_end' });
          continue;
        }

        // 5. Sequential AFP number
        const nextNumber = afps.length + 1;

        // 6. Create the AFP
        const newAfp = await b.entities.AFP.create({
          job_id: job.id,
          job_name: job.name,
          job_reference: job.job_reference || '',
          division_id: job.division_id || '',
          afp_number: nextNumber,
          period_start_date: periodStart,
          period_end_date: monthEnd,
          certification_due_date: addDays(monthEnd, 5),
          final_payment_notice_date: addDays(monthEnd, 30),
          status: 'draft',
          total_claimed: 0,
          original_total: 0,
          disputed_total: 0,
          agreed_total: 0,
          dispute_status: 'none',
        });

        // autoPopulateNewAFP entity automation fires on create and fills it.
        // No explicit invoke needed — the automation handles it.

        created.push({
          afp_id: newAfp.id,
          job_id: job.id,
          job_name: job.name,
          afp_number: nextNumber,
          period_start: periodStart,
          period_end: monthEnd,
        });
      } catch (err) {
        errors++;
        skipped.push({ job_id: job.id, job_name: job.name, reason: 'error', error: err.message });
      }
    }

    return Response.json({
      ok: true,
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      month_start: monthStart,
      month_end: monthEnd,
      jobs_checked: jobs.length,
      afps_created: created.length,
      afps_skipped: skipped.length,
      errors,
      created,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}