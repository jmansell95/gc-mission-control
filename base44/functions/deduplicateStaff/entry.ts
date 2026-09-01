import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * deduplicateStaff — one-time cleanup that removes duplicate Staff records
 * (same name + same linked user_id) so each person appears only once on the
 * rota. For each duplicate group, keeps the record with the most linked data
 * (rota assignments, compliance items, timesheets), re-points all linked
 * records from the duplicates onto the kept record, then deletes the empties.
 *
 * Dedup key: lowercased name + user_id. Records with no user_id are skipped
 * (can't confirm they're the same person).
 *
 * Guard: if any duplicate has MORE linked data than the selected kept record,
 * the group is aborted and logged — we never delete the wrong record.
 */

const LIST_LIMIT = 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Fetch all Staff and linked entities in parallel.
    const [staff, rotas, compliance, timesheets] = await Promise.all([
      base44.asServiceRole.entities.Staff.list('-created_date', LIST_LIMIT),
      base44.asServiceRole.entities.RotaAssignment.list('-created_date', LIST_LIMIT),
      base44.asServiceRole.entities.ComplianceItem.list('-created_date', LIST_LIMIT),
      base44.asServiceRole.entities.Timesheet.list('-created_date', LIST_LIMIT),
    ]);

    // Build count maps keyed by staff_id / reference_id.
    const rotaCount = new Map<string, number>();
    rotas.forEach((r) => { if (r.staff_id) rotaCount.set(r.staff_id, (rotaCount.get(r.staff_id) || 0) + 1); });
    const compCount = new Map<string, number>();
    compliance.forEach((c) => { if (c.reference_id) compCount.set(c.reference_id, (compCount.get(c.reference_id) || 0) + 1); });
    const tsCount = new Map<string, number>();
    timesheets.forEach((t) => { if (t.staff_id) tsCount.set(t.staff_id, (tsCount.get(t.staff_id) || 0) + 1); });

    // Score a staff record by total linked data.
    const score = (s: any): number =>
      (rotaCount.get(s.id) || 0) + (compCount.get(s.id) || 0) + (tsCount.get(s.id) || 0);

    // Group by lowercased name + user_id (skip records with no user_id or name).
    const groups: Record<string, any[]> = {};
    staff.forEach((s) => {
      if (!s.user_id || !s.name) return;
      const key = s.name.toLowerCase().trim() + '|' + s.user_id;
      (groups[key] = groups[key] || []).push(s);
    });

    let groupsProcessed = 0;
    let recordsDeleted = 0;
    let assignmentsRepointed = 0;
    let complianceRepointed = 0;
    let timesheetsRepointed = 0;
    const skippedGroups: any[] = [];

    for (const [key, group] of Object.entries(groups)) {
      if (group.length <= 1) continue;

      // Score each record, sort by score desc then oldest created_date wins.
      const scored = group.map((s) => ({ record: s, sc: score(s) }));
      scored.sort((a, b) => b.sc - a.sc || String(a.record.created_date || '').localeCompare(String(b.record.created_date || '')));
      const kept = scored[0];
      const duplicates = scored.slice(1);

      // Guard: if any duplicate has strictly more data than the kept record,
      // abort the group so we never delete the wrong one.
      for (const d of duplicates) {
        if (d.sc > kept.sc) {
          skippedGroups.push({ key, reason: 'Duplicate has more linked data than the selected kept record', keptId: kept.record.id, duplicateId: d.record.id });
          continue;
        }
      }
      if (skippedGroups.some((g) => g.key === key)) continue;

      groupsProcessed++;
      const keptId = kept.record.id;

      for (const d of duplicates) {
        const dupId = d.record.id;

        // Re-point RotaAssignment.staff_id
        const dupRotas = rotas.filter((r) => r.staff_id === dupId);
        for (const r of dupRotas) {
          await base44.asServiceRole.entities.RotaAssignment.update(r.id, { staff_id: keptId });
          assignmentsRepointed++;
        }

        // Re-point ComplianceItem.reference_id
        const dupComp = compliance.filter((c) => c.reference_id === dupId);
        for (const c of dupComp) {
          await base44.asServiceRole.entities.ComplianceItem.update(c.id, { reference_id: keptId });
          complianceRepointed++;
        }

        // Re-point Timesheet.staff_id
        const dupTs = timesheets.filter((t) => t.staff_id === dupId);
        for (const t of dupTs) {
          await base44.asServiceRole.entities.Timesheet.update(t.id, { staff_id: keptId });
          timesheetsRepointed++;
        }

        // Delete the duplicate staff record
        await base44.asServiceRole.entities.Staff.delete(dupId);
        recordsDeleted++;

        // Audit log
        await base44.asServiceRole.functions.invoke('logSystemAudit', {
          entity_name: 'Staff',
          entity_id: dupId,
          action: 'delete',
          source: 'manual',
          actor_name: user.full_name || user.email || 'admin',
          record_summary: `Staff dedup: deleted duplicate "${d.record.name}" — re-pointed ${dupRotas.length} rota, ${dupComp.length} compliance, ${dupTs.length} timesheet records to ${keptId}`,
        });
      }
    }

    const message = recordsDeleted === 0
      ? 'No duplicate staff records found. Each person already has one record.'
      : `Processed ${groupsProcessed} duplicate group(s). Deleted ${recordsDeleted} duplicate record(s). Re-pointed ${assignmentsRepointed} rota assignment(s), ${complianceRepointed} compliance item(s), ${timesheetsRepointed} timesheet(s).`;

    return Response.json({
      groupsProcessed,
      recordsDeleted,
      assignmentsRepointed,
      complianceRepointed,
      timesheetsRepointed,
      skippedGroups,
      message,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}