/**
 * Shared crew-profile resolver + auto-provisioner.
 *
 * Used by both `getMyStaffProfile` (called on every login) and
 * `ensureMyStaffProfile` (explicit "create my profile" button). Guarantees
 * every authenticated platform user has a linked Staff record — if none
 * matches by user_id or email, a minimal crew profile is created via the
 * service role so RLS never blocks a user from getting their own profile.
 */
export async function buildMyProfile(base44, user) {
  const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);

  // Match by user_id first, then case-insensitive email.
  let staff = [];
  if (user.id) {
    staff = allStaff.filter((s) => s.user_id && s.user_id === user.id);
  }
  if (staff.length === 0 && user.email) {
    const lc = user.email.toLowerCase();
    staff = allStaff.filter((s) => s.email && s.email.toLowerCase() === lc);
  }

  const isAdmin = user.role === 'admin';

  // Auto-provision: no matching Staff record → create a minimal one.
  if (staff.length === 0) {
    let defaultTeamId = '';
    try {
      const teams = await base44.asServiceRole.entities.Team.list();
      if (teams.length === 0) {
        // No teams exist yet — create a default field-ops team so the
        // required team_id field on Staff is satisfied.
        const t = await base44.asServiceRole.entities.Team.create({
          name: 'Unassigned Crew',
          category: 'field_ops',
          default_landing_page: '/staff-schedule',
        });
        defaultTeamId = t.id;
      } else {
        defaultTeamId = (teams.find((t) => t.category === 'field_ops') || teams[0]).id;
      }
    } catch (_) {
      // team resolution is best-effort; create with blank team if it fails
    }

    try {
      const created = await base44.asServiceRole.entities.Staff.create({
        name: user.full_name || user.email,
        email: user.email,
        user_id: user.id,
        worker_type: 'direct_employee',
        team_id: defaultTeamId,
        is_active: true,
        system_role: isAdmin ? 'admin' : 'field',
      });
      staff = [created];
    } catch (_) {
      // create failed (e.g. validation) — fall through to synthetic below
    }
  }

  // Still no record → return the legacy synthetic profile so the app keeps
  // working instead of crashing.
  if (staff.length === 0) {
    return {
      id: null,
      name: user.full_name || user.email,
      email: user.email,
      avatar_url: null,
      job_role: null,
      worker_type: null,
      team_id: null,
      team: null,
      is_admin: isAdmin,
      no_staff_profile: true,
      division_id: null,
      email_notifications_enabled: true,
      delivery_dashboard_enabled: isAdmin,
      system_role: isAdmin ? 'super_admin' : 'user',
      last_acknowledged_week: null,
    };
  }

  const s = staff[0];

  // Team lookup
  let team = null;
  if (s.team_id) {
    try {
      const teamList = await base44.asServiceRole.entities.Team.filter({ id: s.team_id });
      team = teamList[0] || null;
    } catch (_) {}
  }

  // Direct permission group
  let directPermissionGroup = null;
  if (s.permission_group_id) {
    try {
      const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: s.permission_group_id });
      directPermissionGroup = pgList[0] || null;
    } catch (_) {}
  }

  // Team's permission group (fallback)
  let teamPermissionGroup = null;
  if (team?.permission_group_id) {
    try {
      const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: team.permission_group_id });
      teamPermissionGroup = pgList[0] || null;
    } catch (_) {}
  }

  const effectivePermissionGroup = directPermissionGroup || teamPermissionGroup;

  const GROUP_NAME_TO_ROLE = {
    'Super Admin': 'super_admin',
    'Admin': 'admin',
    'Management': 'management',
    'User': 'user',
    'Field Staff': 'field',
    'Field': 'field',
    'Read Only': 'read_only',
  };
  const derivedRole = effectivePermissionGroup
    ? (GROUP_NAME_TO_ROLE[effectivePermissionGroup.name] || s.system_role || 'field')
    : (s.system_role || 'field');

  return {
    id: s.id,
    name: s.name,
    email: s.email,
    avatar_url: s.avatar_url || null,
    division_id: s.division_id || null,
    job_role: s.job_role,
    worker_type: s.worker_type,
    team_id: s.team_id,
    team: team
      ? {
          id: team.id,
          name: team.name,
          category: team.category || null,
          job_type: team.job_type || null,
          default_landing_page: team.default_landing_page || null,
          allowed_tool_access: team.allowed_tool_access || [],
          permission_group_id: team.permission_group_id || null,
          permission_group: teamPermissionGroup
            ? {
                id: teamPermissionGroup.id,
                name: teamPermissionGroup.name,
                is_read_only: teamPermissionGroup.is_read_only === true,
                is_system: teamPermissionGroup.is_system === true,
                permissions: teamPermissionGroup.permissions || {},
              }
            : null,
        }
      : null,
    is_admin: isAdmin,
    email_notifications_enabled: s.email_notifications_enabled !== false,
    delivery_dashboard_enabled: s.delivery_dashboard_enabled === true,
    system_role: derivedRole,
    permission_group: effectivePermissionGroup
      ? {
          id: effectivePermissionGroup.id,
          name: effectivePermissionGroup.name,
          is_read_only: effectivePermissionGroup.is_read_only === true,
          is_system: effectivePermissionGroup.is_system === true,
          permissions: effectivePermissionGroup.permissions || {},
        }
      : null,
    last_acknowledged_week: s.last_acknowledged_week || null,
  };
}