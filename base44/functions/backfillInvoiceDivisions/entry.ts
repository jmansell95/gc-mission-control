import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * backfillInvoiceDivisions — one-off maintenance function that stamps
 * division_id on every existing Invoice by looking up the parent job's
 * division_id. Run once after the Invoice entity gains the division_id
 * field so enterprise per-division financial stats (outstanding, revenue)
 * resolve correctly for historical invoices.
 *
 * Returns a summary: { total, updated, skipped, noJob, alreadySet }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;

    // Fetch all invoices in batches
    const fetchAll = async (entity, limit = 10000) => {
      const out: any[] = [];
      let skip = 0;
      while (true) {
        const batch = await sr.entities[entity].list('-created_date', limit, skip);
        out.push(...batch);
        if (batch.length < limit) break;
        skip += limit;
        if (skip > 50000) break;
      }
      return out;
    };

    const [invoices, jobs] = await Promise.all([
      fetchAll('Invoice'),
      fetchAll('Job'),
    ]);

    const jobMap = new Map(jobs.map((j: any) => [j.id, j]));

    let updated = 0;
    let skipped = 0;
    let noJob = 0;
    let alreadySet = 0;
    const toUpdate: any[] = [];

    for (const inv of invoices) {
      if (inv.division_id) {
        alreadySet++;
        continue;
      }
      const job = inv.job_id ? jobMap.get(inv.job_id) : null;
      if (!job) {
        noJob++;
        continue;
      }
      if (!job.division_id) {
        skipped++;
        continue;
      }
      toUpdate.push({ id: inv.id, division_id: job.division_id });
    }

    // Bulk update in batches of 500
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      try {
        await sr.entities.Invoice.bulkUpdate(batch);
        updated += batch.length;
      } catch (err) {
        console.error('Bulk update batch failed:', err);
      }
    }

    return Response.json({
      total: invoices.length,
      updated,
      skipped,
      noJob,
      alreadySet,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}