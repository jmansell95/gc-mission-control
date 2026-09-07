/**
 * Multi-discipline helpers.
 *
 * Jobs now carry a `disciplines` array — each entry is an independent track
 * (drilling, groundworks, depot) with its own status, dates, and revenue
 * method. These helpers bridge the new array with the legacy single-type
 * fields so display logic keeps working during migration.
 *
 * Simplified discipline model (Aug 2026):
 *   - drilling   → with a CP / Rotary / Mixed sub-choice via drilling_method
 *   - groundworks → covers ALL groundworks crews (enabling, coring, trial pit, general)
 *   - depot      → for jobs based at the yard
 * Legacy types (enabling, enabling_works, supervisor, coring, trial_pit) are
 * migrated to drilling or groundworks by the migrateJobDisciplines function.
 */

import { getJobPrimaryType } from './jobTeams';

// Discipline type → display config
export const DISCIPLINE_CONFIG = {
  drilling: { label: 'Drilling', color: 'amber', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', icon: 'Drill' },
  groundworks: { label: 'Groundworks', color: 'emerald', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', icon: 'HardHat' },
  depot: { label: 'Depot', color: 'slate', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: 'Warehouse' },
};

// Legacy discipline → new discipline mapping (used for migration + display fallback)
export const LEGACY_DISCIPLINE_MAP = {
  enabling: 'groundworks',
  enabling_works: 'groundworks',
  supervisor: 'groundworks',
  coring: 'drilling',
  trial_pit: 'drilling',
  // Legacy team job_type values
  cp_drilling: 'drilling',
  rotary_drilling: 'drilling',
};

export function getDisciplineConfig(typeKey) {
  // Map legacy types to the new simplified model
  const mapped = LEGACY_DISCIPLINE_MAP[typeKey] || typeKey;
  return DISCIPLINE_CONFIG[mapped] || {
    label: typeKey ? typeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'General',
    color: 'slate', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: 'Briefcase',
  };
}

// Sub-categories (crew types) available under each discipline. Lets you pick
// the specific crew flavour for a track — e.g. Groundworks → Enabling Crew.
export const DISCIPLINE_SUBCATEGORIES = {
  drilling: [
    { val: 'cp_crew', label: 'CP Crew' },
    { val: 'rotary_crew', label: 'Rotary Crew' },
    { val: 'window_sampling_crew', label: 'Window Sampling Crew' },
    { val: 'mixed_crew', label: 'Mixed Crew' },
  ],
  groundworks: [
    { val: 'enabling_crew', label: 'Enabling Crew' },
    { val: 'coring_crew', label: 'Coring Crew' },
    { val: 'trial_pit_crew', label: 'Trial Pit Crew' },
    { val: 'general', label: 'General Groundworks' },
  ],
  depot: [
    { val: 'yard', label: 'Yard' },
    { val: 'fitter', label: 'Fitter' },
    { val: 'driver', label: 'Driver' },
  ],
};

export function getDisciplineSubcategories(typeKey) {
  const mapped = LEGACY_DISCIPLINE_MAP[typeKey] || typeKey;
  return DISCIPLINE_SUBCATEGORIES[mapped] || [];
}

/**
 * Returns the disciplines array for a job. Falls back to a single-entry
 * array derived from the legacy job_type if the disciplines array is empty,
 * so old jobs display correctly before migration.
 */
export function getJobDisciplines(job) {
  if (!job) return [];
  if (Array.isArray(job.disciplines) && job.disciplines.length > 0) {
    // Map any legacy discipline types to the new simplified model
    return job.disciplines.map(d => {
      const mappedType = LEGACY_DISCIPLINE_MAP[d.type] || d.type;
      return mappedType === d.type ? d : { ...d, type: mappedType };
    });
  }
  // Legacy fallback — derive from job_type
  let legacyType = job.job_type || getJobPrimaryType(job) || 'groundworks';
  legacyType = LEGACY_DISCIPLINE_MAP[legacyType] || legacyType;
  return [{
    type: legacyType,
    status: job.status === 'completed' ? 'completed' : (job.status === 'planning' ? 'planning' : 'active'),
    drilling_method: job.drilling_method || 'not_applicable',
    start_date: job.start_date,
    end_date: job.end_date,
    revenue_method: job.revenue_method || 'none',
  }];
}

/**
 * Returns the primary discipline type key for a job.
 */
export function getPrimaryDisciplineType(job) {
  if (!job) return null;
  if (job.primary_discipline) return LEGACY_DISCIPLINE_MAP[job.primary_discipline] || job.primary_discipline;
  const disciplines = getJobDisciplines(job);
  return disciplines.length > 0 ? disciplines[0].type : null;
}

/**
 * Returns true if the job has an active discipline of the given type.
 */
export function hasDiscipline(job, typeKey) {
  if (!job) return false;
  const disciplines = getJobDisciplines(job);
  return disciplines.some(d => d.type === typeKey && d.status !== 'completed');
}

/**
 * Returns the count of active (non-completed) disciplines.
 */
export function getActiveDisciplineCount(job) {
  const disciplines = getJobDisciplines(job);
  return disciplines.filter(d => d.status === 'active' || d.status === 'planning').length;
}