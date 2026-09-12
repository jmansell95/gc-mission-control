import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { enrichLogMetadata, isSptLog } from '../../shared/agsLogMetadata.ts';

// ============================================================
// backfillLogMetadata — one-time retroactive fix for existing logs
// ============================================================
// Iterates all InvestigationLog records with source='ags_import' and
// applies the same enrichLogMetadata fixes that importAGS now applies at
// ingest time:
//   1. Reclassifies SPTs from borehole_progress → 'spt'
//   2. Rewrites UUID-based sample descriptions to meaningful text
//   3. Rewrites generic "Imported from KeyLogBook AGS" descriptions
//      to human-readable strings with borehole_ref context
//
// Processes in batches of 500 (updateMany) to avoid timeout on 3,000+
// records. Runs as a service role so it can update all divisions' data.
//
// Input:  { job_id?: string }  (optional — if omitted, processes ALL jobs)
// Output: { success, processed, reclassified_spts, rewritten_descriptions, batches }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const targetJobId = body.job_id || null;

    // Fetch all ags_import logs (optionally scoped to one job)
    const filter: any = { source: 'ags_import' };
    if (targetJobId) filter.job_id = targetJobId;

    let allLogs: any[] = [];
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.InvestigationLog.filter(
        filter, '-created_date', 500, skip,
      );
      allLogs = allLogs.concat(batch);
      if (batch.length < 500) hasMore = false;
      else skip += 500;
      // Safety cap at 10,000 to avoid runaway
      if (allLogs.length >= 10000) break;
    }

    let processed = 0;
    let reclassifiedSpts = 0;
    let rewrittenDescriptions = 0;
    let batchCount = 0;

    // Process in batches of 500 via bulkUpdate
    for (let i = 0; i < allLogs.length; i += 500) {
      const batch = allLogs.slice(i, i + 500);
      const updates: any[] = [];

      for (const log of batch) {
        const originalType = log.log_type;
        const originalDesc = log.description;
        const enriched = enrichLogMetadata({ ...log });

        const changed: any = {};
        if (enriched.log_type !== originalType) {
          changed.log_type = enriched.log_type;
          reclassifiedSpts++;
        }
        if (enriched.description !== originalDesc) {
          changed.description = enriched.description;
          rewrittenDescriptions++;
        }

        if (Object.keys(changed).length > 0) {
          updates.push({ id: log.id, ...changed });
        }
        processed++;
      }

      if (updates.length > 0) {
        await base44.asServiceRole.entities.InvestigationLog.bulkUpdate(updates);
        batchCount++;
      }
    }

    return Response.json({
      success: true,
      job_id: targetJobId || 'all',
      total_logs_scanned: allLogs.length,
      processed,
      reclassified_spts: reclassifiedSpts,
      rewritten_descriptions: rewrittenDescriptions,
      batches_updated: batchCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}