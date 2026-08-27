import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * migrateCrews — one-time migration that converts the legacy single-pair
 * Lead Driller / Second Man text fields on subcontractor Staff records into
 * the new DrillingCrew grouping structure.
 *
 * For each Staff record with worker_type='subcontractor' and
 * lead_driller_name or second_man_name set:
 *   1. Creates individual Staff records for the named drillers (worker_type
 *      'subcontractor', crew_parent_id pointing to the parent), if they
 *      don't already exist.
 *   2. Creates a DrillingCrew grouping linking the Lead Driller and Second Man
 *      to the parent subcontractor.
 *   3. Clears the legacy lead_driller_name/phone and second_man_name/phone
 *      fields on the parent subcontractor record.
 *
 * Idempotent: re-running is safe — skips Staff records that have already been
 * migrated (legacy fields already cleared) and deduplicates by driller name
 * within the same parent.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Fetch all subcontractor Staff records
    const allSubs = await base44.asServiceRole.entities.Staff.filter(
      { worker_type: 'subcontractor' },
      'name',
      500
    );

    // Only migrate records that still have legacy lead/second man fields set
    const toMigrate = allSubs.filter(
      s => s.lead_driller_name || s.second_man_name
    );

    const stats = { scanned: allSubs.length, migrated: 0, crews_created: 0, drillers_created: 0, skipped: 0 };
    const errors = [];

    for (const parent of toMigrate) {
      try {
        const leadName = parent.lead_driller_name?.trim();
        const secondName = parent.second_man_name?.trim();
        const leadPhone = parent.lead_driller_phone?.trim() || null;
        const secondPhone = parent.second_man_phone?.trim() || null;
        const divisionId = parent.division_id || '';

        let leadStaffId = null;
        let secondStaffId = null;

        // Check for existing individual driller Staff records under this parent
        const existingDrillers = await base44.asServiceRole.entities.Staff.filter(
          { crew_parent_id: parent.id },
          'name',
          100
        );

        // Find or create Lead Driller
        if (leadName) {
          const existing = existingDrillers.find(
            d => d.name?.toLowerCase() === leadName.toLowerCase()
          );
          if (existing) {
            leadStaffId = existing.id;
          } else {
            const created = await base44.asServiceRole.entities.Staff.create({
              name: leadName,
              worker_type: 'subcontractor',
              company: parent.company || parent.name || '',
              crew_parent_id: parent.id,
              division_id: divisionId,
              phone: leadPhone,
              is_active: true,
              job_title: 'Lead Driller',
            });
            leadStaffId = created.id;
            stats.drillers_created++;
          }
        }

        // Find or create Second Man
        if (secondName) {
          const existing = existingDrillers.find(
            d => d.name?.toLowerCase() === secondName.toLowerCase()
          );
          if (existing) {
            secondStaffId = existing.id;
          } else {
            const created = await base44.asServiceRole.entities.Staff.create({
              name: secondName,
              worker_type: 'subcontractor',
              company: parent.company || parent.name || '',
              crew_parent_id: parent.id,
              division_id: divisionId,
              phone: secondPhone,
              is_active: true,
              job_title: 'Second Man Driller',
            });
            secondStaffId = created.id;
            stats.drillers_created++;
          }
        }

        // Create the DrillingCrew grouping
        const crewName = `${leadName || 'Unknown'}${secondName ? ` + ${secondName}` : ''}`;
        await base44.asServiceRole.entities.DrillingCrew.create({
          name: crewName,
          lead_driller_staff_id: leadStaffId,
          second_man_staff_id: secondStaffId,
          parent_staff_id: parent.id,
          division_id: divisionId,
          is_active: true,
          lead_driller_name: leadName || '',
          lead_driller_phone: leadPhone || '',
          second_man_name: secondName || '',
          second_man_phone: secondPhone || '',
        });
        stats.crews_created++;

        // Clear the legacy fields on the parent subcontractor record
        await base44.asServiceRole.entities.Staff.update(parent.id, {
          lead_driller_name: null,
          lead_driller_phone: null,
          second_man_name: null,
          second_man_phone: null,
        });

        stats.migrated++;
      } catch (err) {
        errors.push({ staff_id: parent.id, name: parent.name, error: err.message });
      }
    }

    stats.skipped = toMigrate.length - stats.migrated;

    return Response.json({
      success: true,
      message: `Migration complete. ${stats.migrated} subcontractor(s) migrated, ${stats.crews_created} crew(s) created, ${stats.drillers_created} driller(s) created.`,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}