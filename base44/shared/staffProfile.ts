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
  // Server-side filter by user_id — faster and avoids loading the entire
  // Staff table. Falls back to email match if no user_id match is found.
  let staff: any[] = [];
  try {
    if (user.id) {
      staff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
    }
    if (staff.length === 0 && user.email) {
      const lc = user.email.toLowerCase();
      const byEmail = await base44.asServiceRole.entities.Staff.filter({ email: user.email });
      // filter() may be case-sensitive on some backends — double-check client-side
      staff = byEmail.filter((s) => s.email && s.email.toLowerCase() === lc);
    }
  } catch {
    // If the filter fails (transient DB issue), fall through to the
    // synthetic profile below so the app still loads instead of 500-ing.
  }

  const isAdmin = user.role === 'admin';

  // Deduplication guard: if multiple Staff records exist for the same
  // user_id (caused by a race condition in the old list+filter approach),
  // keep the oldest one and delete the rest before proceeding. This runs
  // on every login so duplicates are self-healing.
  if (staff.length > 1 && user.id) {
    const sorted = [...staff].sort((a, b) =>
      String(a.created_date || '').localeCompare(String(b.created_date || ''))
    );
    const kept = sorted[0];
    const extras = sorted.slice(1);
    for (const dup of extras) {
      try {
        await base44.asServiceRole.entities.Staff.delete(dup.id);
      } catch (_) {
        // best-effort — don't fail the profile resolution
      }
    }
    staff = [kept];
  }

  // Auto-provision: no matching Staff record → create a minimal one.
  if (staff.length === 0) {
    let defaultTeamId = '';
    let defaultTeamDivisionId = null;
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
        const defaultTeam = teams.find((t) => t.category === 'field_ops') || teams[0];
        defaultTeamId = defaultTeam.id;
        defaultTeamDivisionId = defaultTeam.division_id || null;
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
        division_id: defaultTeamDivisionId,
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
      onboarding_complete: false,
    };
  }

  const s = staff[0];

  // Auto-link: if this Staff record was matched by email but has no user_id
  // yet (e.g. an invited staff member just registered and logged in), link
  // their platform user_id now. This triggers the "Welcome Email on
  // Registration" entity automation so the branded welcome email is sent.
  if (!s.user_id && user.id) {
    try {
      await base44.asServiceRole.entities.Staff.update(s.id, { user_id: user.id });
      s.user_id = user.id;
    } catch (_) {
      // best-effort — profile still resolves without the link
    }
  }

  // Team lookup
  let team = null;
  if (s.team_id) {
    try {
      const teamList = await base44.asServiceRole.entities.Team.filter({ id: s.team_id });
      team = teamList[0] || null;
    } catch (_) {}
  }

  // Sync division_id from the team's division so RLS rules resolve correctly.
  // The Staff record carries a denormalized division_id cache (used by RLS
  // rules that reference data.division_id), and the User record carries its
  // own division_id for user-scoped RLS. Both must stay in sync with the team.
  // This runs on every login so a staff member moved to a new team is picked
  // up immediately — and so auto-provisioned records that started with null
  // division_id are repaired on first login.
  if (team?.division_id) {
    if (user.id && user.division_id !== team.division_id) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { division_id: team.division_id });
      } catch (_) {}
    }
    if (s.division_id !== team.division_id) {
      try {
        await base44.asServiceRole.entities.Staff.update(s.id, { division_id: team.division_id });
        s.division_id = team.division_id;
      } catch (_) {}
    }
  }

  // Direct permission group
  let directPermissionGroup = null;
  if (s.permission_group_id) {
    try {
      const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: s.permission_group_id });
      directPermissionGroup = pgList[0] || null;
    } catch (_) {}
  }

  const effectivePermissionGroup = directPermissionGroup;

  const GROUP_NAME_TO_ROLE = {
    'Super Admin': 'super_admin',
    'Admin': 'super_admin', // legacy — merged into Super Admin
    'Management': 'management',
    'Users': 'user',
    'User': 'user', // legacy
    'Field Team': 'field',
    'Field Staff': 'field', // legacy
    'Field': 'field',
    'Read Only': 'read_only',
  };
  // When no permission group is assigned, infer the role from the team
  // category so office staff (management teams) aren't misclassified as
  // field staff. 'management' → office role; depot/field_ops/no team → field.
  const derivedRole = effectivePermissionGroup
    ? (GROUP_NAME_TO_ROLE[effectivePermissionGroup.name] || s.system_role || 'field')
    : (team?.category === 'management' ? 'management' : (s.system_role || 'field'));

  return {
    id: s.id,
    name: s.name,
    email: s.email,
    avatar_url: s.avatar_url || null,
    division_id: team?.division_id || null,
    default_landing_page: s.default_landing_page || null,
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
          permission_group_id: null,
          permission_group: null,
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
    onboarding_complete: s.onboarding_complete === true,
    // Tracking & GPS fields
    tracking_enabled: s.tracking_enabled !== false,
    phone_gps_consent: s.phone_gps_consent === true,
    tracking_consent_signed_at: s.tracking_consent_signed_at || null,
    tracking_consent_declined_at: s.tracking_consent_declined_at || null,
    home_lat: s.home_lat ?? null,
    home_lng: s.home_lng ?? null,
    job_title: s.job_title || null,
    manager_id: s.manager_id || null,
  };
}