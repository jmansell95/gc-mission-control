import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// One-time cleanup: delete duplicate RotaAssignment records so each non-driver
// staff member has at most one assignment per day. Keeps the earliest-created
// assignment in each duplicate group; driver staff (who do multiple drops/day)
// are exempt — all their assignments are kept.

const DRIVER_KEYWORDS = ['driver', 'delivery'];

function isDriver(staffId, staffMap, driverStaffIds, teamsMap) {
  if (!staffId) return false;
  if (driverStaffIds.has(staffId)) return true;
  const member = staffMap.get(staffId);
  if (!member || !member.team_id) return false;
  const team = teamsMap.get(member.team_id);
  if (!team) return false;
  const name = (team.name || '').toLowerCase();
  return DRIVER_KEYWORDS.some((kw) => name.includes(kw));
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Fetch all assignments, staff, teams, and deliveries to identify drivers.
    const [rotas, staff, teams, deliveries] = await Promise.all([
      base44.asServiceRole.entities.RotaAssignment.list(),
      base44.asServiceRole.entities.Staff.list(),
      base44.asServiceRole.entities.Team.list(),
      base44.asServiceRole.entities.DeliveryLog.list(),
    ]);

    const staffMap = new Map(staff.map((s) => [s.id, s]));
    const teamsMap = new Map(teams.map((t) => [t.id, t]));
    const driverStaffIds = new Set();
    deliveries.forEach((d) => {
      if (d.driver_staff_id) driverStaffIds.add(d.driver_staff_id);
    });

    // Group assignments by staff_id + assigned_date.
    const groups = {};
    rotas.forEach((r) => {
      if (!r.staff_id || !r.assigned_date) return;
      const key = r.staff_id + '|' + r.assigned_date;
      (groups[key] = groups[key] || []).push(r);
    });

    // For each group with >1, if the staff is NOT a driver, delete all but the
    // earliest-created record. Sort by created_date ascending, keep index 0.
    const toDelete = [];
    let duplicateGroups = 0;
    let driverGroupsSkipped = 0;
    Object.entries(groups).forEach(([key, arr]) => {
      if (arr.length <= 1) return;
      const staffId = arr[0].staff_id;
      if (isDriver(staffId, staffMap, driverStaffIds, teamsMap)) {
        driverGroupsSkipped++;
        return;
      }
      duplicateGroups++;
      arr.sort((a, b) => {
        const ad = a.created_date || a.id || '';
        const bd = b.created_date || b.id || '';
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
      // Keep the first, queue the rest for deletion.
      for (let i = 1; i < arr.length; i++) toDelete.push(arr[i].id);
    });

    if (toDelete.length === 0) {
      return Response.json({
        deleted: 0,
        duplicateGroups: 0,
        driverGroupsSkipped,
        message: 'No duplicate assignments found. Every staff member already has at most one shift per day.',
      });
    }

    // Delete in batches to stay within bulk limits.
    const BATCH = 100;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH);
      await base44.asServiceRole.entities.RotaAssignment.deleteMany({ id: { $in: batch } });
      deleted += batch.length;
    }

    return Response.json({
      deleted,
      duplicateGroups,
      driverGroupsSkipped,
      message: `Deleted ${deleted} duplicate assignment${deleted === 1 ? '' : 's'} across ${duplicateGroups} staff-day group${duplicateGroups === 1 ? '' : 's'}. ${driverGroupsSkipped} driver group${driverGroupsSkipped === 1 ? '' : 's'} kept (drivers exempt).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}