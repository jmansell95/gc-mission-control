// Shared borehole status inference logic — used by both the importAGS backend
// function (for new imports) and the client-side BoreholeSummaryPanel fallback
// (for existing logs that were imported before LOCA_STAT inference existed).
//
// Priority: explicit LOCA_STAT → end date + final depth → data coverage fallback.

export type BoreholeStatus = 'complete' | 'in_progress' | 'unchecked' | '';

export interface BoreholeStatusInput {
  // The raw LOCA_STAT value from the AGS file (COMPLETE / INPROG / UNCHECKED).
  locaStatRaw?: string;
  // Final drilled depth (LOCA_FDEP) — the max depth_to across all logs for this borehole.
  finalDepth?: number | null;
  // Borehole end date (LOCA_ENDD) — when drilling was completed.
  endDate?: string | null;
  // Borehole start date (LOCA_STAR) — when drilling began.
  startDate?: string | null;
  // Count of strata logs (GEOL rows) for this borehole.
  strataCount?: number;
  // Count of sample logs for this borehole.
  sampleCount?: number;
  // Count of core inspection logs for this borehole.
  coreCount?: number;
}

// Infer borehole status when LOCA_STAT is missing or blank.
// Returns 'complete' | 'in_progress' | 'unchecked' | '' (empty = cannot infer).
//
// Step 1: If LOCA_STAT is present and recognised, use it directly.
// Step 2: If the borehole has a final depth AND an end date → complete.
// Step 3: If it has a start date but no end date → in_progress.
// Step 4: If neither date exists, fall back to data coverage:
//   - strata/samples/core covering the full depth → complete
//   - partial data → in_progress
//   - no data → unchecked
export function inferBoreholeStatus(input: BoreholeStatusInput): BoreholeStatus {
  // Step 1: Use explicit LOCA_STAT if present and recognised
  const raw = (input.locaStatRaw || '').toUpperCase().trim();
  if (raw === 'COMPLETE' || raw === 'COMPLETED' || raw === 'C') return 'complete';
  if (raw === 'INPROG' || raw === 'IN_PROGRESS' || raw === 'IN-PROG' || raw === 'I') return 'in_progress';
  if (raw === 'UNCHECKED' || raw === 'UNCK' || raw === 'U') return 'unchecked';

  // Step 2: End date + final depth → complete
  const hasFinalDepth = input.finalDepth != null && input.finalDepth > 0;
  const hasEndDate = !!input.endDate;
  if (hasFinalDepth && hasEndDate) return 'complete';

  // Step 3: Start date but no end date → in_progress
  if (input.startDate && !hasEndDate) return 'in_progress';

  // Step 4: Data coverage fallback
  const dataCount = (input.strataCount || 0) + (input.sampleCount || 0) + (input.coreCount || 0);
  if (dataCount === 0) return 'unchecked';
  // If we have data but no dates, treat as in_progress (partial coverage)
  return 'in_progress';
}