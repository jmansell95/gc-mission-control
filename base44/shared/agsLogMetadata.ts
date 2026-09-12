// ============================================================
// AGS Log Metadata — shared SPT detection + description builders
// ============================================================
// Single source of truth for classifying and writing meaningful
// descriptions on KeyLogBook-imported InvestigationLog records.
// Used by BOTH:
//   • importAGS — writes clean descriptions at ingest time
//   • backfillLogMetadata — rewrites existing logs retroactively
//
// The problem this solves: KeyLogBook AGS imports were writing
// descriptions like "Imported from KeyLogBook AGS — sample [UUID] (D)"
// and tagging SPTs as borehole_progress. The financials engine couldn't
// match these to rate card items, so 3,000+ logs generated zero SOR
// revenue. This module produces human-readable descriptions and
// separates SPTs into their own log_type so they bill correctly.

// ── SPT detection ──
// An SPT is a point test at a specific depth — it has depth_from (the
// test depth) but NO depth_to (it's not a range). KeyLogBook imports
// historically tagged these as borehole_progress, which made the
// financials engine skip them from SOR matching (assuming they were
// drilling advance). We detect them by:
//   1. spt_blows array is non-empty, OR
//   2. spt_n_value is non-null, OR
//   3. description contains "SPT (N=" pattern
// AND depth_to is null/empty (confirming it's a point test, not a range).
export function isSptLog(log: any): boolean {
  if (!log) return false;
  const hasSptData = (Array.isArray(log.spt_blows) && log.spt_blows.length > 0) ||
    log.spt_n_value != null;
  const desc = String(log.description || '');
  const hasSptDesc = /SPT\s*\(N=/i.test(desc);
  const hasDepthTo = log.depth_to != null && Number(log.depth_to) > 0;
  return (hasSptData || hasSptDesc) && !hasDepthTo;
}

// ── Build a meaningful SPT description ──
// "SPT at 4.0m (N=23) — BH1239"
export function buildSptDescription(log: any): string {
  const depth = log.depth_from != null ? `${Number(log.depth_from).toFixed(1)}m` : '';
  const nVal = log.spt_n_value != null ? `(N=${log.spt_n_value})` : '';
  const ref = log.borehole_ref ? ` — ${log.borehole_ref}` : '';
  const parts = ['SPT'];
  if (depth) parts.push(`at ${depth}`);
  if (nVal) parts.push(nVal);
  return `${parts.join(' ')}${ref}`;
}

// ── Build a meaningful sample description ──
// "Disturbed sample at 2.5m — BH1239"
// Replaces UUID-based descriptions like
// "Imported from KeyLogBook AGS — sample 20bc29ba-... (D)".
export function buildSampleDescription(log: any): string {
  const typeMap: Record<string, string> = {
    disturbed: 'Disturbed sample',
    undisturbed: 'Undisturbed sample',
    water: 'Water sample',
    none: 'Sample',
  };
  const typeLabel = typeMap[log.sample_type] || 'Sample';
  const depth = log.depth_from != null ? ` at ${Number(log.depth_from).toFixed(1)}m` : '';
  const ref = log.borehole_ref ? ` — ${log.borehole_ref}` : '';
  const sampId = log.sample_id ? ` [${log.sample_id}]` : '';
  return `${typeLabel}${depth}${ref}${sampId}`;
}

// ── Build a meaningful strata description ──
// "Strata: Stiff Clay at 2.0–4.5m — BH1239"
export function buildStrataDescription(log: any): string {
  const descriptor = log.strata_descriptor && log.strata_descriptor !== 'other'
    ? toTitleCase(log.strata_descriptor.replace(/_/g, ' '))
    : 'Strata';
  const dFrom = log.depth_from != null ? Number(log.depth_from).toFixed(1) : '';
  const dTo = log.depth_to != null ? Number(log.depth_to).toFixed(1) : '';
  const depthRange = dFrom && dTo ? `${dFrom}–${dTo}m` : (dFrom ? `${dFrom}m` : '');
  const ref = log.borehole_ref ? ` — ${log.borehole_ref}` : '';
  const detail = log.strata_description_detail ? ` (${log.strata_description_detail})` : '';
  return `Strata: ${descriptor}${depthRange ? ` at ${depthRange}` : ''}${ref}${detail}`;
}

// ── Build a meaningful core inspection description ──
// "Core run C1 at 5.0–7.5m (RQD 85%, recovery 92%) — BH1239"
export function buildCoreDescription(log: any): string {
  const run = log.core_run_number ? ` ${log.core_run_number}` : '';
  const dFrom = log.depth_from != null ? Number(log.depth_from).toFixed(1) : '';
  const dTo = log.depth_to != null ? Number(log.depth_to).toFixed(1) : '';
  const depthRange = dFrom && dTo ? `${dFrom}–${dTo}m` : '';
  const rqd = log.coring_rqd != null ? `, RQD ${log.coring_rqd}%` : '';
  const rec = log.coring_recovery != null ? `, recovery ${log.coring_recovery}%` : '';
  const ref = log.borehole_ref ? ` — ${log.borehole_ref}` : '';
  return `Core run${run}${depthRange ? ` at ${depthRange}` : ''}${rqd}${rec}${ref}`;
}

// ── Build a meaningful installation description ──
export function buildInstallationDescription(log: any): string {
  const ref = log.borehole_ref ? ` — ${log.borehole_ref}` : '';
  const pipeRef = log.standpipe_ref ? ` ${log.standpipe_ref}` : '';
  const dFrom = log.depth_from != null ? Number(log.depth_from).toFixed(1) : '';
  const dTo = log.depth_to != null ? Number(log.depth_to).toFixed(1) : '';
  const depthRange = dFrom && dTo ? `${dFrom}–${dTo}m` : '';
  return `Installation${pipeRef}${depthRange ? ` at ${depthRange}` : ''}${ref}`;
}

// ── Build a meaningful borehole progress description ──
// "Borehole BH1239 (CP) — drilled to 15.0m"
export function buildBoreholeProgressDescription(log: any): string {
  const ref = log.borehole_ref || 'Borehole';
  const method = log.drilling_method ? ` (${log.drilling_method.toUpperCase()})` : '';
  const dTo = log.depth_to != null ? ` — drilled to ${Number(log.depth_to).toFixed(1)}m` : '';
  return `Borehole ${ref}${method}${dTo}`;
}

// ── Enrich a log's metadata in place ──
// Returns the log object with:
//   • log_type corrected (SPTs reclassified to 'spt')
//   • description rewritten to a meaningful, human-readable string
//   • borehole_ref appended where missing
// This is the single entry point used by both importAGS and
// backfillLogMetadata so the logic is defined once.
export function enrichLogMetadata(log: any): any {
  if (!log) return log;

  // Reclassify SPTs from borehole_progress → spt
  if (log.log_type === 'borehole_progress' && isSptLog(log)) {
    log.log_type = 'spt';
  }

  // Rewrite the description based on the (possibly corrected) log_type
  // Only rewrite AGS-imported logs (source = 'ags_import') — don't touch
  // staff-entered or keylogbook_remarks logs, which have their own
  // meaningful descriptions already.
  if (log.source !== 'ags_import') return log;

  switch (log.log_type) {
    case 'spt':
      log.description = buildSptDescription(log);
      break;
    case 'sample_collection':
      log.description = buildSampleDescription(log);
      break;
    case 'core_inspection':
      log.description = buildCoreDescription(log);
      break;
    case 'installation':
      log.description = buildInstallationDescription(log);
      break;
    case 'borehole_progress':
      // Only rewrite if it's still the generic "Imported from..." prefix
      if (String(log.description || '').startsWith('Imported from KeyLogBook AGS')) {
        log.description = buildBoreholeProgressDescription(log);
      }
      break;
    // standpipe_reading, grouting_works, etc. keep their existing descriptions
    // (they already have meaningful text from the import).
  }

  return log;
}

// ── Title case helper ──
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}