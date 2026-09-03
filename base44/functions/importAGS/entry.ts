import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { parseRemarks, professionaliseActivities, hasTimePattern, timeToMins, normaliseTime, mergeDuplicateLogs } from '../../shared/keylogbookRemarks.ts';

// HMAC-SHA256 for KeyLogBook webhook request signing verification.
// KLB sends X-Hole-Signature: sha256=<hex> when request signing is enabled.
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate a user-supplied file URL to prevent SSRF — only http/https
// schemes and block private/internal IPs and cloud metadata endpoints.
function isSafeFileUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return false;
    if (host.startsWith('127.') || host.startsWith('10.')) return false;
    if (host.startsWith('192.168.') || host.startsWith('169.254.')) return false;
    if (host.startsWith('172.')) {
      const second = parseInt(host.split('.')[1], 10);
      if (second >= 16 && second <= 31) return false;
    }
    return true;
  } catch (e) { return false; }
}

// ============================================================
// AGS v3/v4 parser with suffix-based field matching
// ============================================================
// AGS field names follow the convention {GROUP}_{FIELD}, e.g.
// GEOL_TOP, LOCA_ID, SPT_NVAL. KeyLogBook sometimes doubles the
// group suffix (GEOL_TOP_GEOL). We normalize every heading by
// stripping the group prefix/suffix so matching is robust against
// any variant — GEOL_TOP, GEOL_TOP_GEOL, and TOP all map to "TOP".

function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map(f => f.trim());
}

function detectDelimiter(lines: string[]): string {
  const samples = lines.filter(l => l.trim()).slice(0, 30);
  const counts: Record<string, number> = { '\t': 0, ',': 0, ';': 0, '|': 0 };
  for (const l of samples) {
    if (l.includes('\t')) counts['\t']++;
    if (l.includes(',')) counts[',']++;
    if (l.includes(';')) counts[';']++;
    if (l.includes('|')) counts['|']++;
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] >= counts['|']) return '\t';
  if (counts[','] >= counts[';'] && counts[','] >= counts['|']) return ',';
  if (counts[';'] >= counts['|']) return ';';
  return '|';
}

interface GroupData { name: string; headings: string[]; rows: string[][]; }

