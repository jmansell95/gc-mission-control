/**
 * dropdownUsageMap — curated static registry mapping each ConfigList key to the
 * pages/sections/fields where that dropdown is consumed in the app. Shown in the
 * Dropdown Manager so admins can identify exactly which list they are editing.
 *
 * Each entry is an array of { page, section, field, route }:
 *   page    — the hub/page name (matches the sidebar label)
 *   section — the panel or modal within that page
 *   field   — the form field / control label that uses the list
 *   route   — a react-router path the jump-link navigates to
 *
 * Routes point at the page that hosts the field; some pages use internal section
 * state (e.g. the Admin Dashboard) so the link lands on the page rather than a
 * deep section, which is the best available jump target.
 */
export const DROPDOWN_USAGE_MAP = {
  qualifications: [
    { page: 'People Hub', section: 'Training & Qualifications', field: 'Add Qualification', route: '/staff' },
    { page: 'Compliance', section: 'Training Matrix', field: 'Qualification filter', route: '/compliance' },
  ],
  asset_types: [
    { page: 'Assets Hub', section: 'Add / Edit Asset', field: 'Asset Type', route: '/assets' },
  ],
  revenue_streams: [
    { page: 'People Hub', section: 'Crew Profile', field: 'Revenue Stream', route: '/staff' },
  ],
  team_job_types: [
    { page: 'People Hub', section: 'Team Manager', field: 'Crew Job Type', route: '/staff' },
  ],
  strata_types: [
    { page: 'Investigation Logs', section: 'Driller Log', field: 'Strata Classification', route: '/admin' },
    { page: 'Job Detail', section: 'Site Logs', field: 'Strata descriptor', route: '/admin' },
  ],
  sample_types: [
    { page: 'Investigation Logs', section: 'Driller Log', field: 'Sample Type', route: '/admin' },
  ],
  pit_stability_options: [
    { page: 'Investigation Logs', section: 'Trial Pit Log', field: 'Pit Stability Rating', route: '/admin' },
  ],
  service_encounter_types: [
    { page: 'Investigation Logs', section: 'Trial Pit Log', field: 'Service Encounter Type', route: '/admin' },
  ],
  reinstatement_types: [
    { page: 'Investigation Logs', section: 'Reinstatement', field: 'Reinstatement Type', route: '/admin' },
  ],
  fluid_loss_options: [
    { page: 'Investigation Logs', section: 'Driller Log', field: 'Drilling Fluid Loss', route: '/admin' },
  ],
  fluid_return_options: [
    { page: 'Investigation Logs', section: 'Driller Log', field: 'Fluid Return Quality', route: '/admin' },
  ],
  obstruction_types: [
    { page: 'Investigation Logs', section: 'Driller Log', field: 'Obstruction Type', route: '/admin' },
  ],
  mixer_types: [
    { page: 'Investigation Logs', section: 'Grouting / Installation', field: 'Mixer Type', route: '/admin' },
  ],
  sensor_types: [
    { page: 'Investigation Logs', section: 'Geophysical Probing', field: 'Sensor / Probe Type', route: '/admin' },
  ],
  rig_types: [
    { page: 'Assets Hub', section: 'Add / Edit Asset', field: 'Rig Type', route: '/assets' },
  ],
  stock_levels: [
    { page: 'Assets Hub', section: 'Asset Card', field: 'Stock Level', route: '/assets' },
  ],
  compliance_statuses: [
    { page: 'Assets Hub', section: 'Asset Compliance', field: 'Compliance Status', route: '/assets' },
    { page: 'Compliance', section: 'Asset Compliance Report', field: 'Status filter', route: '/compliance' },
  ],
  worker_types: [
    { page: 'People Hub', section: 'Crew Profile', field: 'Worker Type', route: '/staff' },
  ],
  team_categories: [
    { page: 'People Hub', section: 'Team Manager', field: 'Team Category', route: '/staff' },
  ],
  job_statuses: [
    { page: 'Projects Hub', section: 'Project Manager', field: 'Project Status', route: '/admin' },
    { page: 'Job Detail', section: 'Status modal', field: 'Status', route: '/admin' },
  ],
  revenue_methods: [
    { page: 'Projects Hub', section: 'Project Wizard', field: 'Revenue Method', route: '/admin' },
  ],
  delivery_types: [
    { page: 'Logistics Hub', section: 'Delivery Manager', field: 'Delivery Type', route: '/admin/logistics' },
    { page: 'Deliveries', section: 'Delivery Dashboard', field: 'Type filter', route: '/deliveries' },
  ],
  equipment_locations: [
    { page: 'Logistics Hub', section: 'Equipment Tracking', field: 'Equipment Location', route: '/admin/logistics' },
  ],
  cost_item_categories: [
    { page: 'Billing', section: 'Job Cost Items', field: 'Cost Category', route: '/billing' },
    { page: 'Job Detail', section: 'Costs tab', field: 'Category', route: '/admin' },
  ],
  rate_card_categories: [
    { page: 'Billing', section: 'Rate Card Manager', field: 'Category', route: '/billing' },
  ],
  rate_card_sources: [
    { page: 'Billing', section: 'Rate Card Manager', field: 'Source', route: '/billing' },
  ],
  help_categories: [
    { page: 'Help Guide', section: 'Help Topics', field: 'Topic Category', route: '/help' },
  ],
};

export function getDropdownUsage(key) {
  return DROPDOWN_USAGE_MAP[key] || [];
}