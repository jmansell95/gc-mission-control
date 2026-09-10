// ============================================================
// Site Log Utilities — activity type detection + date helpers
// ============================================================

// --- Activity type auto-detection from description keywords ---
const TAG_RULES = [
  { type: 'drilling', label: 'Drilling', color: 'blue', keywords: ['drill', 'borehole', 'rig', 'auger', 'casing', 'core', 'rotary', 'percussion', 'meterage', 'metrage', 'm drilled', 'chiselling'] },
  { type: 'breakdown', label: 'Breakdown', color: 'rose', keywords: ['breakdown', 'break down', 'repair', 'fault', 'broken', 'maintenance', 'mechanical', 'hydraulic'] },
  { type: 'standby', label: 'Standby', color: 'amber', keywords: ['standby', 'stand by', 'waiting', 'wait', 'delay', 'held up', 'stand down'] },
  { type: 'travel', label: 'Travel', color: 'violet', keywords: ['travel', 'mobilise', 'mobilize', 'depart', 'drive', 'journey', 'en route', 'on route', 'de-mobilise', 'demobilise'] },
  { type: 'setup', label: 'Setup', color: 'emerald', keywords: ['setup', 'set up', 'brief', 'induction', 'sign in', 'heras', 'fence', 'welfare', 'arrive on site', 'rig set'] },
  { type: 'break', label: 'Break', color: 'slate', keywords: ['lunch', 'break', 'tea break', 'rest'] },
  { type: 'grouting', label: 'Grouting', color: 'teal', keywords: ['grout', 'backfill', 'seal', 'install', 'standpipe', 'response', 'piezometer'] },
  { type: 'sampling', label: 'Sampling', color: 'cyan', keywords: ['sample', 'spt', 'coreliner', 'bag', 'spoil', 'disturbed', 'undisturbed', 'water sample'] },
];

export function detectActivityType(description) {
  if (!description) return { type: 'other', label: 'Other', color: 'slate' };
  const lower = description.toLowerCase();
  for (const rule of TAG_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { type: rule.type, label: rule.label, color: rule.color };
    }
  }
  return { type: 'other', label: 'Other', color: 'slate' };
}

export const TAG_COLORS = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
};

export const ALL_TAG_TYPES = TAG_RULES.map(r => ({ type: r.type, label: r.label, color: r.color }));

// --- Europe/London date helper ---
export function londonDateStr(offsetDays = 0) {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

// Format a date string (YYYY-MM-DD) as a readable UK date (e.g. "Mon, 9 Sep 2026")
export function formatLondonDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr + 'T00:00:00'));
  } catch {
    return dateStr;
  }
}

// Merge logs that share the same borehole_ref + start_time into a single
// virtual row for display. Combines descriptions and raw_remarks, keeps the
// longest duration / latest end time. Display-only — stored records are not
// altered (the backend parser merge handles future imports cleanly).
export function mergeDuplicateLogs(logs) {
  if (!logs || logs.length <= 1) return logs;
  const groups = new Map();
  for (const l of logs) {
    const key = `${l.borehole_ref || ''}|${l.start_time || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const merged = [];
  for (const group of groups.values()) {
    if (group.length === 1) { merged.push(group[0]); continue; }
    const descs = [...new Set(group.map(l => (l.description || '').trim()).filter(Boolean))];
    const raws = [...new Set(group.map(l => (l.raw_remarks || '').trim()).filter(Boolean))];
    let bestDuration = 0, latestEnd = '';
    for (const l of group) {
      if ((l.duration_minutes || 0) > bestDuration) bestDuration = l.duration_minutes || 0;
      if (l.end_time && (!latestEnd || l.end_time > latestEnd)) latestEnd = l.end_time;
    }
    merged.push({
      ...group[0],
      description: descs.join(' · '),
      raw_remarks: raws.join(' · ') || descs.join(' · '),
      end_time: latestEnd || group[0].end_time,
      duration_minutes: bestDuration,
      _mergedCount: group.length,
    });
  }
  return merged;
}