function parseAGS(text: string): Record<string, GroupData> {
  const lines = text.split(/\r?\n/);
  const delimiter = detectDelimiter(lines);
  const groups: Record<string, GroupData> = {};
  let currentGroup: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = splitLine(line, delimiter);
    const first = (fields[0] || '').toUpperCase().replace(/"/g, '');

    // v4 keyword-based format
    if (first === 'GROUP' && fields.length >= 2) {
      currentGroup = (fields[1] || '').toUpperCase().replace(/"/g, '');
      if (currentGroup && !groups[currentGroup]) {
        groups[currentGroup] = { name: currentGroup, headings: [], rows: [] };
      }
      continue;
    }
    if (first === 'HEADING' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup]) {
        groups[currentGroup].headings = fields.slice(1).map(f => f.toUpperCase().replace(/"/g, ''));
      }
      continue;
    }
    if (['UNIT', 'TYPE', 'FILE', 'REMARK', 'COMMENT', 'ABBR', 'DICT', 'TRAN'].includes(first)) continue;
    if (first === 'DATA' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup] && groups[currentGroup].headings.length > 0) {
        groups[currentGroup].rows.push(fields.slice(1));
      }
      continue;
    }

    // v3-style: group name is the first field on every line
    if (/^[A-Z][A-Z0-9_]*$/.test(first) && first.length >= 2) {
      if (!groups[first]) {
        // First occurrence — treat as heading row
        const rest = fields.slice(1).map(f => f.toUpperCase().replace(/"/g, ''));
        const valid = rest.filter(f => /^[A-Z][A-Z0-9_]*$/.test(f) && f.length >= 2);
        if (rest.length > 0 && valid.length >= Math.ceil(rest.length / 2)) {
          groups[first] = { name: first, headings: rest, rows: [] };
          currentGroup = first;
        }
      } else if (groups[first].headings.length > 0) {
        groups[first].rows.push(fields.slice(1));
      }
    }
  }
  return groups;
}

// Strip the group prefix (and any doubled suffix) from a field name.
// GEOL_TOP → TOP, GEOL_TOP_GEOL → TOP, LOCA_ID → ID, LOCA_LOCA_ID → ID
function normalizeKey(fieldName: string, groupName: string): string {
  let result = fieldName.toUpperCase();
  const g = groupName.toUpperCase();
  let changed = true;
  while (changed) {
    changed = false;
    if (result.startsWith(g + '_')) { result = result.slice(g.length + 1); changed = true; }
    if (result.endsWith('_' + g)) { result = result.slice(0, result.length - g.length - 1); changed = true; }
  }
  return result;
}

// Build a row lookup keyed by both the full heading name and its normalized suffix.
function buildRow(group: GroupData, row: string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  group.headings.forEach((h, i) => {
    const val = row[i] != null ? row[i].trim() : '';
    const full = h.toUpperCase();
    const suffix = normalizeKey(h, group.name);
    if (!(full in lookup)) lookup[full] = val;
    if (!(suffix in lookup)) lookup[suffix] = val;
  });
  return lookup;
}

// Match a value by trying each target key against both the full-name and
// normalized-suffix maps. Targets should be suffixes (e.g. "ID", "TOP", "DESC").
function pick(row: Record<string, string>, ...targets: string[]): string {
  for (const t of targets) {
    const tu = t.toUpperCase();
    const v = row[tu];
    if (v != null && v !== '') return v;
  }
  // Fallback: any key that ends with one of the targets
  for (const key of Object.keys(row)) {
    for (const t of targets) {
      const tu = t.toUpperCase();
      if (key === tu || key.endsWith('_' + tu)) {
        if (row[key] != null && row[key] !== '') return row[key];
      }
    }
  }
  return '';
}

function num(v: string | undefined | null): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function mapStrataDescriptor(text: string): string {
  if (!text) return 'other';
  const t = text.toLowerCase();
  if (t.includes('topsoil')) return 'topsoil';
  if (t.includes('made') || t.includes('fill')) return 'made_ground';
  if (t.includes('peat')) return 'peat';
  if (t.includes('chalk')) return 'chalk';
  if (t.includes('mudstone') || t.includes('claystone') || t.includes('shale')) return 'mudstone';
  if (t.includes('sandstone')) return 'sandstone';
  if (t.includes('limestone')) return 'limestone';
  if (t.includes('granite') || t.includes('igneous') || t.includes('basalt')) return 'granite';
  if (t.includes('concrete')) return 'concrete';
  if (t.includes('tarmac') || t.includes('asphalt')) return 'tarmac';
  if (t.includes('gravel') || t.includes('cobble') || t.includes('boulder')) return 'gravel';
  if (t.includes('silt') && !t.includes('clay')) return 'silt';
  if (t.includes('clay')) {
    if (t.includes('soft') || t.includes('sloppy')) return 'clay_soft';
    if (t.includes('stiff') || t.includes('hard') || t.includes('very')) return 'clay_stiff';
    return 'clay_firm';
  }
  if (t.includes('sand')) {
    if (t.includes('dense')) return 'sand_dense';
    if (t.includes('medium') || t.includes('med') || t.includes('compact')) return 'sand_medium_dense';
    if (t.includes('loose')) return 'sand_loose';
    return 'sand_medium_dense';
  }
  return 'other';
}

function mapSampleType(agsType: string): string {
  const t = String(agsType || '').toUpperCase().trim();
  if (t.startsWith('U')) return 'undisturbed';
  if (t.startsWith('D') || t.startsWith('B')) return 'disturbed';
  if (t.startsWith('W')) return 'water';
  return 'none';
}

// Maps AGS SAMP_TYPE codes to the Sample entity's sample_type enum.
// Used when auto-creating Sample records from KeyLogBook SAMP groups so
// the driver's sample-collection flow picks them up automatically.
function mapSampleEntityType(agsType: string): string {
  const t = String(agsType || '').toUpperCase().trim();
  if (t.startsWith('U')) return 'undisturbed_u100';
  if (t.startsWith('D')) return 'disturbed';
  if (t.startsWith('B')) return 'bulk_sample';
  if (t.startsWith('W')) return 'water_sample';
  if (t.startsWith('G')) return 'gas_sample';
  if (t.startsWith('C')) return 'rotary_core';
  return 'disturbed';
}

// ============================================================
// Driller remarks extraction from AGS files
// ============================================================
// KeyLogBook embeds the driller's time-stamped daily diary
// ("7:30_8:45 = Start briefing...") into AGS remark/note fields.
// Standard AGS also carries per-record remarks (LOCA_REM, GEOL_REM,
// SAMP_REM) and project remarks (PROJ_REM). We harvest every remark
// field value that matches the time-stamped activity pattern and feed
// it through the same parseRemarks pipeline the webhook uses, so
// manual uploads populate the Site Logs tab identically to real-time
// webhooks.
//
// Each remark chunk is tagged with the date of the borehole row it
// came from (LOCA_STAR / LOCA_ENDD), so the imported activities land
// on the correct day rather than all on "today". Plain descriptive
// remarks without a time pattern stay on their technical logs.

const REMARK_FIELD_SUFFIXES = ['REM', 'REMARK', 'REMARKS', 'NOTE', 'NOTES', 'COMMENT', 'COMMENTS', 'DIARY', 'DAILY'];
// 'REM' is included so a group literally named REM (KeyLogBook's driller-remarks
// group) is treated as a whole-group remark source — every field in it is harvested.
// 'REM' = KeyLogBook driller-remarks group; 'DREM' = driller/daily remarks;
// 'TREM' = tremie pipe group, whose diary/remark rows are harvested here while
// real installation rows (type/material/diameter/depth) are skipped — see guard below.
const REMARK_GROUP_NAMES = ['REM', 'DREM', 'TREM', 'REMARK', 'REMARKS', 'NOTE', 'NOTES', 'COMMENT', 'COMMENTS', 'DIARY', 'DAILY', 'LOG', 'LOGS'];

function isRemarkField(fieldName: string, groupName: string): boolean {
  const suffix = normalizeKey(fieldName, groupName);
  return REMARK_FIELD_SUFFIXES.includes(suffix);
}

interface RemarkChunk { text: string; borehole_ref: string; explicitDate: string; timed: boolean; }

// Normalise an AGS date value to ISO YYYY-MM-DD. Handles the common formats
// KeyLogBook exports (ISO, DD/MM/YYYY, YYYYMMDD) so remark rows dated with a
// different format than LOCA still land on the correct day.
function normaliseDate(v: string): string {
  if (!v) return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

// Split a full ISO datetime (e.g. "2026-08-20T08:00") into a date
// (YYYY-MM-DD) and time (HH:MM). KeyLogBook's PTIM_DTIM, SHFT_STAR and
// SHFT_ENDD fields are full datetimes — this splits them so each row
// gets both a calendar date and a clock time from a single column.
function splitDateTime(v: string): { date: string; time: string } {
  if (!v) return { date: '', time: '' };
  const s = String(v).trim();
  // ISO: 2026-08-20T08:00 or 2026-08-20T08:00:00 or 2026-08-20 08:00
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4].padStart(2, '0')}:${m[5]}` };
  // Date-only fallback
  const d = normaliseDate(s);
  if (d) return { date: d, time: '' };
  return { date: '', time: '' };
}

// Parse a duration string into minutes. Handles the HH:MM:SS format
// KeyLogBook uses for TREM_DURN (e.g. "01:00:00" = 60m, "00:20:00" = 20m,
// "04:10:00" = 250m) and the simpler HH:MM format. Returns null for plain
// numeric values so the existing hours-vs-minutes logic handles those.
function parseDurationToMinutes(v: string | undefined | null): number | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const m2 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m2) return parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  return null;
}

// Collect time-stamped remark text from every *_REM / *_NOTE field and
// REMARK / DIARY group. Each chunk keeps the borehole ref it came from and
// any explicit DATE column value found on its row; the final calendar date
// is resolved later by assignChunkDates so multiple fragments for one
// borehole land on distinct working days rather than all on one date.
function extractRemarkChunks(groups: Record<string, GroupData>): RemarkChunk[] {
  const chunks: RemarkChunk[] = [];
  // De-duplicate identical diary text harvested from several remark columns
  // on the same row (a row often carries the same diary in REM, NOTE and
  // REMARK columns). Keyed by borehole + text so the diary is parsed once.
  const seen = new Set<string>();
  // Capture both time-stamped diary fragments AND plain (non-timed) remarks.
  // Plain remarks become a single Site Log entry each so the driller's remarks
  // always reach the Site Logs tab even when they didn't use the HH:MM_HH:MM format.
  const push = (text: string, ref: string, explicitDate: string) => {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const timed = hasTimePattern(trimmed);
    const key = `${ref || ''}|${timed ? 'T' : 'P'}|${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push({ text: trimmed, borehole_ref: ref, explicitDate, timed });
  };

  // LOCA group — per-row remark fields belong to that borehole.
  if (groups.LOCA && groups.LOCA.rows.length) {
    for (const row of groups.LOCA.rows) {
      const r = buildRow(groups.LOCA, row);
      const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const explicit = normaliseDate(pick(r, 'DATE', 'LOCA_DATE', 'REMARK_DATE', 'DIARY_DATE', 'DAY'));
      groups.LOCA.headings.forEach((h) => {
        const full = h.toUpperCase();
        if (!isRemarkField(h, 'LOCA')) return;
        push(r[full] || '', locaId, explicit);
      });
    }
  }

  // Other groups — remark/diary groups or any *_REM field.
  for (const [name, g] of Object.entries(groups)) {
    if (name === 'LOCA') continue;
    if (!g.headings || g.rows.length === 0) continue;
    const wholeGroupRemark = REMARK_GROUP_NAMES.includes(name.toUpperCase());
    if (!wholeGroupRemark && !g.headings.some(h => REMARK_FIELD_SUFFIXES.includes(normalizeKey(h, name)))) continue;
    for (const row of g.rows) {
      const r = buildRow(g, row);
      // TREM guard: skip rows that are real installations (handled as
      // installation logs by the TREM section) — only harvest diary/remark text.
      if (name === 'TREM') {
        const tType = pick(r, 'TREM_TYPE', 'TYPE');
        const tMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MAT', 'MATERIAL');
        const tDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER', 'DIA');
        const dFrom = num(pick(r, 'TREM_TOP', 'TOP', 'DEPTH_FROM', 'FROM'));
        const dTo = num(pick(r, 'TREM_BASE', 'TREM_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
        const hasInstallAttrs = !!(tType || tMat || tDiam || (dFrom != null && dTo != null && dTo > dFrom));
        if (hasInstallAttrs) continue;
      }
      const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const explicit = normaliseDate(pick(r, 'DATE', 'LOCA_DATE', 'REMARK_DATE', 'DIARY_DATE', 'DAY'));
      g.headings.forEach((h) => {
        const full = h.toUpperCase();
        if (!(wholeGroupRemark || isRemarkField(h, name))) return;
        push(r[full] || '', ref, explicit);
      });
    }
  }
  return chunks;
}

// Assign each chunk a calendar date. Chunks with an explicit DATE column
// keep it. Undated chunks fall back to the borehole's LOCA_STAR drilling
// start date (via locaDates), then the job start date, then today. We do
// NOT spread undated chunks across consecutive working days — that pushed
// diary fragments months into the future (168 records dated 2027). When
// the structured PTIM group is present it provides the real per-row
// datetimes and these remark chunks are filtered out entirely (see
// uncoveredChunks), so this fallback only fires for files with no PTIM.
function assignChunkDates(rawChunks: RemarkChunk[], locaDates: Record<string, string>, jobStartDate: string, defaultDate: string): { text: string; date: string; borehole_ref: string; timed: boolean }[] {
  const out: { text: string; date: string; borehole_ref: string; timed: boolean }[] = [];
  for (const c of rawChunks) {
    const ref = c.borehole_ref || '';
    const explicit = c.explicitDate ? normaliseDate(c.explicitDate) : '';
    const fallback = (ref && locaDates[ref]) || jobStartDate || defaultDate;
    out.push({ text: c.text, date: explicit || fallback, borehole_ref: ref, timed: c.timed });
  }
  return out;
}

// ============================================================
// Structured time group parsing (SHFT, DLOG, PTIM, DREM, HORN)
// ============================================================
// KeyLogBook stores the driller's shift diary in structured AGS groups
// with dedicated time columns — the times are NOT embedded in the remark
// text. The existing parseRemarks() pipeline only finds inline HH:MM_HH:MM
// patterns, so activities from these structured groups end up with null
// start_time / end_time / duration_minutes. This function parses the
// structured groups and returns activities with proper times so the
// Site Logs tab shows real clock times instead of dashes.
//
// Groups parsed (in priority order — first match wins per borehole+date):
//   DLOG — daily log entries with start/end/description
//   PTIM — time entries with start/end/description
//   DREM — driller remarks with time
//   SHFT — shift start/end (one per day, used as a fallback window)
//   HORN — hours worked (duration only, no start/end)

interface StructuredActivity {
  borehole_ref: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  description: string;
}

// Build a per-borehole-per-date shift window from the SHFT group.
// Each SHFT row has SHFT_STAR (start datetime) and SHFT_ENDD (end datetime).
// This window bounds the PTIM activity chain so the full working day is
// captured with real durations instead of zero-duration point markers.
function buildShiftWindows(groups: Record<string, GroupData>): Record<string, { startTime: string; endTime: string }> {
  const windows: Record<string, { startTime: string; endTime: string }> = {};
  if (!groups.SHFT || !groups.SHFT.rows.length) return windows;
  for (const row of groups.SHFT.rows) {
    const r = buildRow(groups.SHFT, row);
    const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
    const starDt = pick(r, 'SHFT_STAR', 'STAR', 'SHFT_START', 'START_DATETIME');
    const enddDt = pick(r, 'SHFT_ENDD', 'ENDD', 'ETIM', 'SHFT_END', 'END_DATETIME');
    if (!starDt) continue;
    const startSplit = splitDateTime(starDt);
    const endSplit = enddDt ? splitDateTime(enddDt) : { date: startSplit.date, time: '' };
    const date = startSplit.date || endSplit.date;
    if (!date) continue;
    const key = `${ref || ''}|${date}`;
    if (!windows[key]) {
      windows[key] = { startTime: startSplit.time, endTime: endSplit.time };
    } else {
      if (startSplit.time && (!windows[key].startTime || startSplit.time < windows[key].startTime)) windows[key].startTime = startSplit.time;
      if (endSplit.time && (!windows[key].endTime || endSplit.time > windows[key].endTime)) windows[key].endTime = endSplit.time;
    }
  }
  return windows;
}

// Chain consecutive PTIM-style activities (start time but no end time) into
// contiguous time blocks. Each activity's end time becomes the next activity's
// start time; the last activity's end time is capped by the SHFT shift end.
function chainActivitiesWithShiftWindows(
  activities: StructuredActivity[],
  shiftWindows: Record<string, { startTime: string; endTime: string }>
): void {
  const grouped: Record<string, StructuredActivity[]> = {};
  for (const a of activities) {
    const key = `${a.borehole_ref || ''}|${a.date || ''}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }
  for (const [key, group] of Object.entries(grouped)) {
    const chainable = group.filter(a => a.start_time && !a.end_time);
    if (chainable.length === 0) continue;
    chainable.sort((a, b) => (timeToMins(a.start_time) || 0) - (timeToMins(b.start_time) || 0));
    const window = shiftWindows[key];
    for (let i = 0; i < chainable.length; i++) {
      const act = chainable[i];
      if (i < chainable.length - 1) {
        act.end_time = chainable[i + 1].start_time;
      } else if (window && window.endTime) {
        act.end_time = window.endTime;
      }
      if (act.start_time && act.end_time) {
        const startMins = timeToMins(act.start_time);
        const endMins = timeToMins(act.end_time);
        if (startMins != null && endMins != null) {
          act.duration_minutes = endMins > startMins ? endMins - startMins : (endMins + 1440) - startMins;
        }
      }
    }
  }
}

function parseStructuredTimeGroups(groups: Record<string, GroupData>, shiftWindows: Record<string, { startTime: string; endTime: string }>): StructuredActivity[] {
  const activities: StructuredActivity[] = [];
  // TREM carries the driller's daily diary with TREM_DTIM (start datetime),
  // TREM_ETIM (end datetime), TREM_DURN (HH:MM:SS duration) and TREM_REM
  // (description). Rows with installation attributes (type/material/diameter/
  // depth) are skipped below and handled by the TREM section as installations.
  // SHFT is no longer parsed as individual activities — it's consumed by
  // buildShiftWindows above to bound the PTIM activity chain.
  const TIME_GROUP_NAMES = ['DLOG', 'PTIM', 'DREM', 'HORN', 'TREM'];

  for (const groupName of TIME_GROUP_NAMES) {
    const g = groups[groupName];
    if (!g || !g.headings || g.rows.length === 0) continue;

    for (const row of g.rows) {
      const r = buildRow(g, row);
      const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'HOLE_ID', 'BH_ID', 'ID', 'REF');

      // KeyLogBook stores full ISO datetimes in PTIM_DTIM, SHFT_STAR and
      // SHFT_ENDD (e.g. "2026-08-20T08:00"). Split each into date + time so
      // every row gets a correct calendar date AND a clock time from a
      // single column. DTIM is the primary source for PTIM rows; STAR/ENDD
      // are the shift start/end datetimes for SHFT rows.
      const dtim = pick(r, 'DTIM', 'PTIM_DTIM', 'DLOG_DTIM', 'DREM_DTIM');
      const starDt = pick(r, 'STAR', 'SHFT_STAR', 'DLOG_STAR', 'START_DATETIME');
      const enddDt = pick(r, 'ENDD', 'ETIM', 'SHFT_ENDD', 'DLOG_ENDD', 'END_DATETIME');

      let date = '';
      let startTime = '';
      let endTime = '';

      if (dtim) {
        const dt = splitDateTime(dtim);
        date = dt.date;
        startTime = dt.time;
      } else {
        date = normaliseDate(pick(r, 'DATE', 'DLOG_DATE', 'PTIM_DATE', 'DREM_DATE', 'SHFT_DATE', 'DAY', 'LOCA_DATE'));
        if (starDt) {
          const dt = splitDateTime(starDt);
          if (!date) date = dt.date;
          startTime = dt.time;
        } else {
          startTime = normaliseTime(pick(r, 'START', 'START_TIME', 'TIME_FROM', 'FROM', 'BEGIN', 'COMMENCE', 'DLOG_START', 'PTIM_START', 'SHFT_START', 'DREM_TIME', 'TIME'));
        }
        if (enddDt) {
          endTime = splitDateTime(enddDt).time;
        } else {
          endTime = normaliseTime(pick(r, 'END', 'END_TIME', 'TIME_TO', 'TO', 'FINISH', 'COMPLETE', 'DLOG_END', 'PTIM_END', 'SHFT_END', 'END_TIME'));
        }
      }

      const durationRaw = pick(r, 'DURATION', 'DURATION_HOURS', 'HOURS', 'HORN_HOURS', 'DLOG_HOURS', 'PTIM_HOURS', 'DURN', 'DUR', 'MINS', 'MINUTES');
      const durationHours = num(durationRaw);
      const description = pick(r, 'DESC', 'DESCRIPTION', 'REM', 'REMARK', 'NOTE', 'NOTES', 'ACTIVITY', 'TASK', 'COMMENT', 'DLOG_DESC', 'PTIM_DESC', 'DREM_DESC', 'SHFT_DESC');

      // Skip rows with no time information at all
      if (!startTime && !endTime && durationHours == null && !dtim) continue;

      // Skip HORN and SHFT entries without a description — HORN is just a
      // total-hours summary and SHFT is just a shift boundary. Neither
      // represents an individual activity, so without a description they
      // add no value to the Site Logs tab (the DLOG entries already cover
      // the actual activities with proper times).
      if ((groupName === 'HORN' || groupName === 'SHFT') && !description) continue;

      // Skip TREM rows that have installation attributes (type/material/
      // diameter/real depth range) — those are real installation records
      // handled by the TREM section handler below. Only harvest diary rows
      // (no installation attrs) as structured activities here.
      if (groupName === 'TREM') {
        const tType = pick(r, 'TREM_TYPE', 'TYPE');
        const tMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MAT', 'MATERIAL');
        const tDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER', 'DIA');
        const tFrom = num(pick(r, 'TREM_TOP', 'TOP', 'DEPTH_FROM', 'FROM'));
        const tTo = num(pick(r, 'TREM_BASE', 'TREM_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
        if (tType || tMat || tDiam || (tFrom != null && tTo != null && tTo > tFrom)) continue;
      }

      // Calculate duration from start/end if not provided directly
      let durationMinutes = 0;
      const hhmmssMinutes = parseDurationToMinutes(durationRaw);
      if (hhmmssMinutes != null && hhmmssMinutes > 0) {
        // HH:MM:SS format (TREM_DURN) — already in minutes
        durationMinutes = hhmmssMinutes;
      } else if (durationHours != null && durationHours > 0) {
        // Values <= 24 are hours (you can't work > 24 hours in a day);
        // values > 24 are already in minutes (e.g. 90 = 1.5h).
        durationMinutes = durationHours <= 24 ? durationHours * 60 : durationHours;
      } else if (startTime && endTime) {
        const startMins = timeToMins(startTime);
        const endMins = timeToMins(endTime);
        if (startMins != null && endMins != null) {
          durationMinutes = endMins > startMins ? endMins - startMins : (endMins + 1440) - startMins;
        }
      }

      activities.push({
        borehole_ref: ref || '',
        date: date || '',
        start_time: startTime || '',
        end_time: endTime || '',
        duration_minutes: durationMinutes,
        description: description || '',
      });
    }
  }

  // Chain PTIM-style activities (start but no end) into contiguous blocks
  // using the SHFT shift window so the full working day is captured.
  chainActivitiesWithShiftWindows(activities, shiftWindows);

  return activities;
}

// Build a map of borehole ref + date → structured activities, so the remark
// processing can look up times for a specific borehole+date. Returns both
// the lookup map and a set of borehole+date keys that have structured
// activities (used to skip remark-text parsing for those combinations).
function buildTimeLookup(activities: StructuredActivity[]): {
  lookup: Record<string, StructuredActivity[]>;
  keys: Set<string>;
} {
  const lookup: Record<string, StructuredActivity[]> = {};
  const keys = new Set<string>();
  for (const a of activities) {
    const key = `${a.borehole_ref || ''}|${a.date || ''}`;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(a);
    keys.add(key);
  }
  return { lookup, keys };
}

// Build a map of borehole ref → date from the LOCA group, used to date
// every technical log (strata, samples, SPT, installations, readings)
// and the driller remarks harvested from those boreholes.
function buildLocaDates(groups: Record<string, GroupData>, fallback: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (groups.LOCA && groups.LOCA.rows.length) {
    for (const row of groups.LOCA.rows) {
      const r = buildRow(groups.LOCA, row);
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      if (!id) continue;
      const date = pick(r, 'LOCA_STAR', 'LOCA_START', 'STAR', 'LOCA_ENDD', 'LOCA_END', 'ENDD', 'LOCA_DATE', 'DATE') || fallback;
      map[id] = date;
    }
  }
  return map;
}

// Stable signature for de-duplicating logs within a single import.
// Two rows that produce the same signature are treated as the same
// entry and only the first is kept.
function logSignature(log: any): string {
  return [
    log.date || '',
    log.log_type || '',
    log.borehole_ref || '',
    log.sample_id || '',
    log.standpipe_ref || '',
    log.depth_from ?? '',
    log.depth_to ?? '',
    log.core_run_number || '',
    log.start_time || '',
    log.end_time || '',
    (log.description || '').trim().toLowerCase(),
  ].join('|');
}

// Logs each incoming KeyLogBook webhook request (parsed AGS group summary +
// matched job reference) so admins can confirm the correct data is pulling to
// the correct job ref. Retains only the 10 most recent records.
async function logWebhookRequest(base44: any, entry: any) {
  try {
    await base44.asServiceRole.entities.KeyLogBookWebhookLog.create(entry);
    const all = await base44.asServiceRole.entities.KeyLogBookWebhookLog.list('-created_date', 50);
    if (all.length > 10) {
      await base44.asServiceRole.entities.KeyLogBookWebhookLog.deleteMany({ id: { $in: all.slice(10).map((r: any) => r.id) } });
    }
  } catch (e) { /* best-effort logging — never block the import */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Automated AGS push authentication ---
    // When KeyLogBook pushes an AGS file automatically (every 30 min), it
    // sends a Bearer token in the Authorization header. We validate it
    // against the ags_sync_secret stored in KeyLogBookConfig. If the config
    // has ags_sync_enabled=true and a secret is set, external callers MUST
    // provide the matching token. Internal app calls (from the settings UI)
    // are identified by the absence of an Authorization header and are allowed
    // through — the route guard already gates access to the settings page.
    // --- KeyLogBook webhook authentication ---
    // KeyLogBook sends event-based webhooks (hole_created, hole_updated,
    // hole_deleted) with a JSON body containing a Base64-encoded AGS file and
    // contextual fields (project_name, project_number, hole_id). Auth can be
    // Bearer Token, Basic Auth, Custom Header, or Off. Optional HMAC-SHA256
    // request signing via the X-Hole-Signature header verifies the payload.
    const contentType = req.headers.get('content-type') || '';
    const authHeader = req.headers.get('authorization') || '';
    const sigHeader = req.headers.get('x-hole-signature') || '';

    let isExternalPush = false;
    let agsSyncConfig: any = null;
    try {
      const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
      agsSyncConfig = configs[0] || null;
    } catch (e) { /* config not available */ }

    // Read JSON body once for HMAC verification + KLB webhook detection
    let rawBodyText = '';
    let klbBody: any = null;
    let isKlbWebhook = false;
    let klbEventType = '';
    let klbHoleId = '';
    let klbProjectName = '';
    let klbProjectNumber = '';

    if (contentType.includes('application/json')) {
      rawBodyText = await req.text();
      try {
        klbBody = JSON.parse(rawBodyText);
        // KeyLogBook server wraps the contextual fields in a `data` object and
        // uses camelCase event names (eventType, holeGuid, projectName, etc.).
        // Support both the nested format and the legacy flat format.
        const evtType = klbBody?.eventType || klbBody?.event_type;
        if (evtType && ['hole_created', 'hole_updated', 'hole_deleted'].includes(evtType)) {
          isKlbWebhook = true;
          klbEventType = evtType;
          const d = klbBody.data || {};
          klbHoleId = d.holeNumber || d.holeGuid || klbBody.hole_id || klbBody.holeId || '';
          klbProjectName = d.projectName || klbBody.project_name || klbBody.projectName || '';
          klbProjectNumber = d.projectNumber || klbBody.project_number || klbBody.projectNumber || '';
        }
      } catch (e) { /* not JSON */ }
    }

    const hasAuthHeader = authHeader.startsWith('Bearer ') || authHeader.startsWith('Basic ');
    const hasCustomAuth = !!(agsSyncConfig?.ags_webhook_custom_header_name && req.headers.get(agsSyncConfig.ags_webhook_custom_header_name));
    isExternalPush = hasAuthHeader || hasCustomAuth || !!sigHeader || isKlbWebhook;

    // The platform forwards the logged-in user's JWT in the Authorization
    // header when the app UI calls functions.invoke('importAGS', ...). That
    // Bearer token is the user's login session, NOT a KeyLogBook webhook
    // secret — so it won't match ags_sync_secret. Before rejecting it as an
    // invalid external push, try auth.me(): if it resolves a valid platform
    // user, the call came from inside the app (manual upload) and should be
    // allowed through without webhook validation. Only genuine external
    // callers (KeyLogBook server with the correct secret, or unknown tokens)
    // are subject to the webhook auth checks below.
    if (isExternalPush && hasAuthHeader && authHeader.startsWith('Bearer ') && !isKlbWebhook) {
      const bearerToken = authHeader.slice(7).trim();
      const storedSecret = (agsSyncConfig?.ags_sync_secret || '').trim();
      if (bearerToken !== storedSecret) {
        try {
          const me = await base44.auth.me();
          if (me && me.id) isExternalPush = false; // internal app call — skip webhook validation
        } catch (e) { /* neither KLB secret nor valid user — leave isExternalPush true to reject below */ }
      }
    }

    if (isExternalPush) {
      if (!agsSyncConfig || !agsSyncConfig.ags_sync_enabled) {
        return Response.json({ error: 'KeyLogBook AGS sync is not enabled.' }, { status: 403 });
      }

      const authMethod = agsSyncConfig.ags_webhook_auth_method || 'bearer';
      if (authMethod === 'bearer') {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const storedSecret = (agsSyncConfig.ags_sync_secret || '').trim();
        if (!storedSecret || token !== storedSecret) {
          return Response.json({ error: 'Invalid Bearer token.' }, { status: 401 });
        }
      } else if (authMethod === 'basic') {
        const expected = btoa(`${agsSyncConfig.ags_webhook_basic_user || ''}:${agsSyncConfig.ags_webhook_basic_pass || ''}`);
        const provided = authHeader.startsWith('Basic ') ? authHeader.slice(6).trim() : '';
        if (!provided || provided !== expected) {
          return Response.json({ error: 'Invalid Basic auth credentials.' }, { status: 401 });
        }
      } else if (authMethod === 'custom_header') {
        const headerName = agsSyncConfig.ags_webhook_custom_header_name || '';
        const expectedValue = agsSyncConfig.ags_webhook_custom_header_value || '';
        if (!expectedValue || req.headers.get(headerName) !== expectedValue) {
          return Response.json({ error: 'Invalid custom header credentials.' }, { status: 401 });
        }
      }

      // Verify HMAC-SHA256 request signing if enabled
      if (agsSyncConfig.ags_webhook_signing_enabled && rawBodyText && sigHeader) {
        const signingSecret = (agsSyncConfig.ags_webhook_signing_secret || '').trim();
        if (signingSecret) {
          const expectedSig = 'sha256=' + await hmacSha256(signingSecret, rawBodyText);
          if (sigHeader !== expectedSig) {
            return Response.json({ error: 'Invalid request signature.' }, { status: 401 });
          }
        }
      }
    }

    // The caller's auth token is not reliably forwarded to backend functions
    // on the published site (the editor preview injects it automatically, but
    // the published gateway does not), so auth.me() can throw
    // "Authentication required to view users". The import only writes
    // non-chargeable logs via the service role, so we treat the caller identity
    // as best-effort: if we can identify them we attribute the logs to them,
    // otherwise we fall back to a generic importer and resolve a staff_id
    // from the job's rota. Access to the settings page itself is already gated
    // by the app's route guard.
    let user: any = null;
    try { user = await base44.auth.me(); } catch (e) { /* token not forwarded — proceed with service role */ }

    // --- Handle hole_deleted event (no AGS file, just contextual info) ---
    if (isKlbWebhook && klbEventType === 'hole_deleted') {
      let delJob: any = null;
      const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
      if (klbProjectNumber) {
        const lc = klbProjectNumber.toLowerCase();
        delJob = allJobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === lc)
          || allJobs.find((j: any) => j.name && j.name.toLowerCase() === lc)
          || allJobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(lc));
      }
      if (!delJob && klbProjectName) {
        const lc = klbProjectName.toLowerCase();
        delJob = allJobs.find((j: any) => j.name && j.name.toLowerCase() === lc)
          || allJobs.find((j: any) => j.name && j.name.toLowerCase().includes(lc));
      }

      let deletedLogs = 0;
      if (delJob) {
        try {
          const existing = await base44.asServiceRole.entities.InvestigationLog.filter({
            job_id: delJob.id, borehole_ref: klbHoleId,
            source: { $in: ['ags_import', 'keylogbook_remarks'] },
          });
          deletedLogs = existing.length;
          if (deletedLogs > 0) {
            await base44.asServiceRole.entities.InvestigationLog.deleteMany({
              job_id: delJob.id, borehole_ref: klbHoleId,
              source: { $in: ['ags_import', 'keylogbook_remarks'] },
            });
          }
        } catch (e) { /* continue */ }
      }

      if (agsSyncConfig?.id) {
        try {
          await base44.asServiceRole.entities.KeyLogBookConfig.update(agsSyncConfig.id, {
            last_ags_sync_at: new Date().toISOString(),
            last_ags_sync_status: 'success',
            last_ags_sync_summary: `Hole ${klbHoleId} deleted — removed ${deletedLogs} log entries${delJob ? ` from ${delJob.name}` : ''}.`,
          });
        } catch (e) { /* best-effort */ }
      }

      await logWebhookRequest(base44, {
        event_type: klbEventType, hole_id: klbHoleId, project_name: klbProjectName, project_number: klbProjectNumber,
        group_summary: [], matched_job_id: delJob?.id || '', matched_job_name: delJob?.name || '',
        matched_job_reference: delJob?.job_reference || '', created_job: false,
        outcome: 'deleted', log_count: deletedLogs,
        summary: `Hole ${klbHoleId} deleted — removed ${deletedLogs} log entries${delJob ? ` from ${delJob.name}` : ''}.`,
        debug_payload: debugPayload,
      });
      return Response.json({
        status: 'success', event: 'hole_deleted', hole_id: klbHoleId,
        job_id: delJob?.id || null, job_name: delJob?.name || null, deleted_logs: deletedLogs,
      });
    }

    // Accept the AGS file four ways:
    //   1. KLB webhook JSON (event_type + base64 ags_file) — the new event model.
    //   2. Multipart form upload (UI — functions.invoke with a File object).
    //   3. Raw text in a JSON body (file_content) — legacy inline path.
    //   4. A previously-uploaded file URL (file_url) — legacy fallback.
    let text: string;
    let jobId: string | null = null;
    let forceImport = false;
    if (isKlbWebhook && klbBody) {
      const agsB64 = klbBody.data?.agsFile || klbBody.ags_file || klbBody.agsFile || '';
      if (!agsB64) return Response.json({ error: 'No AGS file provided for hole event.' }, { status: 400 });
      try { text = atob(agsB64); } catch (e) {
        return Response.json({ error: 'Could not decode Base64 AGS file.' }, { status: 400 });
      }
      jobId = klbBody.job_id || null;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const filePart = formData.get('file');
      jobId = (formData.get('job_id') as string) || null;
      forceImport = formData.get('force') === 'true';
      if (!filePart) return Response.json({ error: 'An AGS file is required.' }, { status: 400 });
      text = await (filePart as File).text();
    } else if (klbBody) {
      // Legacy JSON body path (file_content or file_url) — not a KLB webhook.
      // Require an authenticated app user to prevent unauthenticated SSRF.
      if (!isExternalPush && (!user || !user.id)) {
        return Response.json({ error: 'Unauthorized — authentication required for AGS file import.' }, { status: 401 });
      }
      const fileContent = klbBody.file_content;
      const fileUrl = klbBody.file_url;
      jobId = klbBody.job_id || null;
      forceImport = klbBody.force === true;
      if (!fileContent && !fileUrl) return Response.json({ error: 'An AGS file is required.' }, { status: 400 });
      if (fileContent) {
        text = String(fileContent);
      } else {
        if (!isSafeFileUrl(fileUrl)) return Response.json({ error: 'Invalid or blocked file URL.' }, { status: 400 });
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) return Response.json({ error: 'Could not download AGS file' }, { status: 422 });
        text = await fileRes.text();
      }
    } else {
      return Response.json({ error: 'An AGS file is required.' }, { status: 400 });
    }
    const groups = parseAGS(text);
    const groupSummary = Object.entries(groups).map(([name, g]) => ({ name, row_count: g.rows.length }));

    // === TEMPORARY DEBUG CAPTURE ===
    // Capture the KLB webhook body structure (keys + value types + truncated
    // sample values) and AGS group headings/first-row samples — WITHOUT the
    // oversized base64 agsFile blob that previously caused debug_payload to
    // be stripped to null by the entity field size limit. Stored in
    // debug_payload on the webhook log so we can identify the account name
    // field KeyLogBook sends alongside the AGS file.
    let debugPayload = '';
    try {
      const activityGroupNames = ['SHFT', 'DLOG', 'HDIA', 'PTIM', 'HDPH', 'DREM', 'HORN', 'LOCA', 'PROJ'];
      const groupDebug: Record<string, any> = {};
      for (const gn of activityGroupNames) {
        const g = groups[gn];
        if (g && g.headings && g.rows.length > 0) {
          groupDebug[gn] = {
            headings: g.headings,
            firstRow: g.rows[0],
            rowCount: g.rows.length,
          };
        }
      }
      // Dump every key in the webhook body with its value type and a truncated
      // sample value — skipping the base64 agsFile blob that blows the field
      // size limit. This lets us spot the account/user name field.
      const klbBodyKeys = isKlbWebhook ? Object.keys(klbBody || {}) : [];
      const klbDataKeys = isKlbWebhook ? Object.keys(klbBody?.data || {}) : [];
      const bodyDump: Record<string, any> = {};
      if (isKlbWebhook && klbBody) {
        for (const [k, v] of Object.entries(klbBody)) {
          if (k === 'agsFile' || k === 'ags_file' || k === 'agsFileB64') continue;
          bodyDump[k] = { type: typeof v, value: typeof v === 'string' ? v.slice(0, 200) : v };
        }
        const d = klbBody.data || {};
        const dataDump: Record<string, any> = {};
        for (const [k, v] of Object.entries(d)) {
          if (k === 'agsFile' || k === 'ags_file' || k === 'agsFileB64') continue;
          dataDump[k] = { type: typeof v, value: typeof v === 'string' ? v.slice(0, 200) : v };
        }
        bodyDump.__data_keys = klbDataKeys;
        bodyDump.__data_values = dataDump;
      }
      debugPayload = JSON.stringify({
        isKlbWebhook,
        klbBodyKeys,
        klbDataKeys,
        bodyDump,
        groupDebug,
      });
    } catch (e) { debugPayload = `debug capture error: ${e.message}`; }

    // Resolve the target job
    let createdJob = false;
    let job: any = null;
    if (jobId) {
      try { job = await base44.asServiceRole.entities.Job.get(jobId); } catch (e) { job = null; }
    }
    // KLB webhook contextual fields take priority for job matching
    if (!job && isKlbWebhook && (klbProjectNumber || klbProjectName)) {
      const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
      if (klbProjectNumber) {
        const lc = klbProjectNumber.toLowerCase();
        job = allJobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === lc)
          || allJobs.find((j: any) => j.name && j.name.toLowerCase() === lc)
          || allJobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(lc));
      }
      if (!job && klbProjectName) {
        const lc = klbProjectName.toLowerCase();
        job = allJobs.find((j: any) => j.name && j.name.toLowerCase() === lc)
          || allJobs.find((j: any) => j.name && j.name.toLowerCase().includes(lc));
      }
    }
    if (!job && groups.PROJ && groups.PROJ.rows.length) {
      const proj = buildRow(groups.PROJ, groups.PROJ.rows[0]);
      const projId = pick(proj, 'PROJ_ID', 'PROJ_REF', 'PROJ_CODE', 'PROJECT_ID', 'PROJECT_NO', 'PROJECT_CODE', 'ID', 'REF');
      const projName = pick(proj, 'PROJ_NAME', 'PROJECT_NAME', 'PROJ_TITLE', 'PROJ_DESC', 'NAME', 'TITLE', 'DESC', 'PROJ_LOC', 'PROJ_CL_REF', 'PROJ_CLIENT_REF');
      if (projId || projName) {
        const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
        const candidates = [projId, projName].filter(Boolean).map(s => s.toLowerCase());
        for (const cand of candidates) {
          job = jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === cand)
            || jobs.find((j: any) => j.name && j.name.toLowerCase() === cand)
            || jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(cand))
            || jobs.find((j: any) => j.name && j.name.toLowerCase().includes(cand))
            || jobs.find((j: any) => cand.includes(j.job_reference?.toLowerCase() || '___'))
            || jobs.find((j: any) => cand.includes(j.name?.toLowerCase() || '___'));
          if (job) break;
        }
      }
    }
    if (!job) {
      // No existing job matched — do NOT auto-create one. If there's no job to
      // attach the data to, nothing happens. Log the failed outcome and reject.
      const refHint = isKlbWebhook
        ? (klbProjectNumber || klbProjectName || klbHoleId || '')
        : (groups.PROJ && groups.PROJ.rows.length
            ? pick(buildRow(groups.PROJ, groups.PROJ.rows[0]), 'PROJ_ID', 'PROJ_REF', 'PROJ_NAME', 'PROJECT_NAME', 'ID', 'REF')
            : '');
      await logWebhookRequest(base44, {
        event_type: isKlbWebhook ? klbEventType : (isExternalPush ? 'scheduled_push' : 'manual_upload'),
        hole_id: isKlbWebhook ? klbHoleId : '',
        project_name: isKlbWebhook ? klbProjectName : '',
        project_number: isKlbWebhook ? klbProjectNumber : '',
        group_summary: groupSummary,
        matched_job_id: '', matched_job_name: '', matched_job_reference: '',
        created_job: false,
        outcome: 'error',
        log_count: 0,
        summary: `No matching job found for "${refHint || '—'}" — no data imported.`,
        error: 'Could not match an existing job. No job was created.',
        debug_payload: debugPayload,
      });
      return Response.json({
        error: 'Could not match an existing job. No job was created and no data was imported.',
      }, { status: 422 });
    }

    // --- Build borehole date map (needed for driller resolution + log dating) ---
    const today = new Date().toISOString().slice(0, 10);
    const locaDates = buildLocaDates(groups, today);

    // Resolve the caller's identity for audit fields (completed_by_name). The
    // admin who uploaded is still recorded as the importer — they just aren't
    // attributed as the staff_id on the technical logs (the driller is).
    let importerName = (user?.full_name || user?.email || 'AGS Import (KeyLogBook)');

    // --- Resolve the project engineer and actual driller for this job ---
    // PROJ_ENG from the AGS file is the project engineer (NOT the driller) —
    // stored in completed_by_name with a "Project Engineer" label so managers
    // can see who engineered the borehole. The actual driller is resolved from
    // the rota assignment for the borehole's work date, preferring a drilling-
    // team staff member. If no rota assignment exists, staff_name is left blank
    // and staff_id falls back to 'ags_import' so the manager can manually
    // assign the driller during review.
    let drillerName = '';
    let drillerStaffId = '';
    let drillerRole = 'ags_import';
    let projectEngineerName = '';

    // 1) Extract PROJ_ENG from the AGS PROJ group — this is the project
    // engineer, NOT the driller. Stored separately so it can be labelled
    // correctly in completed_by_name instead of being misattributed as the
    // driller on every log entry.
    if (groups.PROJ && groups.PROJ.rows.length) {
      const projRow = buildRow(groups.PROJ, groups.PROJ.rows[0]);
      for (const h of groups.PROJ.headings) {
        const suffix = normalizeKey(h, 'PROJ');
        if (suffix === 'ENG' || suffix === 'ENGINEER') {
          const val = (projRow[h.toUpperCase()] || '').trim();
          if (val) { projectEngineerName = val; break; }
        }
      }
    }

    // 1b) Extract the actual driller name from the AGS file. KeyLogBook stores
    // the driller/user who operated the rig in DREM, HDIA, LOCA, and SHFT
    // groups. Field suffixes to look for: DRILLER, USER, OPERATOR, LOGGED_BY.
    // The first non-empty value found wins. This is the KeyLogBook user — the
    // person who actually drilled the borehole and wrote the remarks.
    const DRILLER_FIELD_SUFFIXES = ['DRILLER', 'USER', 'OPERATOR', 'LOGGED_BY', 'RECORDED_BY', 'INSPECTED_BY', 'ACCOUNT', 'USERNAME', 'DRILL', 'LOG', 'CREW'];
    // Scan for the Lead Driller name. HDPH_LOG holds the actual KeyLogBook
    // user(s) who logged the hole (e.g. "Kevin Price, Amir"). We prefer LOG
    // over CREW, and take the first comma-separated name as the Lead Driller.
    const scanGroupsForDrillerSuffix = (groupNames: string[], suffixes: string[]): string => {
      for (const gn of groupNames) {
        const g = groups[gn];
        if (!g || !g.headings || g.rows.length === 0) continue;
        for (const row of g.rows) {
          const r = buildRow(g, row);
          for (const h of g.headings) {
            const suffix = normalizeKey(h, gn);
            if (suffixes.includes(suffix)) {
              const val = (r[h.toUpperCase()] || '').trim();
              if (val && val.length > 1 && !/^(unknown|n\/?a|none|test|null)$/i.test(val)) {
                return val.split(',')[0].trim();
              }
            }
          }
        }
      }
      return '';
    };
    // Priority: HDPH_LOG (actual KLB logger) → HDPH_CREW (full crew) → other driller fields
    let agsDriller = scanGroupsForDrillerSuffix(['HDPH'], ['LOG']);
    if (!agsDriller) agsDriller = scanGroupsForDrillerSuffix(['HDPH'], ['CREW']);
    if (!agsDriller) agsDriller = scanGroupsForDrillerSuffix(['HDPH', 'DREM', 'HDIA', 'SHFT', 'DLOG', 'PTIM', 'LOCA'], DRILLER_FIELD_SUFFIXES);

    // 2) The Lead Driller is the actual KeyLogBook user who logged the hole.
    // The name comes from HDPH_LOG (resolved above). No rota-based fallback —
    // only the real KLB logger is shown on the logs.
    if (agsDriller) drillerName = agsDriller;
    drillerRole = 'driller';

    // Technical logs (ags_import) use the resolved driller's staff_id. The
    // driller name (from the AGS file or rota) is the primary attribution —
    // shown prominently as staff_name and completed_by_name. The project
    // engineer is no longer misattributed as the driller.
    const staffId = drillerStaffId || 'ags_import';
    const staffName = drillerName || '';
    const completedByName = drillerName || importerName;

    // Build a per-borehole Lead Driller map from HDPH_LOG. Each HDPH row
    // belongs to a specific borehole (LOCA_ID). HDPH_LOG holds the KLB
    // user(s) who logged that hole (e.g. "Kevin Price, Amir"). We take the
    // first comma-separated name as the Lead Driller for that borehole so
    // different boreholes drilled by different crews each show the correct
    // person.
    const boreholeDrillerMap: Record<string, string> = {};
    if (groups.HDPH && groups.HDPH.headings && groups.HDPH.rows.length) {
      for (const row of groups.HDPH.rows) {
        const r = buildRow(groups.HDPH, row);
        const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
        if (!ref || boreholeDrillerMap[ref]) continue;
        for (const h of groups.HDPH.headings) {
          if (normalizeKey(h, 'HDPH') === 'LOG') {
            const val = (r[h.toUpperCase()] || '').trim();
            if (val && val.length > 1) {
              boreholeDrillerMap[ref] = val.split(',')[0].trim();
              break;
            }
          }
        }
      }
    }

    const logs: any[] = [];
    const samplesToCreate: any[] = [];
    const seen = new Set<string>();
    const counts = { locations: 0, strata: 0, core: 0, samples: 0, spt: 0, installations: 0, waterReadings: 0, remarks: 0, duplicates: 0, samplesCreated: 0 };

    // Push a log only if it is not a duplicate of one already staged.
    const addLog = (log: any) => {
      const sig = logSignature(log);
      if (seen.has(sig)) { counts.duplicates++; return false; }
      seen.add(sig);
      // Stamp the per-borehole Lead Driller from HDPH_LOG (the actual KLB
      // user who logged that hole), overriding the file-level default.
      const refDriller = log.borehole_ref ? boreholeDrillerMap[log.borehole_ref] : null;
      if (refDriller) {
        log.staff_name = refDriller;
        log.completed_by_name = refDriller;
      }
      logs.push(log);
      return true;
    };

    let lastLocaRef = '';
    const resolveLocaRef = (r: Record<string, string>) => {
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'LOC_ID', 'ID', 'REF');
      if (id) { lastLocaRef = id; return id; }
      return lastLocaRef || '';
    };
    const resolveDate = (ref: string) => (ref && locaDates[ref]) || today;

    // ---- LOCA — borehole locations ----
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = buildRow(groups.LOCA, row);
        const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
        if (!locaId) continue;
        lastLocaRef = locaId;
        const locaType = pick(r, 'LOCA_TYPE', 'LOCA_LETT', 'TYPE', 'LETT');
        const locaDate = pick(r, 'LOCA_STAR', 'LOCA_START', 'STAR', 'LOCA_ENDD', 'LOCA_END', 'ENDD', 'LOCA_DATE', 'DATE') || today;
        const locaElev = num(pick(r, 'LOCA_GL', 'LOCA_ELEV', 'LOCA_LEVEL', 'LOCA_DATUM', 'GL', 'ELEV', 'LEVEL'));
        const locaX = pick(r, 'LOCA_NATE', 'LOCA_X', 'LOCA_EAST', 'NATE', 'EASTING', 'EAST', 'X');
        const locaY = pick(r, 'LOCA_NATN', 'LOCA_Y', 'LOCA_NORTH', 'NATN', 'NORTHING', 'NORTH', 'Y');
        const descParts = [
          `borehole ${locaId} (${locaType || 'borehole'})`,
          locaElev != null ? `, ground level ${locaElev}m` : '',
          locaX && locaY ? `, coordinates ${locaX}, ${locaY}` : '',
        ];
        // Parse LOCA_STAT → borehole_status (COMPLETE / INPROG / UNCHECKED)
        const locaStatRaw = pick(r, 'LOCA_STAT', 'STAT', 'STATUS').toUpperCase().trim();
        let boreholeStatus: string = '';
        if (locaStatRaw === 'COMPLETE' || locaStatRaw === 'COMPLETED' || locaStatRaw === 'C') boreholeStatus = 'complete';
        else if (locaStatRaw === 'INPROG' || locaStatRaw === 'IN_PROGRESS' || locaStatRaw === 'IN-PROG' || locaStatRaw === 'I') boreholeStatus = 'in_progress';
        else if (locaStatRaw === 'UNCHECKED' || locaStatRaw === 'UNCK' || locaStatRaw === 'U') boreholeStatus = 'unchecked';

        if (addLog({
          job_id: job.id, staff_id: staffId, staff_name: staffName, date: locaDate,
          log_type: 'borehole_progress', borehole_ref: locaId,
          borehole_status: boreholeStatus || undefined,
          depth_to: num(pick(r, 'LOCA_FDEP', 'LOCA_FDEPTH', 'LOCA_DEPTH', 'LOCA_FINAL_DEPTH', 'LOCA_TD', 'FDEP', 'FDEPTH', 'DEPTH', 'TD')) || null,
          groundwater_strike_depth: num(pick(r, 'LOCA_GND', 'LOCA_GW_DEPTH', 'LOCA_GWL', 'LOCA_WATER', 'GND', 'GW_DEPTH', 'GWL', 'WATER')) || null,
          description: `Imported from KeyLogBook AGS — ${descParts.join('')}.`,
          source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
          completed_by_name: completedByName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.locations++;
      }
    }

    // ---- GEOL / CHIS — strata or core runs ----
    const geolGroups = [groups.GEOL, groups.CHIS];
    for (const g of geolGroups) {
      if (g && g.rows.length) {
        const hasCoreFields = g.headings.some(h => {
          const n = normalizeKey(h, g.name);
          return n.includes('RQD') || n.includes('REC') || n.includes('RECOVERY') || n.includes('ROCK_QUALITY');
        });
        for (const row of g.rows) {
          const r = buildRow(g, row);
          const desc = pick(r, 'GEOL_DESC', 'GEOL_LEGEND', 'GEOL_GEN', 'GEOL_TERM', 'GEOL_GEOL', 'CHIS_DESC', 'CHIS_LEGEND', 'DESC', 'DESCRIPTION', 'LEGEND', 'GEN', 'TERM', 'GEOL');
          if (!desc) continue;
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'GEOL_TOP', 'CHIS_TOP', 'TOP', 'DEPTH_FROM', 'DEPTH_TOP', 'TOP_DEPTH', 'FROM'));
          const dTo = num(pick(r, 'GEOL_BASE', 'GEOL_BOT', 'CHIS_BASE', 'CHIS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'DEPTH_BASE', 'BOT_DEPTH', 'TO'));
          const logDate = resolveDate(ref);

          if (hasCoreFields) {
            const rqd = num(pick(r, 'GEOL_RQD', 'RQD', 'CORE_RQD', 'ROCK_QUALITY'));
            const recovery = num(pick(r, 'GEOL_REC', 'GEOL_RECOVERY', 'GEOL_PER_REC', 'CORE_REC', 'REC', 'RECOVERY', 'PER_REC'));
            const runNo = pick(r, 'GEOL_RUN', 'GEOL_RUN_NO', 'CORE_RUN', 'RUN_NO', 'RUN');
            const boxNo = pick(r, 'GEOL_BOX', 'GEOL_BOX_NO', 'CORE_BOX', 'BOX_NO', 'BOX');
            if (addLog({
              job_id: job.id, staff_id: staffId, staff_name: staffName, date: logDate,
              log_type: 'core_inspection', borehole_ref: ref,
              core_run_number: runNo || null, core_box_number: boxNo || null,
              depth_from: dFrom || null, depth_to: dTo || null,
              coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: desc,
              description: `Imported from KeyLogBook AGS — core run${runNo ? ` ${runNo}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.`,
              source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
              completed_by_name: completedByName,
              manager_review_status: 'approved', chargeable: false,
            })) counts.core++;
          } else {
            if (addLog({
              job_id: job.id, staff_id: staffId, staff_name: staffName, date: logDate,
              log_type: 'borehole_progress', borehole_ref: ref,
              depth_from: dFrom || null, depth_to: dTo || null,
              strata_descriptor: mapStrataDescriptor(desc), strata_description_detail: desc,
              description: 'Imported from KeyLogBook AGS — strata.',
              source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
              completed_by_name: completedByName,
              manager_review_status: 'approved', chargeable: false,
            })) counts.strata++;
          }
        }
      }
    }

    // ---- CORE — rotary core runs ----
    if (groups.CORE && groups.CORE.rows.length) {
      for (const row of groups.CORE.rows) {
        const r = buildRow(groups.CORE, row);
        const coreId = pick(r, 'CORE_ID', 'CORE_REF', 'CORE_NO', 'ID', 'REF');
        const runNo = pick(r, 'CORE_RUN', 'CORE_RUN_NO', 'RUN_NO', 'RUN');
        const boxNo = pick(r, 'CORE_BOX', 'CORE_BOX_NO', 'CORE_BOXES', 'BOX_NO', 'BOX');
        const rqd = num(pick(r, 'CORE_RQD', 'RQD', 'CORE_ROCK_QUALITY', 'ROCK_QUALITY'));
        const recovery = num(pick(r, 'CORE_REC', 'CORE_RECOVERY', 'CORE_PER_REC', 'CORE_RECOVERY_PCT', 'CORE_REC_PCT', 'REC', 'RECOVERY', 'PER_REC'));
        const coreDesc = pick(r, 'CORE_DESC', 'CORE_LEGEND', 'CORE_REM', 'CORE_NOTE', 'CORE_NOTES', 'DESC', 'LEGEND', 'REM', 'NOTE', 'NOTES');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'CORE_TOP', 'CORE_FROM', 'CORE_DEPTH_FROM', 'CORE_TOP_DEPTH', 'TOP', 'FROM', 'DEPTH_FROM'));
        const dTo = num(pick(r, 'CORE_BASE', 'CORE_BOT', 'CORE_BOTTOM', 'CORE_TO', 'CORE_DEPTH_TO', 'CORE_BOT_DEPTH', 'BASE', 'BOT', 'TO', 'DEPTH_TO'));
        if (addLog({
          job_id: job.id, staff_id: staffId, staff_name: staffName, date: resolveDate(ref),
          log_type: 'core_inspection', borehole_ref: ref,
          core_run_number: runNo || coreId || null, core_box_number: boxNo || null,
          depth_from: dFrom || null, depth_to: dTo || null,
          coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: coreDesc || null,
          description: `Imported from KeyLogBook AGS — core run${runNo || coreId ? ` ${runNo || coreId}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.${coreDesc ? ' ' + coreDesc : ''}`,
          source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
          completed_by_name: completedByName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.core++;
      }
    }

    // ---- SAMP — samples ----
    // Also auto-creates Sample entity records so the driver's sample-collection
    // flow picks them up automatically. The Sample is linked back to the
    // InvestigationLog via investigation_log_id after both are created.
    if (groups.SAMP && groups.SAMP.rows.length) {
      for (const row of groups.SAMP.rows) {
        const r = buildRow(groups.SAMP, row);
        const sampId = pick(r, 'SAMP_ID', 'SAMP_REF', 'SAMP_NO', 'SAMPLE_ID', 'SAMPLE_REF', 'ID', 'REF');
        const sampType = pick(r, 'SAMP_TYPE', 'SAMPLE_TYPE', 'TYPE');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'SAMP_TOP', 'SAMP_DEP', 'SAMP_DEPTH', 'TOP', 'DEPTH', 'DEPTH_FROM', 'DEP', 'FROM'));
        const dTo = num(pick(r, 'SAMP_BOT', 'SAMP_BASE', 'SAMP_BOTTOM', 'BASE', 'BOT', 'TO', 'DEPTH_TO'));
        const collectionDate = resolveDate(ref);
        const logAdded = addLog({
          job_id: job.id, staff_id: staffId, staff_name: staffName, date: collectionDate,
          log_type: 'sample_collection', borehole_ref: ref,
          sample_id: sampId, depth_from: dFrom || null,
          sample_type: mapSampleType(sampType),
          description: `Imported from KeyLogBook AGS — sample ${sampId} (${sampType}).`,
          source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
          completed_by_name: completedByName,
          manager_review_status: 'approved', chargeable: false,
        });
        if (logAdded) {
          counts.samples++;
          // Stage a Sample entity record — the driver's collection list is built from these.
          const fallbackId = `${ref || 'BH'}-S-${dFrom != null ? dFrom.toFixed(1) : samplesToCreate.length + 1}`;
          samplesToCreate.push({
            job_id: job.id,
            borehole_ref: ref || null,
            sample_id: sampId || fallbackId,
            sample_type: mapSampleEntityType(sampType),
            depth_from: dFrom || null,
            depth_to: dTo || null,
            collection_date: collectionDate,
            collected_by_staff_id: staffId || null,
            collected_by_name: importerName || null,
            container_type: 'bag',
            status: 'collected',
            status_changed_at: new Date().toISOString(),
            notes: 'Auto-created from KeyLogBook AGS import',
          });
        }
      }
    }

    // ---- SPT / DENS / ISPT — penetration tests ----
    const sptGroups = [groups.SPT, groups.DENS, groups.ISPT];
    for (const g of sptGroups) {
      if (g && g.rows.length) {
        for (const row of g.rows) {
          const r = buildRow(g, row);
          const blows = [
            pick(r, 'SPT_BL1', 'SPT_BLOW1', 'SPT_BLOWS_1', 'SPT_N1', 'BL1', 'BLOW1', 'BL_1', 'BLOWS_1', 'N1'),
            pick(r, 'SPT_BL2', 'SPT_BLOW2', 'SPT_BLOWS_2', 'SPT_N2', 'BL2', 'BLOW2', 'BL_2', 'BLOWS_2', 'N2'),
            pick(r, 'SPT_BL3', 'SPT_BLOW3', 'SPT_BLOWS_3', 'SPT_N3', 'BL3', 'BLOW3', 'BL_3', 'BLOWS_3', 'N3'),
            pick(r, 'SPT_BL4', 'SPT_BLOW4', 'SPT_BLOWS_4', 'SPT_N4', 'BL4', 'BLOW4', 'BL_4', 'BLOWS_4', 'N4'),
          ].map(b => num(b)).filter((b): b is number => b != null);
          const nval = num(pick(r, 'SPT_NVAL', 'SPT_N', 'SPT_N_VALUE', 'NVAL', 'N_VALUE', 'N'))
            || (blows.length >= 3 ? blows[1] + blows[2] : (blows.length === 2 ? blows[0] + blows[1] : (blows.length === 1 ? blows[0] : null)));
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'SPT_TOP', 'SPT_DEPTH', 'DENS_TOP', 'TOP', 'DEPTH_FROM', 'DEP', 'FROM'));
          const dTo = num(pick(r, 'SPT_BASE', 'SPT_BOT', 'DENS_BASE', 'DENS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
          if (addLog({
            job_id: job.id, staff_id: staffId, staff_name: staffName, date: resolveDate(ref),
            log_type: 'borehole_progress', borehole_ref: ref,
            depth_from: dFrom || null, depth_to: dTo || null,
            spt_blows: blows, spt_n_value: nval,
            description: `Imported from KeyLogBook AGS — SPT (N=${nval != null ? nval : 'n/a'}).`,
            source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
            completed_by_name: completedByName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.spt++;
        }
      }
    }

    // ---- TREM — installation / tremie pipes (or driller daily-activity text) ----
    if (groups.TREM && groups.TREM.rows.length) {
      for (const row of groups.TREM.rows) {
        const r = buildRow(groups.TREM, row);
        const tremId = pick(r, 'TREM_ID', 'TREM_REF', 'TREM_NO', 'PIPE_ID', 'INSTALL_ID', 'ID', 'REF');
        const tremType = pick(r, 'TREM_TYPE', 'TYPE');
        const tremMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MAT', 'MATERIAL');
        const tremDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER', 'DIA');
        const tremDesc = pick(r, 'TREM_DESC', 'TREM_REM', 'TREM_LEGEND', 'TREM_NOTE', 'DESC', 'DESCRIPTION', 'REMARK', 'LEGEND', 'NOTE', 'REM');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'TREM_TOP', 'TOP', 'DEPTH_FROM', 'FROM'));
        const dTo = num(pick(r, 'TREM_BASE', 'TREM_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));

        // KeyLogBook sometimes stores the driller's shift diary ("Set up rig",
        // "Lunch", "Travelled home") in TREM rows that have no real
        // installation attributes. Route those to the Site Logs instead of
        // creating fake installation records.
        const hasInstallAttrs = !!(tremType || tremMat || tremDiam || (dFrom != null && dTo != null && dTo > dFrom));
        // Diary rows (no installation attributes) are now handled by
        // parseStructuredTimeGroups which reads TREM_DTIM/TREM_ETIM/
        // TREM_DURN/TREM_REM directly. Skip them here so they don't
        // create fake installation records in the Borehole Data tab.
        if (!hasInstallAttrs) continue;

        const parts = [tremType, tremMat, tremDiam ? `${tremDiam}mm` : ''].filter(Boolean);
        const summary = parts.length > 0 ? parts.join(' · ') : 'Installation pipe';
        const detail = tremDesc ? `${summary} — ${tremDesc}` : summary;
        if (addLog({
          job_id: job.id, staff_id: staffId, staff_name: staffName, date: resolveDate(ref),
          log_type: 'installation', borehole_ref: ref, standpipe_ref: tremId || null,
          depth_from: dFrom || null, depth_to: dTo || null,
          description: `Imported from KeyLogBook AGS — installation pipe${tremId ? ` ${tremId}` : ''}: ${detail}.`,
          source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
          completed_by_name: completedByName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.installations++;
      }
    }

    // ---- WSTG — standpipe installations + groundwater readings ----
    if (groups.WSTG && groups.WSTG.rows.length) {
      for (const row of groups.WSTG.rows) {
        const r = buildRow(groups.WSTG, row);
        const wstgId = pick(r, 'WSTG_ID', 'WSTG_REF', 'WSTG_NO', 'PIPE_ID', 'STANDPIPE_ID', 'ID', 'REF');
        const wstgType = pick(r, 'WSTG_TYPE', 'TYPE');
        const wstgMat = pick(r, 'WSTG_MAT', 'WSTG_MATERIAL', 'MAT', 'MATERIAL');
        const wstgDiam = pick(r, 'WSTG_DIA', 'WSTG_DIAM', 'DIAM', 'DIAMETER', 'DIA');
        const wstgDesc = pick(r, 'WSTG_DESC', 'WSTG_REM', 'WSTG_LEGEND', 'WSTG_NOTE', 'DESC', 'DESCRIPTION', 'REMARK', 'LEGEND', 'NOTE', 'REM');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'WSTG_TOP', 'TOP', 'DEPTH_FROM', 'FROM'));
        const dTo = num(pick(r, 'WSTG_BASE', 'WSTG_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
        const waterLevel = num(pick(r, 'WSTG_DP', 'WSTG_READ', 'WSTG_DEPTH', 'WSTG_LEVEL', 'WSTG_WLEVEL', 'WATER_DEPTH', 'DP', 'READ', 'LEVEL', 'WLEVEL', 'DEPTH'));
        const readDate = pick(r, 'WSTG_DATE', 'WSTG_READ_DATE', 'WSTG_DP_DATE', 'DATE', 'READ_DATE');
        const logDate = resolveDate(ref);

        if (wstgType || wstgMat || wstgDiam || dFrom != null || dTo != null) {
          const parts = [wstgType, wstgMat, wstgDiam ? `${wstgDiam}mm` : ''].filter(Boolean);
          const summary = parts.length > 0 ? parts.join(' · ') : 'Standpipe installation';
          const detail = wstgDesc ? `${summary} — ${wstgDesc}` : summary;
          if (addLog({
            job_id: job.id, staff_id: staffId, staff_name: staffName, date: logDate,
            log_type: 'installation', borehole_ref: ref, standpipe_ref: wstgId || null,
            depth_from: dFrom, depth_to: dTo,
            description: `Imported from KeyLogBook AGS — standpipe${wstgId ? ` ${wstgId}` : ''}: ${detail}.`,
            source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
            completed_by_name: completedByName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.installations++;
        }

        if (waterLevel != null) {
          if (addLog({
            job_id: job.id, staff_id: staffId, staff_name: staffName, date: readDate || logDate,
            log_type: 'standpipe_reading', borehole_ref: ref, standpipe_ref: wstgId || null,
            standpipe_reading_m: waterLevel,
            description: `Imported from KeyLogBook AGS — groundwater monitoring reading: ${waterLevel}mBGL${wstgId ? ` on standpipe ${wstgId}` : ''}.`,
            source: 'ags_import', logged_by_role: drillerRole, completed_by_type: 'internal_staff',
            completed_by_name: completedByName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.waterReadings++;
        }
      }
    }

    // ---- Driller remarks (daily diary) — same pipeline as the webhook ----
    // Two sources of driller activities:
    //   1. Structured time groups (DLOG, PTIM, DREM, SHFT, HORN) — have proper
    //      start_time / end_time columns. These are the preferred source when
    //      available because they always have times.
    //   2. Remark text (*_REM fields, REMARK/DIARY groups) — may have inline
    //      HH:MM_HH:MM patterns. When the structured groups cover a borehole+
    //      date, we skip the remark text for that combination to avoid
    //      duplicates. Otherwise we fall back to remark text parsing.
    const shiftWindows = buildShiftWindows(groups);
    const structuredActivities = parseStructuredTimeGroups(groups, shiftWindows);
    const { lookup: timeLookup, keys: structuredKeys } = buildTimeLookup(structuredActivities);

    const rawChunks = extractRemarkChunks(groups);
    const remarkChunks = assignChunkDates(rawChunks, locaDates, job.start_date || today, today);

    // Filter out remark chunks that are covered by structured time groups
    // (same borehole+date) — the structured groups have proper times and will
    // be saved separately. This prevents duplicate activities.
    const uncoveredChunks = remarkChunks.filter(c => {
      const key = `${c.borehole_ref || ''}|${c.date || ''}`;
      return !structuredKeys.has(key);
    });

    if (structuredActivities.length > 0) {
      // Professionalise the structured activity descriptions in a single LLM call
      const activitiesToClean = structuredActivities.map(a => ({
        start_time: a.start_time,
        end_time: a.end_time,
        duration_minutes: a.duration_minutes,
        raw_description: a.description,
      }));
      const cleanedDescs = await professionaliseActivities(base44, activitiesToClean);

      structuredActivities.forEach((sa, i) => {
        const cleanDesc = cleanedDescs[i] || sa.description;
        if (addLog({
          job_id: job.id,
          staff_id: drillerStaffId || staffId,
          staff_name: drillerName || importerName,
          date: sa.date || today,
          log_type: 'other',
          borehole_ref: sa.borehole_ref || null,
          source: 'keylogbook_remarks',
          logged_by_role: 'driller',
          start_time: sa.start_time || undefined,
          end_time: sa.end_time || undefined,
          duration_minutes: sa.duration_minutes || undefined,
          description: cleanDesc || sa.description || 'Driller activity',
          raw_remarks: sa.description,
          completed_by_type: 'internal_staff',
          completed_by_name: drillerName || importerName,
          manager_review_status: 'pending',
          chargeable: false,
          billing_status: 'no_charge',
        })) counts.remarks++;
      });
    }

    if (uncoveredChunks.length > 0) {
      // Build the staged remark entries from chunks NOT covered by structured
      // time groups. Timed chunks parse into individual time-stamped activities
      // (AI-professionalised in one call); plain (non-timed) remarks become a
      // single entry each so they still reach the Site Logs tab.
      const staged: { date: string; borehole_ref: string; start_time?: string; end_time?: string; duration_minutes?: number; description: string }[] = [];
      const activitiesToClean: any[] = [];
      const activityIndexes: number[] = [];
      for (const chunk of uncoveredChunks) {
        const ref = chunk.borehole_ref || (isKlbWebhook ? klbHoleId : '') || null;
        if (chunk.timed) {
          const acts = parseRemarks(chunk.text);
          for (const a of acts) {
            activityIndexes.push(staged.length);
            activitiesToClean.push(a);
            staged.push({ date: chunk.date, borehole_ref: ref, start_time: a.start_time, end_time: a.end_time, duration_minutes: a.duration_minutes, description: '', raw_remarks: a.raw_description });
          }
          // Edge: a timed chunk that parsed to zero activities — keep the raw text as a plain entry.
          if (acts.length === 0) staged.push({ date: chunk.date, borehole_ref: ref, description: chunk.text, raw_remarks: chunk.text });
        } else {
          staged.push({ date: chunk.date, borehole_ref: ref, description: chunk.text, raw_remarks: chunk.text });
        }
      }

      const cleaned = activitiesToClean.length > 0 ? await professionaliseActivities(base44, activitiesToClean) : [];
      activityIndexes.forEach((idx, i) => {
        staged[idx].description = cleaned[i] || activitiesToClean[i].raw_description;
      });

      staged.forEach((r) => {
        if (addLog({
          job_id: job.id,
          staff_id: drillerStaffId || staffId,
          staff_name: drillerName || importerName,
          date: r.date,
          log_type: 'other',
          borehole_ref: r.borehole_ref || null,
          source: 'keylogbook_remarks',
          logged_by_role: 'driller',
          start_time: r.start_time,
          end_time: r.end_time,
          duration_minutes: r.duration_minutes,
          description: r.description,
          raw_remarks: r.raw_remarks,
          completed_by_type: 'internal_staff',
          completed_by_name: drillerName || importerName,
          manager_review_status: 'pending',
          chargeable: false,
          billing_status: 'no_charge',
        })) counts.remarks++;
      });
    }

    if (logs.length === 0) {
      const found = Object.keys(groups).sort().join(', ');
      await logWebhookRequest(base44, {
        event_type: isKlbWebhook ? klbEventType : (isExternalPush ? 'scheduled_push' : 'manual_upload'),
        hole_id: isKlbWebhook ? klbHoleId : '', project_name: isKlbWebhook ? klbProjectName : '', project_number: isKlbWebhook ? klbProjectNumber : '',
        group_summary: groupSummary, matched_job_id: job.id, matched_job_name: job.name,
        matched_job_reference: job.job_reference || '', created_job: createdJob,
        outcome: 'no_data', log_count: 0,
        summary: `No LOCA/GEOL/CORE/SAMP/SPT/TREM/WSTG records found. Groups: ${found || '(none)'}.`,
        error: 'No data groups found in AGS file.',
        debug_payload: debugPayload,
      });
      return Response.json({
        error: `No LOCA, GEOL, CORE, SAMP, SPT/ISPT, TREM or WSTG records were found in this AGS file. Groups found: ${found || '(none)'}.`
      }, { status: 422 });
    }

    // Merge duplicate-time keylogbook_remarks activities (same borehole +
    // start_time) into single entries so structured-time groups and remark
    // text never produce overlapping records. Keeps the longest duration and
    // latest end_time so timesheet totals stay accurate.
    const klbLogs = logs.filter(l => l.source === 'keylogbook_remarks');
    if (klbLogs.length > 1) {
      const nonKlb = logs.filter(l => l.source !== 'keylogbook_remarks');
      const mergedKlb = mergeDuplicateLogs(klbLogs);
      logs.length = 0;
      logs.push(...nonKlb, ...mergedKlb);
    }

    // Organise: sort by date, then start time, then borehole ref so the
    // imported logs read chronologically day-by-day, activity-by-activity.
    logs.sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      const at = timeToMins(a.start_time);
      const bt = timeToMins(b.start_time);
      // Activities with a real time sort by clock order; entries without a
      // time (borehole/strata/sample logs) sort after the timed activities.
      const av = at != null ? at : 9999;
      const bv = bt != null ? bt : 9999;
      if (av !== bv) return av - bv;
      const bhCompare = (a.borehole_ref || '').localeCompare(b.borehole_ref || '');
      if (bhCompare !== 0) return bhCompare;
      // Final tiebreaker for full determinism when borehole + date match
      return (a.description || '').localeCompare(b.description || '');
    });

    // ---- Borehole-scoped overwrite ----
    // Collect the set of borehole refs present in this file. The overwrite
    // delete only removes existing logs for these boreholes — boreholes not
    // in the file are left untouched. Logs with a blank borehole_ref (project-
    // level remarks, undated diary with no ref) are scoped to a blank-ref
    // bucket so they're replaced without touching real-ref logs.
    const refsInFile = [...new Set(logs.map((l: any) => l.borehole_ref).filter(Boolean))];
    const hasBlankRef = logs.some((l: any) => !l.borehole_ref);
    const refListLabel = refsInFile.length > 0 ? refsInFile.join(', ') : '(blank ref)';

    // Build a scoped filter that matches only the boreholes in this file.
    const buildScopedFilter = (source: string) => {
      const filter: any = { job_id: job.id, source };
      const orConds: any[] = [];
      if (refsInFile.length > 0) orConds.push({ borehole_ref: { $in: refsInFile } });
      if (hasBlankRef) orConds.push({ borehole_ref: { $in: ['', null] } });
      if (orConds.length === 1) Object.assign(filter, orConds[0]);
      else if (orConds.length > 1) filter.$or = orConds;
      return filter;
    };

    // ---- Overwrite safeguard (borehole-scoped) ----
    // Warn when a manual re-import would replace a larger existing dataset
    // with a smaller one — scoped to the boreholes in this file only, so a
    // single-borehole re-upload doesn't false-trigger against a job with
    // many boreholes. Only applies to manual uploads (not webhooks).
    const newLogCount = logs.length;
    let existingScopedCount = 0;
    if (!isKlbWebhook && !forceImport) {
      try {
        const existingAgs = await base44.asServiceRole.entities.InvestigationLog.filter(buildScopedFilter('ags_import'));
        const existingRem = await base44.asServiceRole.entities.InvestigationLog.filter(buildScopedFilter('keylogbook_remarks'));
        existingScopedCount = existingAgs.length + existingRem.length;
      } catch (e) { /* continue */ }
    }
    if (!isKlbWebhook && !forceImport && existingScopedCount > 10 && newLogCount < existingScopedCount * 0.5) {
      await logWebhookRequest(base44, {
        event_type: 'manual_upload',
        hole_id: '', project_name: '', project_number: '',
        group_summary: groupSummary, matched_job_id: job.id, matched_job_name: job.name,
        matched_job_reference: job.job_reference || '', created_job: false,
        outcome: 'error', log_count: 0,
        summary: `Overwrite safeguard: file has ${newLogCount} entries but ${existingScopedCount} exist for [${refListLabel}] — confirmation required.`,
        error: `needsConfirmation: ${newLogCount} new vs ${existingScopedCount} existing (scoped to ${refListLabel})`,
        debug_payload: '',
      });
      return Response.json({
        needsConfirmation: true,
        existingCount: existingScopedCount,
        newCount: newLogCount,
        error: `This file contains ${newLogCount} entries but ${existingScopedCount} already exist for borehole(s) [${refListLabel}]. Re-importing will replace the existing data for those boreholes. Continue?`,
      }, { status: 409 });
    }

    // Borehole-scoped overwrite: delete existing ags_import + keylogbook_remarks
    // logs for only the boreholes in this file, then insert the new set.
    let deletedCount = 0;
    for (const source of ['ags_import', 'keylogbook_remarks']) {
      try {
        const existing = await base44.asServiceRole.entities.InvestigationLog.filter(buildScopedFilter(source));
        if (existing.length > 0) {
          await base44.asServiceRole.entities.InvestigationLog.deleteMany(buildScopedFilter(source));
          deletedCount += existing.length;
        }
      } catch (e) { /* continue with insert */ }
    }

    let inserted = 0;
    const createdLogs: any[] = [];
    for (let i = 0; i < logs.length; i += 500) {
      const batch = logs.slice(i, i + 500);
      const result = await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
      inserted += batch.length;
      if (Array.isArray(result)) createdLogs.push(...result);
    }

    // ---- Auto-create Sample entity records from KeyLogBook SAMP groups ----
    // Each Sample is linked back to its InvestigationLog (sample_collection log)
    // so the Geotech tab and driver's collection flow stay in sync. Existing
    // samples (matched by job_id + sample_id) are skipped to avoid duplicates
    // on re-imports.
    if (samplesToCreate.length > 0) {
      const sampleFilter: any = { job_id: job.id };
      const sampleOrConds: any[] = [];
      if (refsInFile.length > 0) sampleOrConds.push({ borehole_ref: { $in: refsInFile } });
      if (hasBlankRef) sampleOrConds.push({ borehole_ref: { $in: ['', null] } });
      if (sampleOrConds.length === 1) Object.assign(sampleFilter, sampleOrConds[0]);
      else if (sampleOrConds.length > 1) sampleFilter.$or = sampleOrConds;
      const existingSamples = await base44.asServiceRole.entities.Sample.filter(sampleFilter);
      const existingKeys = new Set(existingSamples.map((s: any) => `${s.job_id}|${s.sample_id}`));

      // Match staged samples to their created InvestigationLog by sample_id + borehole_ref
      const logMap = new Map<string, string>();
      for (const cl of createdLogs) {
        if (cl.log_type === 'sample_collection' && cl.sample_id) {
          logMap.set(`${cl.sample_id}|${cl.borehole_ref || ''}`, cl.id);
        }
      }

      const newSamples = samplesToCreate.filter((s) => {
        const key = `${s.job_id}|${s.sample_id}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key); // prevent intra-batch duplicates
        // Link to the InvestigationLog if we can match it
        const logId = logMap.get(`${s.sample_id}|${s.borehole_ref || ''}`);
        if (logId) s.investigation_log_id = logId;
        return true;
      });

      for (let i = 0; i < newSamples.length; i += 500) {
        const batch = newSamples.slice(i, i + 500);
        await base44.asServiceRole.entities.Sample.bulkCreate(batch);
        counts.samplesCreated += batch.length;
      }
    }

    const groupDebug: Record<string, string[]> = {};
    for (const [name, g] of Object.entries(groups)) {
      if (g.headings && g.headings.length > 0) groupDebug[name] = g.headings;
    }

    // --- Record the sync status for automated pushes ---
    if (isExternalPush && agsSyncConfig?.id) {
      try {
        await base44.asServiceRole.entities.KeyLogBookConfig.update(agsSyncConfig.id, {
          last_ags_sync_at: new Date().toISOString(),
          last_ags_sync_status: 'success',
          last_ags_sync_summary: `Imported ${inserted} log entries into ${job.name}${refsInFile.length > 0 ? ` (${refListLabel})` : ''}.`,
        });
      } catch (e) { /* best-effort status update */ }
    }

    await logWebhookRequest(base44, {
      event_type: isKlbWebhook ? klbEventType : (isExternalPush ? 'scheduled_push' : 'manual_upload'),
      hole_id: isKlbWebhook ? klbHoleId : '', project_name: isKlbWebhook ? klbProjectName : '', project_number: isKlbWebhook ? klbProjectNumber : '',
      group_summary: groupSummary, matched_job_id: job.id, matched_job_name: job.name,
      matched_job_reference: job.job_reference || '', created_job: createdJob,
      outcome: 'success', log_count: inserted,
      summary: `Imported ${inserted} log entries into ${job.name}${refsInFile.length > 0 ? ` (${refListLabel})` : ''}.`,
      debug_payload: debugPayload,
    });
    return Response.json({
      status: 'success', job_id: job.id, job_name: job.name,
      job_reference: job.job_reference, created_job: createdJob,
      deleted: deletedCount, inserted, scoped_boreholes: refsInFile,
      duplicates: counts.duplicates, counts, samples_created: counts.samplesCreated, groups: groupDebug,
    });
  } catch (error) {
    // Record failed sync for automated pushes
    if (isExternalPush && agsSyncConfig?.id) {
      try {
        await base44.asServiceRole.entities.KeyLogBookConfig.update(agsSyncConfig.id, {
          last_ags_sync_at: new Date().toISOString(),
          last_ags_sync_status: 'failed',
          last_ags_sync_summary: error.message?.slice(0, 200) || 'Processing error',
        });
      } catch (e) { /* best-effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});