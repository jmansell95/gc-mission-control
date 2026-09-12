import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * backfillFlatDivisions — one-time migration to assign existing flat (parentless)
 * divisions to a parent Business Unit, and tag them with the correct hierarchy_level.
 *
 * Accepts a JSON body:
 *   { "assignments": [{ "divisionId": "<id>", "parentBuId": "<bu-id>" }, ...] }
 *
 * For each assignment:
 *   1. Validates the parent BU exists and is a top-level division (no parent).
 *   2. Updates the division's parent_division_id and hierarchy_level='stream'.
 *   3. Logs the change to the SystemAuditLog.
 *
 * Returns: { processed, skipped, errors, summary }
 *
 * Admin-only (platform role 'admin').
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const assignments: Array<{ divisionId: string; parentBuId: string }> = body?.assignments;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return Response.json({ error: 'No assignments provided' }, { status: 400 });
    }

    // Fetch all divisions once to validate parent BUs
    const allDivisions = await base44.asServiceRole.entities.Division.list('-sort_order', 500);
    const divisionMap = new Map(allDivisions.map((d: any) => [d.id, d]));

    const processed: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const assignment of assignments) {
      const { divisionId, parentBuId } = assignment;
      if (!divisionId || !parentBuId) {
        skipped.push({ assignment, reason: 'Missing divisionId or parentBuId' });
        continue;
      }

      const division = divisionMap.get(divisionId);
      if (!division) {
        errors.push({ divisionId, reason: 'Division not found' });
        continue;
      }

      const parentBu = divisionMap.get(parentBuId);
      if (!parentBu) {
        errors.push({ divisionId, parentBuId, reason: 'Parent BU not found' });
        continue;
      }

      if (parentBu.parent_division_id) {
        errors.push({ divisionId, parentBuId, reason: 'Parent is not a top-level division (has its own parent)' });
        continue;
      }

      if (divisionId === parentBuId) {
        errors.push({ divisionId, reason: 'Cannot assign a division as its own parent' });
        continue;
      }

      // Skip if already assigned to this parent
      if (division.parent_division_id === parentBuId) {
        skipped.push({ divisionId, parentBuId, reason: 'Already assigned to this BU' });
        continue;
      }

      // Update the division
      try {
        await base44.asServiceRole.entities.Division.update(divisionId, {
          parent_division_id: parentBuId,
          hierarchy_level: 'stream',
        });

        // Audit log
        try {
          await base44.asServiceRole.entities.SystemAuditLog.create({
            action: 'backfill_division_parent',
            entity_type: 'Division',
            entity_id: divisionId,
            entity_name: division.name,
            changes_summary: `Assigned "${division.name}" to BU "${parentBu.name}" (parent_division_id: null → ${parentBuId}, hierarchy_level → stream)`,
            performed_by: user.id,
            performed_by_name: user.full_name || user.email,
          });
        } catch {}

        processed.push({
          divisionId,
          divisionName: division.name,
          parentBuId,
          parentBuName: parentBu.name,
        });
      } catch (err: any) {
        errors.push({ divisionId, reason: err.message || 'Update failed' });
      }
    }

    return Response.json({
      processed: processed.length,
      skipped: skipped.length,
      errors: errors.length,
      processedDetails: processed,
      skippedDetails: skipped,
      errorDetails: errors,
      summary: `${processed.length} divisions assigned to BUs, ${skipped.length} skipped, ${errors.length} errors`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}