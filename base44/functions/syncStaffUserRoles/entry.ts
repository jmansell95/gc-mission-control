import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Every permission module key (mirrors PERMISSION_MODULES in src/utils/permissions.js).
// A group is "admin-level" only when it grants full write access to ALL of them
// (i.e. the built-in Super Admin / Admin groups, or a custom full-access group).
const MODULE_KEYS = [
  'overview', 'jobs', 'rota', 'calendar', 'scheduling', 'timesheets', 'compliance',
  'safety', 'log-qc', 'audit-trail', 'teams', 'staff', 'billing', 'assets',
  'logistics', 'settings', 'ags_import',
];

function isAdminLevelGroup(group) {
  if (!group || group.is_read_only) return false;
  const perms = group.permissions || {};
  return MODULE_KEYS.every((k) => perms[k] === 'write');
}

// Syncs the linked platform User.role (and division_id) for the given staff
// members from their assigned permission group. Admin-level groups (full write
// access to every module) promote the user to platform role 'admin', which is
// what RLS checks for the cross-division admin bypass. All other groups map to
// 'user'. Run after any permission-group assignment so the platform role stays
// in lockstep with the app access level.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedIds = Array.isArray(body.staff_ids) ? body.staff_ids.filter(Boolean) : null;

    const sr = base44.asServiceRole;
    let staffList;
    if (requestedIds && requestedIds.length) {
      staffList = [];
      for (const id of requestedIds) {
        try {
          staffList.push(await sr.entities.Staff.get(id));
        } catch (_) {
          /* skip missing */
        }
      }
    } else {
      staffList = await sr.entities.Staff.list('-created_date', 5000);
    }

    const groups = await sr.entities.PermissionGroup.list('-created_date', 200);
    const groupMap = {};
    for (const g of groups) groupMap[g.id] = g;

    const results = [];
    for (const s of staffList) {
      if (!s.user_id) {
        results.push({ staff_id: s.id, skipped: 'no linked user' });
        continue;
      }
      const group = s.permission_group_id ? groupMap[s.permission_group_id] : null;
      const targetRole = isAdminLevelGroup(group) ? 'admin' : 'user';

      let u;
      try {
        u = await sr.entities.User.get(s.user_id);
      } catch (_) {
        results.push({ staff_id: s.id, skipped: 'user not found' });
        continue;
      }

      const updates = {};
      if (u.role !== targetRole) updates.role = targetRole;
      if (s.division_id && u.division_id !== s.division_id) updates.division_id = s.division_id;

      if (Object.keys(updates).length === 0) {
        results.push({ staff_id: s.id, user_id: s.user_id, role: targetRole, changed: false });
        continue;
      }
      try {
        await sr.entities.User.update(s.user_id, updates);
        results.push({ staff_id: s.id, user_id: s.user_id, role: targetRole, changed: true, updates: Object.keys(updates) });
      } catch (e) {
        results.push({ staff_id: s.id, error: e.message });
      }
    }

    return Response.json({
      synced: results.length,
      changed: results.filter((r) => r.changed).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}