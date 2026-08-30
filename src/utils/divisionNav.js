/**
 * Division Navigation Registry
 * ───────────────────────────
 * Central definition of all possible mobile bottom-nav items.
 * Each division stores a list of nav item IDs (Division.nav_items) that
 * are rendered by MobileBottomNav. When a division has no nav_items
 * configured, it falls back to the default set for its division_type.
 *
 * To add a new nav item:
 *   1. Add an entry to NAV_ITEM_REGISTRY with a unique key.
 *   2. Add the corresponding lucide icon to the ICON_MAP in MobileBottomNav.
 *   3. Optionally add it to a division type default below.
 */

export const NAV_ITEM_REGISTRY = {
  home:        { id: 'home',        label: 'Home',      icon: 'Home',      path: '/enterprise' },
  schedule:    { id: 'schedule',    label: 'Schedule',  icon: 'Calendar',  path: '/staff-schedule' },
  scan:        { id: 'scan',        label: 'Scan',      icon: 'ScanLine',  path: '/scanner',         highlight: true },
  deliveries:  { id: 'deliveries',  label: 'Driver Hub',icon: 'Truck',     path: '/deliveries' },
  jobs:        { id: 'jobs',        label: 'Projects',  icon: 'Briefcase', path: '/admin' },
  dashboard:   { id: 'dashboard',   label: 'Dashboard', icon: 'Grid3x3',   path: '/admin' },
  compliance:  { id: 'compliance',  label: 'Compliance', icon: 'ShieldCheck', path: '/compliance' },
  assets:      { id: 'assets',      label: 'Assets',    icon: 'Boxes',     path: '/assets' },
  fleet:       { id: 'fleet',       label: 'Fleet',     icon: 'Car',       path: '/fleet' },
  billing:     { id: 'billing',     label: 'Billing',   icon: 'PoundSterling', path: '/billing' },
  staff:       { id: 'staff',       label: 'Staff',     icon: 'Users',     path: '/staff' },
  ai_hub:      { id: 'ai_hub',      label: 'AI Hub',    icon: 'Sparkles',  path: null, isAIHub: true },
  profile:     { id: 'profile',     label: 'Profile',   icon: 'User',      path: '/staff-profile' },
  help:        { id: 'help',        label: 'Help',      icon: 'HelpCircle', path: '/help' },
};

/**
 * Default nav item IDs per division type.
 * Used when a division has no nav_items configured.
 */
export const DIVISION_TYPE_NAV_DEFAULTS = {
  geotechnical:  ['home', 'scan', 'ai_hub'],
  land_water:    ['home', 'scan', 'ai_hub'],
  infrastructure:['home', 'scan', 'ai_hub'],
  lde:           ['home', 'ai_hub'],
  environmental: ['home', 'scan', 'ai_hub'],
  surveys:       ['home', 'ai_hub'],
  structural:    ['home', 'ai_hub'],
  renewables:    ['home', 'scan', 'ai_hub'],
  general:       ['home', 'ai_hub'],
};

/**
 * All nav item IDs available for selection in the Division Manager.
 */
export const ALL_NAV_ITEM_IDS = Object.keys(NAV_ITEM_REGISTRY);

/**
 * Resolve the nav items for a division.
 * Returns the division's custom nav_items, or the default for its type.
 *
 * @param {object} division - The division record (or null for enterprise overview)
 * @returns {string[]} ordered list of nav item IDs
 */
export function resolveNavItems(division) {
  if (!division) return DIVISION_TYPE_NAV_DEFAULTS.geotechnical;
  if (division.nav_items && division.nav_items.length > 0) return division.nav_items;
  return DIVISION_TYPE_NAV_DEFAULTS[division.division_type] || DIVISION_TYPE_NAV_DEFAULTS.general;
}

/**
 * Get the nav item config objects for a division.
 *
 * @param {object} division
 * @returns {object[]} array of nav item config objects from the registry
 */
export function getNavConfigs(division) {
  return resolveNavItems(division)
    .map(id => NAV_ITEM_REGISTRY[id])
    .filter(Boolean);
}