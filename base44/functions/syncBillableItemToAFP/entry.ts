import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSourceRecordToAFP } from '../../shared/afpPopulation.ts';

/**
 * syncBillableItemToAFP — real-time entity automation handler.
 *
 * Fires on create (and update for JobAssetAssignment / JobCostItem / Timesheet)
 * of any billable field record. Maps the triggering entity to a source type,
 * resolves the draft AFP covering the record's date, and upserts the matching
 * AFPLineItem so the AFP is always current without a manual Refresh.
 *
 * Uses the service role so the automation runs without a user session.
 *
 * Input (entity automation payload):
 *   { event: { type, entity_name, entity_id }, data, old_data, changed_fields, payload_too_large }
 * Output: { success, afp_id, action } | { skipped: '...' }
 */

const SOURCE_MAP: Record<string, string> = {
  InvestigationLog: 'driller_log',
  SubcontractorLog: 'subcontractor',
  DeliveryLog: 'delivery',
  DailyCost: 'cost',
  JobAssetAssignment: 'asset_assignment',
  JobCostItem: 'job_cost_item',
  JobBillOfQuantities: 'boq_variation',
  Timesheet: 'timesheet',
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const b = base44.asServiceRole;
    const body = await req.json();
    const { event, data, payload_too_large } = body || {};
    const entityName = event?.entity_name;
    const entityId = event?.entity_id;

    const sourceType = SOURCE_MAP[entityName];
    if (!sourceType) return Response.json({ skipped: 'unknown_entity' });

    // Always re-fetch the latest record by ID so we see any charge stamped
    // by stampBillingCharge (which fires on the same create event). Without
    // this, the AFP line item would be built from the pre-stamp payload and
    // land with rate=0, amount=0.
    let record = data;
    if (entityId) {
      try {
        record = await b.entities[entityName].get(entityId);
      } catch (_) {
        // Fall back to the payload data if the fetch fails
      }
    }
    if (!record && payload_too_large && entityId) {
      try {
        record = await b.entities[entityName].get(entityId);
      } catch (_) {
        return Response.json({ skipped: 'fetch_failed' });
      }
    }
    if (!record) return Response.json({ skipped: 'no_data' });

    const result = await syncSourceRecordToAFP(b, sourceType, record);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}