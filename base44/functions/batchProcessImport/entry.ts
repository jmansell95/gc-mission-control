import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// batchProcessImport — processes large spreadsheet imports in
// chunks to avoid timeout on large datasets. Returns progress
// info so the frontend can display a progress bar and poll
// for completion.
//
// Payload: {
//   assignments: Array (full rota assignment array),
//   week_start: string,
//   batch_size?: number (default 50),
//   batch_index?: number (0-based, for pagination)
// }
//
// Returns: { ok, total, processed, remaining, batch_index, complete }
// Frontend calls repeatedly with incrementing batch_index until
// complete=true.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'director') {
      return Response.json({ error: 'Forbidden — admin or manager only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { assignments, week_start, batch_size, batch_index } = body;

    if (!Array.isArray(assignments)) {
      return Response.json({ error: 'Missing assignments array' }, { status: 400 });
    }

    const batchSize = Number(batch_size) || 50;
    const batchIndex = Number(batch_index) || 0;
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, assignments.length);
    const batch = assignments.slice(start, end);

    // Delete existing assignments for this week only on the first batch
    if (batchIndex === 0 && week_start) {
      await base44.asServiceRole.entities.RotaAssignment.deleteMany({ week_start });
    }

    // Process this batch
    let created = 0;
    if (batch.length > 0) {
      const res = await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
      created = (res as any[]).length;
    }

    const remaining = assignments.length - end;
    const complete = remaining <= 0;

    return Response.json({
      ok: true,
      total: assignments.length,
      processed: end,
      remaining,
      batch_index: batchIndex,
      batch_created: created,
      complete,
      next_batch_index: complete ? null : batchIndex + 1,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}