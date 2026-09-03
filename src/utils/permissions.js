// Central permission registry — the single source of truth for which admin
// hubs exist and their access levels. The 12 modules below map 1:1 to the
// top-level navigation hubs visible in the admin sidebar.
//
// Access levels per module:
//   'none'  — hub is hidden from this group entirely
//   'read'  — hub visible, all create/update/delete/upload disabled
//   'write' — full create / update / delete access

export const ACCESS_LEVELS = [
  { value: 'none', label: 'No Access', color: 'slate' },
  { value: 'read', label: 'Read Only', color: 'amber' },
  { value: 'write', label: 'Full Access', color: 'emerald' },
];

// Permission modules — matches the actual hub structure visible in the admin
// sidebar (AdminNav.jsx). Each module maps 1:1 to a top-level navigation hub.
export const PERMISSION_MODULES = [
  { key: 'overview', label: 'Dashboard', icon: 'LayoutGrid', sensitive: false },
  { key: 'jobs', label: 'Projects Hub', icon: 'Briefcase', sensitive: false },
  { key: 'scheduling', label: 'Scheduling Hub', icon: 'CalendarClock', sensitive: true },
  { key: 'staff', label: 'Staff Hub', icon: 'Users', sensitive: true },
  { key: 'logistics', label: 'Logistics Hub', icon: 'Truck', sensitive: false },
  { key: 'assets', label: 'Assets Hub', icon: 'Boxes', sensitive: false },
  { key: 'fleet', label: 'Fleet Hub', icon: 'Car', sensitive: false },
  { key: 'investigation', label: 'Investigation Hub', icon: 'FlaskConical', sensitive: false },
  { key: 'compliance', label: 'Compliance Hub', icon: 'ShieldCheck', sensitive: true },
  { key: 'billing', label: 'Financial Hub', icon: 'PoundSterling', sensitive: true },
  { key: 'reports', label: 'Reports Hub', icon: 'FileBarChart', sensitive: false },
  { key: 'settings', label: 'Settings', icon: 'Settings', sensitive: true },
];

// Map admin dashboard section ids (from ROLE_SECTIONS / AdminNav) to permission
// module keys, so access.js can check a section against the group. Sub-sections
// that were previously separate modules (rota, calendar, timesheets, safety,
// log-qc, audit-trail, teams, ags_import) are now mapped to their parent hub.
export const SECTION_TO_MODULE = {
  overview: 'overview',
  jobs: 'jobs',
  investigation: 'investigation',
  scheduling: 'scheduling',
  rota: 'scheduling',
  calendar: 'scheduling',
  staff: 'staff',
  teams: 'staff',
  timesheets: 'staff',
  logistics: 'logistics',
  assets: 'assets',
  fleet: 'fleet',
  vehicles: 'fleet',
  compliance: 'compliance',
  safety: 'compliance',
  'safety-hub': 'compliance',
  'log-qc': 'investigation',
  'audit-trail': 'compliance',
  audit: 'compliance',
  billing: 'billing',
  'project-financials': 'billing',
  performance: 'billing',
  'price-list': 'billing',
  reports: 'reports',
  settings: 'settings',
  'ags-import': 'settings',
  'ags_import': 'settings',
  contacts: 'settings',
  automations: 'settings',
  import: 'settings',
  'access-levels': 'settings',
};

// Migration map: old sub-module key → new hub-level key. Used by
// normalizePermissions to migrate existing PermissionGroup records that still
// have the old granular sub-module keys to the new hub-level module keys.
const MODULE_MIGRATION = {
  rota: 'scheduling',
  calendar: 'scheduling',
  timesheets: 'staff',
  teams: 'staff',
  safety: 'compliance',
  'log-qc': 'investigation',
  'audit-trail': 'compliance',
  ags_import: 'settings',
};

// Split modules: old parent module → new child module that was split out into
// its own hub. When migrating, if the child module is still 'none', it inherits
// the parent's level so existing groups don't lose access to hubs that were
// previously part of a larger module (e.g. Investigation Hub was part of Jobs).
const MODULE_SPLIT_MIGRATION = {
  jobs: 'investigation',
  assets: 'fleet',
  billing: 'reports',
};

// Build a default permissions object (all modules = 'none').
export function defaultPermissions() {
  const p = {};
  PERMISSION_MODULES.forEach(m => { p[m.key] = 'none'; });
  return p;
}

// Normalise a stored permissions object so every module key exists.
// Migrates old sub-module keys to their new hub-level equivalents, taking
// the highest access level when multiple old keys map to the same new key.
export function normalizePermissions(p) {
  const out = defaultPermissions();
  if (p && typeof p === 'object') {
    const order = { none: 0, read: 1, write: 2 };
    // Set valid new keys directly
    PERMISSION_MODULES.forEach(m => {
      const v = p[m.key];
      if (v === 'none' || v === 'read' || v === 'write') out[m.key] = v;
    });
    // Migrate old keys, taking the highest access level
    for (const [oldKey, newKey] of Object.entries(MODULE_MIGRATION)) {
      const v = p[oldKey];
      if (v === 'none' || v === 'read' || v === 'write') {
        if (order[v] > order[out[newKey]]) out[newKey] = v;
      }
    }
    // Split migration: if a child module is still 'none', inherit from parent
    for (const [parentKey, childKey] of Object.entries(MODULE_SPLIT_MIGRATION)) {
      if (out[childKey] === 'none') {
        const v = p[parentKey];
        if (v === 'none' || v === 'read' || v === 'write') {
          out[childKey] = v;
        }
      }
    }
  }
  return out;
}

// Built-in system groups, seeded on first load and protected from deletion.
// Each staff member is assigned to a group via Staff.permission_group_id;
// the group's per-module permissions are the single source of truth for access.
export const SYSTEM_GROUPS = [
  {
    name: 'Super Admin',
    description: 'Unrestricted access to every hub. Use for trusted leadership only.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'write'])),
  },
  {
    name: 'Admin',
    description: 'Full dashboard access including settings and all hubs.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'write'])),
  },
  {
    name: 'Management',
    description: 'Operations access — all hubs except Settings. Can manage projects, rotas, staff, compliance and financials.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, m.key === 'settings' ? 'none' : 'write'])
    ),
  },
  {
    name: 'User',
    description: 'Basic office access — read-only view of Dashboard, Projects, Scheduling, Staff, Logistics and Compliance.',
    is_system: true,
    is_read_only: false,
    staff_type: 'office',
    landing_page: '/admin',
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'compliance'].includes(m.key) ? 'read' : 'none'])
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
    description: 'Strict read-only lockdown — can view non-sensitive hubs but cannot create, edit, upload or delete anything.',
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

  // Last resort: role-based defaults (derived from group name by getMyStaffProfile)
  const role = (isPlatformAdmin || profile.is_admin) ? 'super_admin' : (profile.system_role || 'field');
  if (role === 'super_admin' || role === 'admin') return 'write';
  if (role === 'management') return moduleKey === 'settings' ? 'none' : 'write';
  if (role === 'user') return ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'compliance'].includes(moduleKey) ? 'read' : 'none';
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