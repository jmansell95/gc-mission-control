// ============================================================
// logBillingStatus — shared billable/data-point/unmatched badge logic
// ============================================================
// Determines the billing status of an InvestigationLog for display in
// the Investigation Hub and AFP Builder. Returns a status key that maps
// to a coloured badge:
//   • 'billable'   — green, has a matched rate card item or stamped charge
//   • 'data_point' — grey, a non-billable data record (strata, sample, SPT
//                    without a rate, installation reading, etc.)
//   • 'unmatched'  — amber, should be billable but couldn't be matched
//                    to a rate card item
//
// Used by SiteLogDayCard, InvestigationBoreholeDetail, and the AFP
// Builder so every surface shows the same billing status badge.

// Log types that are data points, not billable activities.
// These record geotechnical observations (what was found in the ground)
// rather than chargeable work (what was done).
const DATA_POINT_TYPES = new Set([
  'standpipe_reading',
  'borehole_decommissioning',
]);

// Log types that are billable SOR items when they have a rate card match.
const BILLABLE_SOR_TYPES = new Set([
  'spt',
  'sample_collection',
  'pit_excavation',
  'inspection_pit',
  'installation',
  'grouting_works',
  'geophysical_probing',
  'window_sampling',
  'site_setup',
  'reinstatement',
]);

/**
 * Determine the billing status of a log.
 * @param {Object} log - The InvestigationLog record
 * @returns {{ status: string, label: string, icon: string, badge: string }}
 */
export function getLogBillingStatus(log) {
  if (!log) return { status: 'data_point', label: 'Data point', icon: 'Database', badge: 'bg-slate-100 text-slate-500' };

  // Explicitly marked as no_charge
  if (log.billing_status === 'no_charge') {
    return { status: 'data_point', label: 'Data point', icon: 'Database', badge: 'bg-slate-100 text-slate-500' };
  }

  // Has a stamped charge amount — billable
  if (log.charge_amount != null && Number(log.charge_amount) > 0) {
    return { status: 'billable', label: 'Billable', icon: 'PoundSign', badge: 'bg-emerald-100 text-emerald-700' };
  }

  // Has a linked rate card item (via charge_breakdown) — billable
  if (log.charge_breakdown) {
    try {
      const bd = typeof log.charge_breakdown === 'string' ? JSON.parse(log.charge_breakdown) : log.charge_breakdown;
      if (bd && (bd.rate_card_item_id || bd.unit_price)) {
        return { status: 'billable', label: 'Billable', icon: 'PoundSign', badge: 'bg-emerald-100 text-emerald-700' };
      }
    } catch (_) { /* not JSON */ }
  }

  // Drilling advance (borehole_progress / core_inspection with a depth range)
  // — billed as meterage, not SOR. Show as billable if it has a depth range.
  const isDrillingAdvance = log.log_type === 'borehole_progress' || log.log_type === 'core_inspection';
  if (isDrillingAdvance) {
    const dFrom = Number(log.depth_from) || 0;
    const dTo = Number(log.depth_to) || 0;
    if (dTo > dFrom) {
      return { status: 'billable', label: 'Meterage', icon: 'PoundSign', badge: 'bg-emerald-100 text-emerald-700' };
    }
    // Depthless borehole_progress — could be a misclassified SPT or an
    // incomplete log. Flag as unmatched so managers can review.
    return { status: 'unmatched', label: 'Unmatched', icon: 'AlertTriangle', badge: 'bg-amber-100 text-amber-700' };
  }

  // Billable SOR types (SPT, sample, pit, installation, etc.)
  if (BILLABLE_SOR_TYPES.has(log.log_type)) {
    // These should have a rate card match. If they don't, they're unmatched.
    // SPTs and samples from AGS import often lack a stamped charge — flag
    // them as unmatched so managers can see they're being missed.
    if (log.source === 'ags_import') {
      return { status: 'unmatched', label: 'Unmatched', icon: 'AlertTriangle', badge: 'bg-amber-100 text-amber-700' };
    }
    // Staff-entered / keylogbook_remarks — these go through the pricing review
    // queue. Show as pending if not yet priced, billable if priced.
    if (log.pricing_review_status === 'pending_review') {
      return { status: 'unmatched', label: 'Pending', icon: 'AlertTriangle', badge: 'bg-amber-100 text-amber-700' };
    }
    return { status: 'billable', label: 'Billable', icon: 'PoundSign', badge: 'bg-emerald-100 text-emerald-700' };
  }

  // Pure data point types (readings, decommissioning records)
  if (DATA_POINT_TYPES.has(log.log_type)) {
    return { status: 'data_point', label: 'Data point', icon: 'Database', badge: 'bg-slate-100 text-slate-500' };
  }

  // 'other' logs (driller remarks / dayworks) — billable if priced
  if (log.log_type === 'other') {
    if (log.chargeable && log.charge_amount != null && Number(log.charge_amount) > 0) {
      return { status: 'billable', label: 'Billable', icon: 'PoundSign', badge: 'bg-emerald-100 text-emerald-700' };
    }
    if (log.chargeable && log.pricing_review_status === 'pending_review') {
      return { status: 'unmatched', label: 'Pending', icon: 'AlertTriangle', badge: 'bg-amber-100 text-amber-700' };
    }
    return { status: 'data_point', label: 'Activity', icon: 'Database', badge: 'bg-slate-100 text-slate-500' };
  }

  // Default — data point
  return { status: 'data_point', label: 'Data point', icon: 'Database', badge: 'bg-slate-100 text-slate-500' };
}

/**
 * Group unmatched entries by log_type for the financials warning banner.
 * @param {Array} unmatchedEntries - from calculateJobFinancials response
 * @returns {Object} { log_type: { count, sample_description } }
 */
export function groupUnmatchedByType(unmatchedEntries) {
  const groups = {};
  for (const entry of (unmatchedEntries || [])) {
    const type = entry.log_type || 'unknown';
    if (!groups[type]) groups[type] = { count: 0, samples: [] };
    groups[type].count++;
    if (groups[type].samples.length < 3) {
      groups[type].samples.push(entry.description || entry.borehole_ref || '—');
    }
  }
  return groups;
}