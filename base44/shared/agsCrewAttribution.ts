// ============================================================
// Shared per-shift crew attribution logic for AGS file parsing
// ============================================================
// Used by importAGS and receiveKeyLogBookData to build per-shift crew
// maps from the SHFT and HDPH AGS groups, capturing the FULL crew
// (not just the first comma-separated name) and attributing the
// correct crew to each activity via the SHFT_ID link.
//
// KeyLogBook AGS structure:
//   SHFT group — one row per shift per borehole, with SHFT_ID, SHFT_CREW,
//     SHFT_STAR (start datetime), SHFT_ENDD (end datetime), SHFT_EXC (device)
//   HDPH group — one row per drilling phase per borehole, with SHFT_ID link,
//     HDPH_LOG (KLB users who logged), HDPH_CREW (full crew), HDPH_EXC (device)
//   DLOG/PTIM/HDIA groups — driller daily activities, each with a SHFT_ID
//     linking the activity to the specific shift it was recorded on
//
// This module processes ALL HDPH rows per borehole (not just the first)
// so multi-shift boreholes get the correct crew per phase, and uses the
// SHFT_ID on each activity to look up the correct crew for that shift.

export interface ShiftCrewInfo {
  crew_names: string[];
  crew_string: string;
  device_name: string;
  start_time: string;
  end_time: string;
  borehole_ref: string;
}

export interface BoreholeCrewInfo {
  crew_names: string[];
  device_name: string;
  logger_names: string[];
}

// Parse a comma-separated name string into individual trimmed names.
// "Kevin Price, Lewis Needell, Amir" → ["Kevin Price", "Lewis Needell", "Amir"]
// Filters out placeholder values like "unknown", "n/a", "none", "test".
export function parseCrewNames(value: string | undefined | null): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(n => n.trim())
    .filter(n => n.length > 1 && !/^(unknown|n\/?a|none|test|null)$/i.test(n));
}

// Build a per-shift crew map from the SHFT and HDPH groups.
// Returns: Record<shiftId, ShiftCrewInfo>
// Each shift has the full crew (from SHFT_CREW and HDPH_CREW/HDPH_LOG),
// the device name (HDPH_EXC / SHFT_EXC), and shift start/end times.
export function buildShiftCrewMap(
  groups: Record<string, any>,
  buildRow: (g: any, row: string[]) => Record<string, string>,
  pick: (r: Record<string, string>, ...targets: string[]) => string,
  splitDateTime: (v: string) => { date: string; time: string }
): Record<string, ShiftCrewInfo> {
  const shiftMap: Record<string, ShiftCrewInfo> = {};

  // 1) Parse SHFT group — one row per shift per borehole
  if (groups.SHFT && groups.SHFT.rows.length) {
    for (const row of groups.SHFT.rows) {
      const r = buildRow(groups.SHFT, row);
      const shiftId = pick(r, 'SHFT_ID', 'SHIFT_ID', 'ID');
      if (!shiftId) continue;
      const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const crewStr = pick(r, 'SHFT_CREW', 'CREW');
      const device = pick(r, 'SHFT_EXC', 'EXC', 'HDPH_EXC', 'DEVICE', 'RIG');
      const starDt = pick(r, 'SHFT_STAR', 'STAR', 'SHFT_START', 'START_DATETIME');
      const enddDt = pick(r, 'SHFT_ENDD', 'ENDD', 'ETIM', 'SHFT_END', 'END_DATETIME');
      const starSplit = starDt ? splitDateTime(starDt) : { date: '', time: '' };
      const endSplit = enddDt ? splitDateTime(enddDt) : { date: starSplit.date, time: '' };

      if (!shiftMap[shiftId]) {
        shiftMap[shiftId] = {
          crew_names: parseCrewNames(crewStr),
          crew_string: crewStr,
          device_name: device,
          start_time: starSplit.time,
          end_time: endSplit.time,
          borehole_ref: ref,
        };
      } else {
        if (!shiftMap[shiftId].crew_names.length && crewStr) {
          shiftMap[shiftId].crew_names = parseCrewNames(crewStr);
          shiftMap[shiftId].crew_string = crewStr;
        }
        if (!shiftMap[shiftId].device_name && device) shiftMap[shiftId].device_name = device;
        if (!shiftMap[shiftId].start_time && starSplit.time) shiftMap[shiftId].start_time = starSplit.time;
        if (!shiftMap[shiftId].end_time && endSplit.time) shiftMap[shiftId].end_time = endSplit.time;
        if (!shiftMap[shiftId].borehole_ref && ref) shiftMap[shiftId].borehole_ref = ref;
      }
    }
  }

  // 2) Enrich with HDPH group — has HDPH_LOG, HDPH_CREW, HDPH_EXC per shift
  if (groups.HDPH && groups.HDPH.rows.length) {
    for (const row of groups.HDPH.rows) {
      const r = buildRow(groups.HDPH, row);
      const shiftId = pick(r, 'SHFT_ID', 'SHIFT_ID', 'HDPH_SHFT', 'ID');
      const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const logStr = pick(r, 'HDPH_LOG', 'LOG');
      const crewStr = pick(r, 'HDPH_CREW', 'CREW');
      const device = pick(r, 'HDPH_EXC', 'EXC', 'DEVICE', 'RIG');

      if (shiftId) {
        if (!shiftMap[shiftId]) {
          shiftMap[shiftId] = {
            crew_names: parseCrewNames(crewStr || logStr),
            crew_string: crewStr || logStr,
            device_name: device,
            start_time: '',
            end_time: '',
            borehole_ref: ref,
          };
        } else {
          // Prefer HDPH_LOG (actual KLB users) over SHFT_CREW
          if (logStr) {
            shiftMap[shiftId].crew_names = parseCrewNames(logStr);
            shiftMap[shiftId].crew_string = logStr;
          } else if (!shiftMap[shiftId].crew_names.length && crewStr) {
            shiftMap[shiftId].crew_names = parseCrewNames(crewStr);
            shiftMap[shiftId].crew_string = crewStr;
          }
          if (!shiftMap[shiftId].device_name && device) shiftMap[shiftId].device_name = device;
          if (!shiftMap[shiftId].borehole_ref && ref) shiftMap[shiftId].borehole_ref = ref;
        }
      }
    }
  }

  return shiftMap;
}

