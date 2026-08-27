// Central permission registry — the single source of truth for which admin
// modules exist and their access levels. Used by the PermissionGroupManager
// UI and by access.js to resolve what a team can see / do.
//
// Access levels per module:
//   'none'  — module is hidden from this group entirely
//   'read'  — module visible, all create/update/delete/upload disabled
//   'write' — full create / update / delete access

export const ACCESS_LEVELS = [
  { value: 'none', label: 'No Access', color: 'slate' },
  { value: 'read', label: 'Read Only', color: 'amber' },
  { value: 'write', label: 'Full Access', color: 'emerald' },
];

export const PERMISSION_MODULES = [
  { key: 'overview', label: 'Dashboard Overview', icon: 'LayoutGrid', sensitive: false },
  { key: 'jobs', label: 'Jobs', icon: 'Briefcase', sensitive: false },
  { key: 'rota', label: 'Rota Builder', icon: 'CalendarDays', sensitive: true },
  { key: 'calendar', label: 'Calendar', icon: 'Calendar', sensitive: false },
  { key: 'scheduling', label: 'Scheduling', icon: 'CalendarClock', sensitive: true },
  { key: 'timesheets', label: 'Timesheets', icon: 'Clock', sensitive: true },
  { key: 'compliance', label: 'Compliance', icon: 'ShieldCheck', sensitive: true },
  { key: 'safety', label: 'Safety Hub', icon: 'ShieldAlert', sensitive: true },
  { key: 'log-qc', label: 'Log QC', icon: 'FlaskConical', sensitive: true },
  { key: 'audit-trail', label: 'Audit Trail', icon: 'ClipboardCheck', sensitive: false },
  { key: 'teams', label: 'Crew Types', icon: 'Users', sensitive: true },
  { key: 'staff', label: 'Staff Management', icon: 'Users', sensitive: true },
  { key: 'billing', label: 'Billing & Financials', icon: 'Banknote', sensitive: true },
  { key: 'assets', label: 'Assets Hub & Fleet Hub', icon: 'Boxes', sensitive: false },
  { key: 'logistics', label: 'Logistics & Deliveries', icon: 'Truck', sensitive: false },
  { key: 'settings', label: 'Settings', icon: 'Settings', sensitive: true },
  { key: 'ags_import', label: 'AGS / KeyLogBook Upload', icon: 'FileUp', sensitive: true },
];

// Map admin dashboard section ids (from ROLE_SECTIONS / AdminNav) to permission
// module keys, so access.js can check a section against the group.
export const SECTION_TO_MODULE = {
  overview: 'overview',
  jobs: 'jobs',
  rota: 'rota',
  calendar: 'calendar',
  scheduling: 'scheduling',
  timesheets: 'timesheets',
  compliance: 'compliance',
  safety: 'safety',
  'safety-hub': 'safety',
  'log-qc': 'log-qc',
  'audit-trail': 'audit-trail',
  teams: 'teams',
  staff: 'staff',
  billing: 'billing',
  'project-financials': 'billing',
  assets: 'assets',
  fleet: 'assets',
  vehicles: 'assets',
  logistics: 'logistics',
  settings: 'settings',
  'ags-import': 'ags_import',
  contacts: 'settings',
  automations: 'settings',
  'price-list': 'billing',
  reports: 'billing',
  import: 'settings',
  audit: 'audit-trail',
  'access-levels': 'settings',
  performance: 'billing',
  investigation: 'jobs',
};

// Build a default permissions object (all modules = 'none').
export function defaultPermissions() {
  const p = {};
  PERMISSION_MODULES.forEach(m => { p[m.key] = 'none'; });
  return p;
}

// Normalise a stored permissions object so every module key exists.
export function normalizePermissions(p) {
  const out = defaultPermissions();
  if (p && typeof p === 'object') {
    PERMISSION_MODULES.forEach(m => {
      const v = p[m.key];
      if (v === 'none' || v === 'read' || v === 'write') out[m.key] = v;
    });
  }
  return out;
}

