import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Default options — used as a fallback until an admin visits Settings →
// Dropdown Manager and customises them. These mirror the original hard-coded
// constants so every existing form keeps working out of the box. Once a
// ConfigList record exists for a key, the database value wins.
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG_LISTS = {
  qualifications: {
    label: 'Qualifications & Training',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'cscs_card', label: 'CSCS Card', critical: true },
      { value: 'cpcs_card', label: 'CPCS Card' },
      { value: 'npors_card', label: 'NPORS Card' },
      { value: 'first_aid_cert', label: 'First Aid Certificate' },
      { value: 'driver_license', label: 'Driver Licence' },
      { value: 'dbs_certificate', label: 'DBS Certificate' },
      { value: 'forklift', label: 'Forklift Training' },
      { value: 'sts_triple', label: 'STS Triple (STS)' },
      { value: 'confined_space', label: 'Confined Space' },
      { value: 'asbestos_awareness', label: 'Asbestos Awareness' },
      { value: 'manual_handling', label: 'Manual Handling' },
      { value: 'working_at_height', label: 'Working at Height' },
      { value: 'other', label: 'Other' },
    ],
  },
  asset_types: {
    label: 'Asset Types',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'rig', label: 'Rigs' },
      { value: 'machinery', label: 'Machinery' },
      { value: 'trailer', label: 'Trailers' },
      { value: 'vehicle', label: 'Vehicles' },
      { value: 'lifting', label: 'Lifting Gear' },
    ],
  },
  revenue_streams: {
    label: 'Revenue Streams',
    category: 'Finance',
    is_system: true,
    options: [
      { value: 'none', label: 'Per asset/task only', description: 'Revenue tracked from equipment, deliveries & logged tasks — no crew-level billing.' },
      { value: 'drilling_meterage', label: 'Drilling Meterage (£/m)', description: 'Crew billed per metre drilled on drilling jobs.' },
      { value: 'groundworks_unit', label: 'Groundworks Unit (£/pit)', description: 'Crew billed per trial pit, charger or unit installed.' },
      { value: 'coring_unit', label: 'Coring Unit (£/core run)', description: 'Crew billed per core run or metre cored.' },
      { value: 'trial_pit_unit', label: 'Trial Pit Unit (£/pit)', description: 'Crew billed per trial pit excavated.' },
      { value: 'day_rate', label: 'Daily Crew Rate', description: 'Fixed daily rate for the whole crew on a job.' },
      { value: 'flat_fee', label: 'Flat Project Fee', description: "Single agreed fee for the whole crew's work on the job." },
    ],
  },
  team_job_types: {
    label: 'Crew Job Types',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'drilling', label: 'Drilling' },
      { value: 'groundworks', label: 'Groundworks' },
    ],
  },
  // ---- Investigation Logging ----
  strata_types: {
    label: 'Strata Classifications',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'topsoil', label: 'Topsoil' },
      { value: 'made_ground', label: 'Made Ground' },
      { value: 'clay_soft', label: 'Soft Clay' },
      { value: 'clay_firm', label: 'Firm Clay' },
      { value: 'clay_stiff', label: 'Stiff Clay' },
      { value: 'sand_loose', label: 'Loose Sand' },
      { value: 'sand_medium_dense', label: 'Medium Dense Sand' },
      { value: 'sand_dense', label: 'Dense Sand' },
      { value: 'gravel', label: 'Gravel' },
      { value: 'silt', label: 'Silt' },
      { value: 'peat', label: 'Peat' },
      { value: 'chalk', label: 'Chalk' },
      { value: 'mudstone', label: 'Mudstone' },
      { value: 'sandstone', label: 'Sandstone' },
      { value: 'limestone', label: 'Limestone' },
      { value: 'granite', label: 'Granite' },
      { value: 'concrete', label: 'Concrete' },
      { value: 'tarmac', label: 'Tarmac' },
      { value: 'other', label: 'Other' },
    ],
  },
  sample_types: {
    label: 'Sample Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'No sample' },
      { value: 'disturbed', label: 'Disturbed (D)' },
      { value: 'undisturbed', label: 'Undisturbed (U)' },
      { value: 'water', label: 'Water (W)' },
    ],
  },
  pit_stability_options: {
    label: 'Pit Stability Ratings',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'not_assessed', label: 'Not assessed' },
      { value: 'stable', label: 'Stable' },
      { value: 'minor_slumping', label: 'Minor slumping' },
      { value: 'collapse', label: 'Collapse' },
    ],
  },
  service_encounter_types: {
    label: 'Service Encounter Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'None found' },
      { value: 'gas', label: 'Gas' },
      { value: 'water', label: 'Water' },
      { value: 'electric', label: 'Electric' },
      { value: 'telecom', label: 'Telecom' },
      { value: 'drainage', label: 'Drainage' },
      { value: 'unknown', label: 'Unknown service' },
    ],
  },
  reinstatement_types: {
    label: 'Reinstatement Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'No reinstatement' },
      { value: 'backfilled', label: 'Backfilled (site-won)' },
      { value: 'granular_fill', label: 'Granular fill (Type 1)' },
      { value: 'concrete', label: 'Concrete' },
      { value: 'tarmac', label: 'Tarmac' },
      { value: 'left_open', label: 'Left open' },
      { value: 'other', label: 'Other' },
    ],
  },
  fluid_loss_options: {
    label: 'Fluid Loss Options',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'No loss (full return)' },
      { value: 'partial', label: 'Partial loss' },
      { value: 'total', label: 'Total loss' },
    ],
  },
  fluid_return_options: {
    label: 'Fluid Return Options',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'full', label: 'Full return' },
      { value: 'partial', label: 'Partial return' },
      { value: 'lost', label: 'No return' },
    ],
  },
  obstruction_types: {
    label: 'Obstruction Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'None' },
      { value: 'boulder', label: 'Boulder / Cobble' },
      { value: 'concrete', label: 'Concrete' },
      { value: 'utilities', label: 'Utilities / Services' },
      { value: 'void', label: 'Void' },
      { value: 'other', label: 'Other' },
    ],
  },
  mixer_types: {
    label: 'Mixer Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'none', label: 'Not applicable' },
      { value: 'machine_mixer', label: 'Machine mixer' },
      { value: 'hand_mix', label: 'Hand mix' },
      { value: 'ready_mixed', label: 'Ready mixed' },
    ],
  },
  sensor_types: {
    label: 'Sensor / Probe Types',
    category: 'Investigation',
    is_system: true,
    options: [
      { value: 'cone_penetrometer', label: 'Cone Penetrometer (CPT)' },
      { value: 'resistivity', label: 'Resistivity' },
      { value: 'masw', label: 'MASW' },
      { value: 'gpr', label: 'Ground Penetrating Radar' },
      { value: 'other', label: 'Other' },
    ],
  },
  // ---- Assets ----
  rig_types: {
    label: 'Rig Types',
    category: 'Assets',
    is_system: true,
    options: [
      { value: 'cp', label: 'CP (Cable Percussion)' },
      { value: 'rotary', label: 'Rotary' },
      { value: 'n/a', label: 'N/A' },
    ],
  },
  stock_levels: {
    label: 'Stock Levels',
    category: 'Assets',
    is_system: true,
    options: [
      { value: 'in_stock', label: 'In Stock' },
      { value: 'low_stock', label: 'Low Stock' },
      { value: 'out_of_stock', label: 'Out of Stock' },
      { value: 'needs_service', label: 'Needs Service' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  compliance_statuses: {
    label: 'Compliance Statuses',
    category: 'Assets',
    is_system: true,
    options: [
      { value: 'compliant', label: 'Compliant' },
      { value: 'expiring', label: 'Expiring Soon' },
      { value: 'expired', label: 'Expired' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  // ---- Crews ----
  worker_types: {
    label: 'Worker Types',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'direct_employee', label: 'Direct Employee' },
      { value: 'subcontractor', label: 'Subcontractor' },
      { value: 'agency', label: 'Agency' },
    ],
  },
  team_categories: {
    label: 'Team Categories',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'field_ops', label: 'Field Ops' },
      { value: 'depot', label: 'Depot' },
      { value: 'management', label: 'Management' },
    ],
  },
  // ---- Jobs ----
  job_statuses: {
    label: 'Job Statuses',
    category: 'Jobs',
    is_system: true,
    options: [
      { value: 'planning', label: 'Planning' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'decommissioning', label: 'Decommissioning' },
      { value: 'completed', label: 'Completed' },
      { value: 'on_hold', label: 'On Hold' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  revenue_methods: {
    label: 'Revenue Methods',
    category: 'Jobs',
    is_system: true,
    options: [
      { value: 'none', label: 'Markup on Cost' },
      { value: 'day_rate', label: 'Day Rate' },
      { value: 'meterage_rate', label: 'Meterage Rate' },
      { value: 'unit_rate', label: 'Unit Rate' },
      { value: 'flat_fee', label: 'Flat Fee' },
    ],
  },
  // ---- Logistics ----
  delivery_types: {
    label: 'Delivery Types',
    category: 'Logistics',
    is_system: true,
    options: [
      { value: 'site_delivery', label: 'Site Delivery' },
      { value: 'supplier_collection', label: 'Supplier Collection' },
      { value: 'item_handover', label: 'Item Handover' },
    ],
  },
  equipment_locations: {
    label: 'Equipment Locations',
    category: 'Logistics',
    is_system: true,
    options: [
      { value: 'yard', label: 'Yard' },
      { value: 'in_transit', label: 'In Transit' },
      { value: 'site', label: 'On Site' },
      { value: 'returned', label: 'Returned' },
    ],
  },
  // ---- Finance ----
  cost_item_categories: {
    label: 'Cost Item Categories',
    category: 'Finance',
    is_system: true,
    options: [
      { value: 'internal_equipment', label: 'Owned Equipment' },
      { value: 'hired_equipment', label: 'Hired Equipment' },
      { value: 'purchased_equipment', label: 'Purchased Equipment' },
      { value: 'contractor_supplied', label: 'Contractor Supplied' },
      { value: 'client_supplied', label: 'Client Supplied' },
      { value: 'labour', label: 'Labour / Extra Crew' },
    ],
  },
  rate_card_categories: {
    label: 'Rate Card Categories',
    category: 'Finance',
    is_system: true,
    options: [
      { value: 'labour', label: 'Labour' },
      { value: 'plant', label: 'Plant Hire' },
      { value: 'materials', label: 'Materials' },
    ],
  },
  rate_card_sources: {
    label: 'Rate Card Sources',
    category: 'Finance',
    is_system: true,
    options: [
      { value: 'our_company', label: 'Our Company' },
      { value: 'supplier', label: 'Supplier' },
    ],
  },
  supplier_categories: {
    label: 'Supplier Categories',
    category: 'Suppliers',
    is_system: true,
    options: [
      { value: 'training', label: 'Training' },
      { value: 'materials', label: 'Materials' },
      { value: 'plant', label: 'Plant' },
      { value: 'ppe', label: 'PPE' },
      { value: 'fuel', label: 'Fuel' },
      { value: 'consumables', label: 'Consumables' },
      { value: 'other', label: 'Other' },
    ],
  },
  // ---- Help ----
  help_categories: {
    label: 'Help Topic Categories',
    category: 'Help',
    is_system: true,
    options: [
      { value: 'delivery', label: 'Deliveries' },
      { value: 'logistics', label: 'Logistics & Equipment' },
      { value: 'compliance', label: 'Compliance' },
      { value: 'safety', label: 'Safety' },
      { value: 'general', label: 'General' },
      { value: 'app_usage', label: 'Using the App' },
    ],
  },
};

// Fetch all ConfigList records from the database and merge with defaults.
// Database records always override defaults once they exist.
export function useConfigLists() {
  const queryClient = useQueryClient();
  const { data: dbLists = [], isLoading } = useQuery({
    queryKey: ['config-lists'],
    queryFn: () => base44.entities.ConfigList.list(),
  });

  // Merge: start from defaults, override with DB records that share the same key.
  const merged = {};
  for (const [key, def] of Object.entries(DEFAULT_CONFIG_LISTS)) {
    const dbMatch = dbLists.find(l => l.key === key);
    merged[key] = dbMatch || { key, ...def };
  }
  // Also include any extra DB-only lists (admin-created custom lists).
  for (const list of dbLists) {
    if (!merged[list.key]) merged[list.key] = list;
  }

  // Return a helper to grab options for a given key as {value,label} pairs.
  const getOptions = (key) => merged[key]?.options || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['config-lists'] });

  return { lists: Object.values(merged), getList: (key) => merged[key], getOptions, isLoading, invalidate };
}