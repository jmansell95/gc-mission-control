// ============================================================
// Sub-Tab Registry — the single source of truth for every hub's
// tab and sub-tab structure. Used by the permissions system to
// drive per-sub-tab access control (default deny).
// ============================================================
// Each hub has an array of tabs. Each tab has a key, label, and
// optional subTabs array. The permission key for a tab is
// `<hub>.<tab>` and for a sub-tab is `<hub>.<tab>.<subtab>`.
//
// When a new tab or sub-tab is added here, it defaults to 'none'
// for every permission group until an admin explicitly grants it.

export const SUB_TAB_REGISTRY = {
  overview: {
    label: 'Dashboard',
    tabs: [
      { key: 'dashboard', label: 'Command Centre' },
    ],
  },
  jobs: {
    label: 'Projects Hub',
    tabs: [
      { key: 'portfolio', label: 'All Projects' },
      { key: 'financials', label: 'Project Financials' },
      { key: 'details', label: 'Job Details' },
      { key: 'dependencies', label: 'Dependency Manager' },
    ],
  },
  scheduling: {
    label: 'Scheduling Hub',
    tabs: [
      { key: 'rota', label: 'Rota Builder' },
      { key: 'calendar', label: 'Calendar View' },
      { key: 'availability', label: 'Crew Availability' },
    ],
  },
  staff: {
    label: 'People Hub',
    tabs: [
      { key: 'directory', label: 'People Directory' },
      { key: 'contacts', label: 'Contacts' },
      { key: 'timesheets', label: 'Timesheets' },
      { key: 'cost_analytics', label: 'Cost Analytics' },
      { key: 'training', label: 'Training Matrix' },
      { key: 'performance', label: 'Performance & Rewards' },
    ],
  },
  logistics: {
    label: 'Logistics Hub',
    tabs: [
      { key: 'deliveries', label: 'Delivery Dashboard' },
      { key: 'goods_in', label: 'Goods In' },
      { key: 'driver_planner', label: 'Driver Day Planner' },
      { key: 'pick_lists', label: 'Depot Pick Lists' },
    ],
  },
  assets: {
    label: 'Assets Hub',
    tabs: [
      { key: 'inventory', label: 'Asset Inventory' },
      { key: 'rigs', label: 'Rigs' },
      { key: 'pat_testing', label: 'PAT Testing' },
      { key: 'compliance', label: 'Compliance Passports' },
    ],
  },
  fleet: {
    label: 'Fleet Hub',
    tabs: [
      { key: 'vehicles', label: 'Vehicles' },
      { key: 'tracking', label: 'Live Tracking' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'mot_history', label: 'MOT History' },
    ],
  },
  investigation: {
    label: 'Investigation Hub',
    tabs: [
      { key: 'boreholes', label: 'Borehole Data' },
      { key: 'site_logs', label: 'Site Logs' },
      { key: 'geotech_qc', label: 'Geotech QC' },
      { key: 'ags_review', label: 'AGS / KeyLogBook Review' },
    ],
  },
  compliance: {
    label: 'Compliance Hub',
    tabs: [
      {
        key: 'audit_dashboard', label: 'Audit Dashboard',
        subTabs: [
          { key: 'overview', label: 'Overview' },
          { key: 'recurring_failures', label: 'Recurring Failures' },
          { key: 'action_items', label: 'Action Items' },
        ],
      },
      { key: 'job_packs', label: 'Job Packs' },
      { key: 'incidents', label: 'Incidents' },
      {
        key: 'readiness', label: 'Readiness',
        subTabs: [
          { key: 'readiness_gate', label: 'Readiness Gate' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'cert_pulse', label: 'Crew Certification Pulse' },
        ],
      },
      {
        key: 'training_environment', label: 'Training & Environment',
        subTabs: [
          { key: 'toolbox_talks', label: 'Toolbox Talks' },
          { key: 'environmental', label: 'Environmental' },
        ],
      },
    ],
  },
  billing: {
    label: 'Financial Hub',
    tabs: [
      { key: 'insights', label: 'Insights' },
      { key: 'afp', label: 'AFP Portfolio' },
      { key: 'margin_guard', label: 'Margin Guard' },
      { key: 'rate_card_cvr', label: 'Rate Card & CVR' },
      { key: 'contracts_orders', label: 'Contracts & Orders' },
      { key: 'performance', label: 'Performance' },
      { key: 'aged_debtors', label: 'Aged Debtors' },
      { key: 'draft_approval', label: 'Draft Approval Queue' },
      { key: 'poa_worklist', label: 'POA Worklist' },
      { key: 'billing_lifecycle', label: 'Billing Lifecycle' },
      { key: 'monthly_statements', label: 'Monthly Statements' },
    ],
  },
  reports: {
    label: 'Reports Hub',
    tabs: [
      { key: 'custom_reports', label: 'Custom Report Builder' },
      { key: 'scheduled_reports', label: 'Scheduled Reports' },
      { key: 'power_bi', label: 'Power BI Exports' },
    ],
  },
  settings: {
    label: 'Settings',
    tabs: [
      { key: 'general', label: 'General Settings' },
      { key: 'integrations', label: 'Integrations' },
      { key: 'access_levels', label: 'Access Levels' },
      { key: 'divisions', label: 'Divisions' },
      { key: 'billing_settings', label: 'Billing Settings' },
      { key: 'compliance_settings', label: 'Compliance Settings' },
      { key: 'automations', label: 'Automations' },
      { key: 'import', label: 'Import / Export' },
    ],
  },
};

// Build a flat set of all sub-tab permission keys for a hub.
// Returns ['hub.tab', 'hub.tab.subtab', ...]
export function getAllPermissionKeysForHub(hubKey) {
  const hub = SUB_TAB_REGISTRY[hubKey];
  if (!hub) return [];
  const keys = [];
  for (const tab of hub.tabs) {
    keys.push(`${hubKey}.${tab.key}`);
    if (tab.subTabs) {
      for (const sub of tab.subTabs) {
        keys.push(`${hubKey}.${tab.key}.${sub.key}`);
      }
    }
  }
  return keys;
}

// Build a flat set of ALL permission keys across every hub.
export function getAllPermissionKeys() {
  return Object.keys(SUB_TAB_REGISTRY).flatMap(hub => getAllPermissionKeysForHub(hub));
}

// Get the list of tab keys for a hub (just the top-level tabs).
export function getHubTabs(hubKey) {
  return SUB_TAB_REGISTRY[hubKey]?.tabs || [];
}

// Get the sub-tabs for a specific tab within a hub.
export function getTabSubTabs(hubKey, tabKey) {
  const hub = SUB_TAB_REGISTRY[hubKey];
  if (!hub) return [];
  const tab = hub.tabs.find(t => t.key === tabKey);
  return tab?.subTabs || [];
}

// Check if a hub has any sub-tabs at all (determines whether the
// sub-tab expansion UI should be shown for this hub).
export function hubHasSubTabs(hubKey) {
  const hub = SUB_TAB_REGISTRY[hubKey];
  if (!hub) return false;
  return hub.tabs.some(t => t.subTabs && t.subTabs.length > 0);
}