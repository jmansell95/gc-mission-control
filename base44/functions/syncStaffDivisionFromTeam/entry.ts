import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * syncStaffDivisionFromTeam — one-time backfill migration.
 *
 * Consolidates the division/permission-group/landing-page model so each has a
 * single source of truth:
 *  - Division: inherited from the team (Team.division_id). Staff.division_id is
 *    auto-synced as a denormalized cache for RLS, and User.division_id is synced
 *    so RLS rules that reference {{user.data.division_id}} resolve correctly.
 *  - Permission group: Staff.permission_group_id only (no longer inherited from team).
 *  - Landing page: Staff.default_landing_page (new per-staff field).
 *
 * This function:
 *  1. Syncs Staff.division_id from each staff member's team division (RLS cache).
 *  2. Syncs User.division_id for every linked user from their staff team's division.
 *  3. Sets Staff.default_landing_page from the current resolved landing for any
 *     staff member who doesn't have one yet (so no one loses their current landing).
 *
 * Admin-only. Run once after deploying the schema + buildMyProfile changes.
 */

const GROUP_NAME_TO_ROLE = {
  'Super Admin': 'super_admin',
  'Admin': 'admin',
  'Management': 'management',
  'User': 'user',
  'Field Staff': 'field',
  'Field': 'field',
  'Read Only': 'read_only',
};

function resolveLandingPage(s, team, permissionGroup) {
  // Mirror resolveRoleLandingPage logic for backfill
  if (s.default_landing_page) return s.default_landing_page;
  if (permissionGroup?.name === 'Scanner Only') return '/scanner';
  const role = permissionGroup
    ? (GROUP_NAME_TO_ROLE[permissionGroup.name] || s.system_role || 'field')
    : (team?.category === 'management' ? 'management' : (s.system_role || 'field'));
  if (s.worker_type === 'subcontractor') return '/subcontractor';
  if (s.delivery_dashboard_enabled && role === 'field') return '/deliveries';
  if (role === 'field') {
    const teamLanding = team?.default_landing_page;
    if (teamLanding === '/staff-schedule' || teamLanding === '/staff-profile') return teamLanding;
    return '/staff-schedule';
  }
  return '/admin';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const [allStaff, allTeams, allPermissionGroups] = await Promise.all([
      base44.asServiceRole.entities.Staff.list('-created_date', 500),
      base44.asServiceRole.entities.Team.list(undefined, 500),
      base44.asServiceRole.entities.PermissionGroup.list('name', 200),
    ]);

    const teamMap = new Map(allTeams.map(t => [t.id, t]));
    const pgMap = new Map(allPermissionGroups.map(pg => [pg.id, pg]));

    let staffDivisionSynced = 0;
    let userDivisionSynced = 0;
    let landingPageSet = 0;
    const errors: string[] = [];

    for (const s of allStaff) {
      const team = s.team_id ? teamMap.get(s.team_id) : null;
      const teamDivisionId = team?.division_id || null;
      const pg = s.permission_group_id ? pgMap.get(s.permission_group_id) : null;

      // 1. Sync Staff.division_id from team (RLS cache)
      if (teamDivisionId && s.division_id !== teamDivisionId) {
        try {
          await base44.asServiceRole.entities.Staff.update(s.id, { division_id: teamDivisionId });
          staffDivisionSynced++;
        } catch (e) {
          errors.push(`Staff ${s.name}: ${e.message}`);
        }
      }

      // 2. Sync User.division_id from team
      if (teamDivisionId && s.user_id) {
        try {
          const users = await base44.asServiceRole.entities.User.filter({ id: s.user_id });
          const linkedUser = users[0];
          if (linkedUser && linkedUser.division_id !== teamDivisionId) {
            await base44.asServiceRole.entities.User.update(linkedUser.id, { division_id: teamDivisionId });
            userDivisionSynced++;
          }
        } catch (e) {
          errors.push(`User ${s.user_id}: ${e.message}`);
        }
      }

      // 3. Set Staff.default_landing_page if not already set
      if (!s.default_landing_page) {
        const landing = resolveLandingPage(s, team, pg);
        if (landing) {
          try {
            await base44.asServiceRole.entities.Staff.update(s.id, { default_landing_page: landing });
            landingPageSet++;
          } catch (e) {
            errors.push(`Landing ${s.name}: ${e.message}`);
          }
        }
      }
    }

    return Response.json({
      total_staff: allStaff.length,
      staff_division_synced: staffDivisionSynced,
      user_division_synced: userDivisionSynced,
      landing_pages_set: landingPageSet,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}