// Built-in system groups, seeded on first load and protected from deletion.
// Each staff member is assigned to a group via Staff.permission_group_id;
// the group's per-module permissions are the single source of truth for access.
export const SYSTEM_GROUPS = [
  {
    name: 'Super Admin',
    description: 'Unrestricted access to every module. Use for trusted leadership only.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'write'])),
  },
  {
    name: 'Admin',
    description: 'Full dashboard access including settings and crew types.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'write'])),
  },
  {
    name: 'Management',
    description: 'Operations access — jobs, rotas, timesheets, compliance. No settings or crew types.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, ['settings', 'teams'].includes(m.key) ? 'none' : 'write'])
    ),
  },
  {
    name: 'User',
    description: 'Basic office access — read-only view of dashboards, jobs and calendar.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, ['overview', 'jobs', 'calendar', 'audit-trail'].includes(m.key) ? 'read' : 'none'])
    ),
  },
  {
    name: 'Field Staff',
    description: 'Field crew — schedule and personal profile only. No admin dashboard access. Assign to all on-site workers.',
    is_system: true,
    is_read_only: false,
    staff_type: 'field',
    landing_page: '/staff-schedule',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'none'])),
  },
  {
    name: 'Read Only',
    description: 'Strict read-only lockdown — can view dashboards but cannot create, edit, upload or delete anything.',
    is_system: true,
    is_read_only: true,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, m.sensitive ? 'none' : 'read'])
    ),
  },
  {
    name: 'Scanner Only',
    description: 'Logistics scanner only — can access the Asset Scanner / Goods In page and nothing else. Use for warehouse staff and depot hands who only need to scan items in and out. No admin dashboard, no schedule, no settings.',
    is_system: true,
    is_read_only: false,
    staff_type: 'field',
    landing_page: '/scanner',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'none'])),
  },
];

// Resolve the effective access level for a module given a profile + platform flag.
// Returns 'none' | 'read' | 'write'.
// The staff member's assigned permission group is the primary source of truth.
export function resolveModuleLevel(profile, isPlatformAdmin, moduleKey) {
  if (isPlatformAdmin) return 'write';
  if (!profile) return 'none';

  // Primary: the staff member's directly-assigned permission group
  if (profile.permission_group) {
    const group = profile.permission_group;
    if (group.is_read_only) {
      const level = normalizePermissions(group.permissions)[moduleKey];
      return level === 'none' ? 'none' : 'read';
    }
    return normalizePermissions(group.permissions)[moduleKey] || 'none';
  }

  // Fallback: the team's permission group (for staff not yet assigned directly)
  const teamGroup = profile?.team?.permission_group;
  if (teamGroup) {
    if (teamGroup.is_read_only) {
      const level = normalizePermissions(teamGroup.permissions)[moduleKey];
      return level === 'none' ? 'none' : 'read';
    }
    return normalizePermissions(teamGroup.permissions)[moduleKey] || 'none';
  }

  // Last resort: role-based defaults (derived from group name by getMyStaffProfile)
  const role = (isPlatformAdmin || profile.is_admin) ? 'super_admin' : (profile.system_role || 'field');
  if (role === 'super_admin' || role === 'admin') return 'write';
  if (role === 'management') return ['settings', 'teams'].includes(moduleKey) ? 'none' : 'write';
  if (role === 'user') return ['overview', 'jobs', 'calendar', 'audit-trail'].includes(moduleKey) ? 'read' : 'none';
  if (role === 'read_only') {
    const sensitive = PERMISSION_MODULES.find(m => m.key === moduleKey)?.sensitive;
    return sensitive ? 'none' : 'read';
  }
  return 'none';
}

// Can the user write (create/update/delete) in this module?
export function canWriteModule(profile, isPlatformAdmin, moduleKey) {
  return resolveModuleLevel(profile, isPlatformAdmin, moduleKey) === 'write';
}

// Can the user at least read this module?
export function canReadModule(profile, isPlatformAdmin, moduleKey) {
  return resolveModuleLevel(profile, isPlatformAdmin, moduleKey) !== 'none';
}