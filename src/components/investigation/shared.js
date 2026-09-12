// Shared configuration for the geotechnical investigation logging system

import { format } from 'date-fns';

export const strataOptions = [
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
];

export const sampleTypes = [
  { value: 'none', label: 'No sample' },
  { value: 'disturbed', label: 'Disturbed (D)' },
  { value: 'undisturbed', label: 'Undisturbed (U)' },
  { value: 'water', label: 'Water (W)' },
];

export const pitStabilityOptions = [
  { value: 'not_assessed', label: 'Not assessed' },
  { value: 'stable', label: 'Stable' },
  { value: 'minor_slumping', label: 'Minor slumping' },
  { value: 'collapse', label: 'Collapse' },
];

export const serviceEncounterOptions = [
  { value: 'none', label: 'None found' },
  { value: 'gas', label: 'Gas' },
  { value: 'water', label: 'Water' },
  { value: 'electric', label: 'Electric' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'drainage', label: 'Drainage' },
  { value: 'unknown', label: 'Unknown service' },
];

export const reinstatementOptions = [
  { value: 'none', label: 'No reinstatement' },
  { value: 'backfilled', label: 'Backfilled (site-won)' },
  { value: 'granular_fill', label: 'Granular fill (Type 1)' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'tarmac', label: 'Tarmac' },
  { value: 'left_open', label: 'Left open' },
  { value: 'other', label: 'Other' },
];

export const fluidLossOptions = [
  { value: 'none', label: 'No loss (full return)' },
  { value: 'partial', label: 'Partial loss' },
  { value: 'total', label: 'Total loss' },
];

export const fluidReturnOptions = [
  { value: 'full', label: 'Full return' },
  { value: 'partial', label: 'Partial return' },
  { value: 'lost', label: 'No return' },
];

export const obstructionOptions = [
  { value: 'none', label: 'None' },
  { value: 'boulder', label: 'Boulder / Cobble' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'utilities', label: 'Utilities / Services' },
  { value: 'void', label: 'Void' },
  { value: 'other', label: 'Other' },
];

export const mixerTypeOptions = [
  { value: 'none', label: 'Not applicable' },
  { value: 'machine_mixer', label: 'Machine mixer' },
  { value: 'hand_mix', label: 'Hand mix' },
  { value: 'ready_mixed', label: 'Ready mixed' },
];

export const sensorTypeOptions = [
  { value: 'cone_penetrometer', label: 'Cone Penetrometer (CPT)' },
  { value: 'resistivity', label: 'Resistivity' },
  { value: 'masw', label: 'MASW' },
  { value: 'gpr', label: 'Ground Penetrating Radar' },
  { value: 'other', label: 'Other' },
];

