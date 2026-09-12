import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { bulkPopulateAFP } from '../../shared/afpPopulation.ts';

/**
 * autoPopulateNewAFP — entity automation that fires when a new AFP is created
 * (via the chain on submission or manually). Immediately runs the full bulk
 * population so the AFP is complete from the moment it exists — no manual
 * Refresh needed.
 *
 * Uses the service role so it runs without a user session.
 *
 * Input (entity automation payload):
 *   { event: { type, entity_name, entity_id }, data, payload_too_large }
 * Output: { success, populated, sources, total } | { skipped: '...' }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const b = base44.asServiceRole;
    const body = await req.json();
    const { event, data, payload_too_large } = body || {};
    const afpId = event?.entity_id || data?.id;

    if (!afpId) return Response.json({ skipped: 'no_afp_id' });

    // Only populate draft AFPs (submitted/approved/invoiced are locked)
    let afp = data;
    if (!afp || payload_too_large) {
      try { afp = await b.entities.AFP.get(afpId); } catch (_) { return Response.json({ skipped: 'fetch_failed' }); }
    }
    if (!afp) return Response.json({ skipped: 'no_data' });
    if (afp.status && afp.status !== 'draft') return Response.json({ skipped: 'not_draft' });

    const result = await bulkPopulateAFP(b, afpId, 'System (auto-populate)');
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}