// Build a per-borehole aggregate crew map from the HDPH group.
// Processes ALL HDPH rows per borehole (not just the first) so multi-shift
// boreholes get ALL crew members aggregated.
// Returns: Record<boreholeRef, BoreholeCrewInfo>
export function buildBoreholeCrewMap(
  groups: Record<string, any>,
  buildRow: (g: any, row: string[]) => Record<string, string>,
  pick: (r: Record<string, string>, ...targets: string[]) => string
): Record<string, BoreholeCrewInfo> {
  const map: Record<string, BoreholeCrewInfo> = {};
  if (!groups.HDPH || !groups.HDPH.rows.length) return map;

  for (const row of groups.HDPH.rows) {
    const r = buildRow(groups.HDPH, row);
    const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
    if (!ref) continue;
    const logStr = pick(r, 'HDPH_LOG', 'LOG');
    const crewStr = pick(r, 'HDPH_CREW', 'CREW');
    const device = pick(r, 'HDPH_EXC', 'EXC', 'DEVICE', 'RIG');

    if (!map[ref]) map[ref] = { crew_names: [], device_name: '', logger_names: [] };

    const logNames = parseCrewNames(logStr);
    const crewNames = parseCrewNames(crewStr);
    // Logger names (HDPH_LOG) = actual KLB users who logged the hole
    logNames.forEach(n => { if (!map[ref].logger_names.includes(n)) map[ref].logger_names.push(n); });
    // Crew names (HDPH_CREW) = full crew — includes everyone on the rig
    crewNames.forEach(n => { if (!map[ref].crew_names.includes(n)) map[ref].crew_names.push(n); });
    // Also add logger names to crew if crew was empty
    logNames.forEach(n => { if (!map[ref].crew_names.includes(n)) map[ref].crew_names.push(n); });
    if (!map[ref].device_name && device) map[ref].device_name = device;
  }
  return map;
}

// Calculate drill time per borehole by summing SHFT durations for all
// shifts on that borehole. Returns: Record<boreholeRef, minutes>
export function buildBoreholeDrillTimeMap(
  groups: Record<string, any>,
  buildRow: (g: any, row: string[]) => Record<string, string>,
  pick: (r: Record<string, string>, ...targets: string[]) => string,
  splitDateTime: (v: string) => { date: string; time: string }
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!groups.SHFT || !groups.SHFT.rows.length) return map;

  for (const row of groups.SHFT.rows) {
    const r = buildRow(groups.SHFT, row);
    const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
    if (!ref) continue;
    const starDt = pick(r, 'SHFT_STAR', 'STAR', 'SHFT_START', 'START_DATETIME');
    const enddDt = pick(r, 'SHFT_ENDD', 'ENDD', 'ETIM', 'SHFT_END', 'END_DATETIME');
    if (!starDt || !enddDt) continue;

    const starSplit = splitDateTime(starDt);
    const endSplit = splitDateTime(enddDt);
    if (!starSplit.time || !endSplit.time) continue;

    // Calculate duration in minutes (handle overnight shifts)
    const starMins = timeToMinutes(starSplit.time);
    const endMins = timeToMinutes(endSplit.time);
    if (starMins == null || endMins == null) continue;
    const duration = endMins > starMins ? endMins - starMins : (endMins + 1440) - starMins;
    if (duration > 0 && duration < 1440) {
      map[ref] = (map[ref] || 0) + duration;
    }
  }
  return map;
}

function timeToMinutes(time: string): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}