export const reviewStatusConfig = {
  pending: { label: 'Pending', badge: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  queried: { label: 'Queried', badge: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500' },
};

export const strataConfig = {
  topsoil: { label: 'Topsoil', color: 'text-amber-700 bg-amber-50' },
  made_ground: { label: 'Made Ground', color: 'text-slate-700 bg-slate-100' },
  clay_soft: { label: 'Soft Clay', color: 'text-yellow-700 bg-yellow-50' },
  clay_firm: { label: 'Firm Clay', color: 'text-yellow-800 bg-yellow-100' },
  clay_stiff: { label: 'Stiff Clay', color: 'text-orange-700 bg-orange-50' },
  sand_loose: { label: 'Loose Sand', color: 'text-amber-600 bg-amber-50' },
  sand_medium_dense: { label: 'Med Dense Sand', color: 'text-amber-700 bg-amber-100' },
  sand_dense: { label: 'Dense Sand', color: 'text-orange-600 bg-orange-50' },
  gravel: { label: 'Gravel', color: 'text-stone-700 bg-stone-100' },
  silt: { label: 'Silt', color: 'text-gray-700 bg-gray-100' },
  peat: { label: 'Peat', color: 'text-amber-900 bg-amber-100' },
  chalk: { label: 'Chalk', color: 'text-slate-200 bg-slate-50' },
  mudstone: { label: 'Mudstone', color: 'text-gray-600 bg-gray-100' },
  sandstone: { label: 'Sandstone', color: 'text-orange-700 bg-orange-50' },
  limestone: { label: 'Limestone', color: 'text-slate-400 bg-slate-50' },
  granite: { label: 'Granite', color: 'text-pink-700 bg-pink-50' },
  concrete: { label: 'Concrete', color: 'text-slate-600 bg-slate-100' },
  tarmac: { label: 'Tarmac', color: 'text-slate-800 bg-slate-200' },
  other: { label: 'Other', color: 'text-slate-600 bg-slate-50' },
};

export const serviceEncounterConfig = {
  none: { label: 'No services', icon: 'Check', color: 'text-emerald-600 bg-emerald-50' },
  gas: { label: 'Gas', icon: 'Flame', color: 'text-red-600 bg-red-50' },
  water: { label: 'Water', icon: 'Droplets', color: 'text-blue-600 bg-blue-50' },
  electric: { label: 'Electric', icon: 'Zap', color: 'text-yellow-600 bg-yellow-50' },
  telecom: { label: 'Telecom', icon: 'Cable', color: 'text-purple-600 bg-purple-50' },
  drainage: { label: 'Drainage', icon: 'Waves', color: 'text-teal-600 bg-teal-50' },
  unknown: { label: 'Unknown', icon: 'HelpCircle', color: 'text-slate-600 bg-slate-50' },
};

export const pitStabilityConfig = {
  stable: { label: 'Stable', badge: 'bg-emerald-100 text-emerald-700' },
  minor_slumping: { label: 'Minor slumping', badge: 'bg-amber-100 text-amber-700' },
  collapse: { label: 'Collapse', badge: 'bg-red-100 text-red-700' },
  not_assessed: { label: 'Not assessed', badge: 'bg-slate-100 text-slate-500' },
};

export const fluidLossConfig = {
  none: { label: 'Full return', badge: 'bg-emerald-100 text-emerald-700' },
  partial: { label: 'Partial loss', badge: 'bg-amber-100 text-amber-700' },
  total: { label: 'Total fluid loss', badge: 'bg-red-100 text-red-700' },
};

export const obstructionConfig = {
  none: { label: 'None', badge: 'bg-slate-100 text-slate-500' },
  boulder: { label: 'Boulder', badge: 'bg-stone-100 text-stone-700' },
  concrete: { label: 'Concrete', badge: 'bg-slate-200 text-slate-700' },
  utilities: { label: 'Utilities', badge: 'bg-red-100 text-red-700' },
  void: { label: 'Void', badge: 'bg-purple-100 text-purple-700' },
  other: { label: 'Other', badge: 'bg-slate-100 text-slate-600' },
};

export const logTypeConfig = {
  borehole_progress: { label: 'Borehole Progress', icon: 'ArrowDownToLine', badge: 'bg-blue-100 text-blue-700' },
  sample_collection: { label: 'Sample', icon: 'TestTube', badge: 'bg-purple-100 text-purple-700' },
  window_sampling: { label: 'Window Sampling', icon: 'Layers', badge: 'bg-indigo-100 text-indigo-700' },
  pit_excavation: { label: 'Trial Pit', icon: 'MapPin', badge: 'bg-amber-100 text-amber-700' },
  inspection_pit: { label: 'Inspection Pit', icon: 'Search', badge: 'bg-orange-100 text-orange-700' },
  installation: { label: 'Installation', icon: 'Package', badge: 'bg-emerald-100 text-emerald-700' },
  grouting_works: { label: 'Grouting', icon: 'Beaker', badge: 'bg-rose-100 text-rose-700' },
  site_setup: { label: 'Site Setup', icon: 'Wrench', badge: 'bg-slate-100 text-slate-600' },
  reinstatement: { label: 'Reinstatement', icon: 'Undo2', badge: 'bg-teal-100 text-teal-700' },
  standpipe_reading: { label: 'Standpipe Reading', icon: 'Gauge', badge: 'bg-cyan-100 text-cyan-700' },
  geophysical_probing: { label: 'Geophysical Probing', icon: 'Radar', badge: 'bg-violet-100 text-violet-700' },
  borehole_decommissioning: { label: 'Decommissioning', icon: 'Ban', badge: 'bg-stone-100 text-stone-700' },
  core_inspection: { label: 'Core Inspection', icon: 'Boxes', badge: 'bg-fuchsia-100 text-fuchsia-700' },
  spt: { label: 'SPT', icon: 'Gauge', badge: 'bg-amber-100 text-amber-700' },
  other: { label: 'Other', icon: 'ClipboardList', badge: 'bg-slate-100 text-slate-600' },
};

// Strata colors for visual columns — hex values matching strataConfig badges
export const strataColors = {
  topsoil: '#a3a300', made_ground: '#64748b', clay_soft: '#a16207', clay_firm: '#854d0e',
  clay_stiff: '#c2410c', sand_loose: '#d97706', sand_medium_dense: '#b45309', sand_dense: '#ea580c',
  gravel: '#78716c', silt: '#6b7280', peat: '#78350f', chalk: '#cbd5e1', mudstone: '#4b5563',
  sandstone: '#c2410c', limestone: '#94a3b8', granite: '#be185d', concrete: '#475569',
  tarmac: '#1e293b', other: '#94a3b8',
};

export const sampleTypeConfig = {
  disturbed: { label: 'Disturbed', badge: 'bg-amber-100 text-amber-700' },
  undisturbed: { label: 'Undisturbed', badge: 'bg-blue-100 text-blue-700' },
  water: { label: 'Water', badge: 'bg-cyan-100 text-cyan-700' },
  none: { label: 'No sample', badge: 'bg-slate-100 text-slate-500' },
};

export function getSptDensityLabel(n) {
  if (n < 4) return 'Very loose';
  if (n < 10) return 'Loose';
  if (n < 30) return 'Medium dense';
  if (n < 50) return 'Dense';
  return 'Very dense';
}

export function safeFormatDate(dateStr, fmt) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 8 && /^\d{8}$/.test(dateStr)
    ? `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T00:00:00`
    : (dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'));
  if (isNaN(d.getTime())) return dateStr;
  try { return format(d, fmt); } catch { return dateStr; }
}

// Auto-calculate SPT N-value from blow count array
// BS 5930: N = sum of blows for 2nd and 3rd increments (150mm)
export function calculateSptN(blows) {
  if (!blows || blows.length < 2) return null;
  if (blows.length === 3) return blows[1] + blows[2];
  if (blows.length === 2) return blows[0] + blows[1];
  return null;
}

// Check if a log has incomplete mandatory geotechnical data
export function getMissingFields(log) {
  const missing = [];
  if (log.log_type === 'borehole_progress' || log.log_type === 'window_sampling') {
    if (!log.strata_descriptor || log.strata_descriptor === 'other') {
      if (!log.strata_description_detail) missing.push('Strata description');
    }
  }
  if (log.log_type === 'pit_excavation' || log.log_type === 'inspection_pit') {
    if (!log.pit_stability_rating || log.pit_stability_rating === 'not_assessed') missing.push('Pit stability');
  }
  if (log.log_type === 'reinstatement') {
    if (!log.verification_photo_urls) missing.push('Verification photos');
    if (!log.reinstatement_type || log.reinstatement_type === 'none') missing.push('Reinstatement type');
  }
  if (log.log_type === 'standpipe_reading') {
    if (!log.standpipe_ref) missing.push('Standpipe ref');
    if (log.standpipe_reading_m == null && log.standpipe_dip_depth_m == null) missing.push('Water level reading');
  }
  if (log.log_type === 'grouting_works') {
    if (!log.mixer_type || log.mixer_type === 'none') missing.push('Mixer type');
    if (log.grout_volume == null) missing.push('Grout volume');
  }
  if (log.log_type === 'geophysical_probing') {
    if (!log.sensor_type) missing.push('Sensor type');
    if (log.probe_depth == null) missing.push('Probe depth');
  }
  if (log.log_type === 'borehole_decommissioning') {
    if (!log.backfill_material) missing.push('Backfill/seal material');
    if (log.seal_depth == null) missing.push('Seal depth');
  }
  if (log.log_type === 'core_inspection') {
    if (!log.core_box_number) missing.push('Core box number');
    if (!log.photo_urls) missing.push('Core photo');
  }
  if (log.refusal_encountered && (!log.obstruction_type || log.obstruction_type === 'none') && !log.description) {
    missing.push('Refusal cause');
  }
  if (log.completed_by_type && log.completed_by_type !== 'internal_staff' && !log.completed_by_name) {
    missing.push('Rep name');
  }
  return missing;
}

// Check for anomalous data that should be flagged for manager review
export function getAnomalyFlags(log) {
  const flags = [];
  if (log.spt_n_value != null && log.spt_n_value > 50) flags.push('Very high SPT N-value');
  if (log.coring_recovery != null && log.coring_recovery < 30) flags.push('Low core recovery');
  if (log.coring_rqd != null && log.coring_rqd < 25) flags.push('Low RQD');
  if (log.pit_stability_rating === 'collapse') flags.push('Pit collapse reported');
  if (log.service_encounter_type && log.service_encounter_type !== 'none' && !log.service_encounter_gps) flags.push('Service found without GPS');
  if (log.service_encounter_type && log.service_encounter_type !== 'none' && log.service_check_by_type && log.service_check_by_type !== 'internal_staff' && !log.service_check_by_name) flags.push('Service check name missing');
  if (log.drilling_fluid_loss === 'total' || log.fluid_return_quality === 'lost') flags.push('Total fluid loss');
  if (log.refusal_encountered) flags.push('Refusal encountered');
  if (log.obstruction_type === 'void') flags.push('Void encountered');
  if (log.obstruction_type === 'utilities') flags.push('Utility clash');
  if (log.log_type === 'grouting_works' && log.grout_volume != null && log.grout_volume < 5) flags.push('Low grout volume');
  if (log.log_type === 'borehole_decommissioning' && log.seal_depth != null && log.depth_from != null && log.seal_depth < log.depth_from) flags.push('Seal above borehole base');
  return flags;
}