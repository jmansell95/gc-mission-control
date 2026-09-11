// Central access control utility.
// Access is driven by each staff member's assigned Permission Group
// (Staff.permission_group_id). The platform admin flag (User.role === 'admin')
// bypasses everything. All other access decisions flow through the group's
// per-module permissions via resolveModuleLevel.

import { SECTION_TO_MODULE, normalizePermissions, resolveModuleLevel, canWriteModule, canReadModule } from '@/utils/permissions';

// Admin sections visible to each role (fallback for staff without a directly
// assigned permission group). When a permission group IS assigned, these are
// bypassed in favour of the group's per-module permissions.
export const ROLE_SECTIONS = {
  super_admin: ['overview', 'crew-comms', 'jobs', 'rota', 'calendar', 'scheduling', 'logistics', 'timesheets', 'compliance', 'log-qc', 'audit-trail', 'teams', 'billing', 'performance', 'settings', 'ags-import', 'safety', 'safety-hub', 'assets', 'fleet', 'vehicles', 'project-financials', 'staff', 'contacts', 'automations', 'price-list', 'reports', 'import', 'audit', 'investigation'],
  admin: ['overview', 'crew-comms', 'jobs', 'rota', 'calendar', 'scheduling', 'logistics', 'timesheets', 'compliance', 'log-qc', 'audit-trail', 'teams', 'billing', 'performance', 'settings', 'ags-import', 'safety', 'safety-hub', 'assets', 'fleet', 'vehicles', 'project-financials', 'staff', 'contacts', 'automations', 'price-list', 'reports', 'import', 'audit', 'investigation'],
  management: ['overview', 'crew-comms', 'jobs', 'rota', 'calendar', 'scheduling', 'logistics', 'timesheets', 'compliance', 'log-qc', 'audit-trail', 'billing', 'performance', 'safety', 'safety-hub', 'assets', 'fleet', 'vehicles', 'project-financials', 'reports', 'audit', 'staff', 'settings', 'investigation'],
  user: ['overview', 'crew-comms', 'jobs', 'calendar', 'logistics', 'audit-trail', 'audit', 'compliance', 'staff'],
  read_only: ['overview', 'crew-comms', 'jobs', 'calendar', 'logistics', 'audit-trail', 'audit', 'compliance', 'staff'],
};

// Resolve the effective role from profile + platform admin flag.
export function resolveRole(profile, isPlatformAdmin) {
  if (!profile) return null;
  if (isPlatformAdmin || profile.is_admin) return 'super_admin';
  // Directors are enterprise-level admins for access purposes
  if (profile.system_role === 'director') return 'super_admin';
  return profile.system_role || 'field';
}

// Check if a user can access a specific admin section.
export function canAccessSection(profile, sectionId, isPlatformAdmin) {
  // While the profile is still loading, show all standard nav items so the
  // sidebar isn't blank. Items are re-filtered once the profile resolves.
  if (!profile) return true;
  if (isPlatformAdmin || profile.is_admin) return true;

  // The "My Schedule" link is available to all staff
  if (sectionId === 'staff_schedule') return true;

  // Primary: check the staff member's assigned permission group
  const moduleKey = SECTION_TO_MODULE[sectionId];
  if (moduleKey && profile.permission_group) {
    return canReadModule(profile, isPlatformAdmin, moduleKey);
  }

  // Fallback: role-based section lists for staff without a permission group
  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'management' || role === 'user' || role === 'read_only') {
    return (ROLE_SECTIONS[role] || []).includes(sectionId);
  }

  return false;
}

// Check if user has edit permissions (create/update/delete) globally.
export function canEdit(profile, isPlatformAdmin) {
  if (isPlatformAdmin || profile?.is_admin) return true;
  if (profile?.permission_group) {
    // If any module has write access, the user can edit
    return Object.values(normalizePermissions(profile.permission_group.permissions)).some(v => v === 'write');
  }
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'management';
}

// Check if user can edit (create/update/delete) within a specific admin module.
export function canEditModule(profile, isPlatformAdmin, sectionId) {
  if (isPlatformAdmin || profile?.is_admin) return true;

  // Primary: check the staff member's assigned permission group
  const moduleKey = SECTION_TO_MODULE[sectionId];
  if (moduleKey && profile?.permission_group) {
    return canWriteModule(profile, isPlatformAdmin, moduleKey);
  }

  // Fallback: role-based defaults
  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'management') {
    if (moduleKey === 'settings') return false;
    return true;
  }
  if (!moduleKey) return canEdit(profile, isPlatformAdmin);
  return canWriteModule(profile, isPlatformAdmin, moduleKey);
}

// Check if user is authorized to view financial/costing data.
// Fail-open design: costs are visible to ALL office roles (super_admin,
// admin, management, user, read_only) and whenever the profile is
// unresolved (still loading or fetch failed on the published site).
// Costs are only hidden from explicitly field-level users: field staff,
// drivers, and subcontractors — who can't access the admin dashboard
// anyway. This prevents a null system_role or a missing Staff record
// from permanently hiding the Financials tab for legitimate admins.
export function canViewCosts(profile, isPlatformAdmin) {
  if (!profile) return true;
  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'field') return false;
  if (profile.worker_type === 'subcontractor') return false;
  if (profile.worker_type === 'agency') return false;
  return true;
}
// Alias for legacy imports
export { canViewCosts as canViewCostings };

// Check if user is an admin (super_admin or admin role).
export function isAdmin(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'super_admin' || role === 'admin';
}

// Check if a user is a driver (field staff with delivery dashboard enabled).
// Drivers see ONLY the delivery dashboard — nothing else.
export function isDriver(profile, isPlatformAdmin) {
  if (!profile) return false;
  if (isPlatformAdmin) return false;
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'field' && profile.delivery_dashboard_enabled === true;
}

// Check if user is a scanner-only user (logistics scanner app only).
// These users can only access the /scanner page — no admin dashboard,
// no schedule, no settings. They book goods in and scan assets out.
export function isScannerOnly(profile) {
  if (!profile) return false;
  const group = profile.permission_group;
  if (group && group.name === 'Scanner Only') return true;
  const teamGroup = profile?.team?.permission_group;
  if (teamGroup && teamGroup.name === 'Scanner Only') return true;
  return false;
}

// Check if user is field staff (schedule & profile only)
export function isFieldStaff(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'field';
}

// Check if user is office staff (any role that can access the admin dashboard)
export function isOfficeStaff(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role && role !== 'field';
}

// Check if a user can access a specific route path.
export function canAccessRoute(profile, isPlatformAdmin, path) {
  if (isPlatformAdmin) return true;
  if (!profile) return false;

  // Help is available to everyone authenticated
  if (path === '/help') return true;

  // Scanner-only users: scanner page ONLY
  if (isScannerOnly(profile)) {
    return path === '/scanner';
  }

  // Drivers: delivery dashboard ONLY
  if (isDriver(profile)) {
    return path === '/deliveries';
  }

  // Subcontractors: subcontractor portal ONLY
  if (profile.worker_type === 'subcontractor') {
    return path === '/subcontractor';
  }

  const role = resolveRole(profile, isPlatformAdmin);

  // Field staff: staff dashboard + profile + scanner hub
  if (role === 'field') {
    return path === '/staff-schedule' || path === '/staff-profile' || path === '/scanner';
  }

  // All office roles (super_admin, admin, management, user, read_only): full access
  return true;
}

// Resolve landing page based on role.
export function resolveRoleLandingPage(profile, isPlatformAdmin) {
  // Per-staff landing page override (set at creation/edit) takes precedence
  if (profile?.default_landing_page) return profile.default_landing_page;

  // Scanner-only users go straight to the scanner — they see nothing else
  if (isScannerOnly(profile)) return '/scanner';

  // Drivers go straight to the delivery dashboard — they see nothing else
  if (isDriver(profile)) return '/deliveries';

  const role = resolveRole(profile, isPlatformAdmin);

  // Subcontractors get the minimalist logging portal
  if (profile?.worker_type === 'subcontractor') return '/subcontractor';

  // Permission group landing page (office vs field classification).
  // A concrete (non-auto) group landing page routes the user after onboarding.
  // Checked after scanner/driver/subcontractor so those special cases still win.
  const groupLanding = profile?.permission_group?.landing_page;
  if (groupLanding && groupLanding !== 'auto') return groupLanding;

  // Field staff — schedule or profile
  if (role === 'field') {
    const teamLanding = profile?.team?.default_landing_page;
    if (teamLanding === '/staff-schedule' || teamLanding === '/staff-profile') return teamLanding;
    return '/staff-schedule';
  }

  // All office roles land on admin
  return '/admin';
}