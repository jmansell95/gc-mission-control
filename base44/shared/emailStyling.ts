// =============================================================================
// GC Mission Control — Unified Email Design Kit (v2 — Expanded)
// =============================================================================
// Single source of truth for every email the platform sends. Every backend
// email function and EmailTemplate render routes its content through
// `brandedWrapper()`. This guarantees a consistent, modern, branded look across
// all outgoing emails — header, footer, tables, pills, buttons, cards,
// stat tiles, progress bars, help tips, and a rotating safety-tip strip.
//
// Brand: Ground Control dark green (#2E5A1A) + leaf accent (#8DC63F).
// All sender/brand strings say "GC Mission Control".
//
// v2 additions: headerVariant, statTile, statTileRow, progressBar, helpTip,
//   iconBadge, safetyTipStrip (rotating by day), twoColumnRow, summaryCard,
//   bulletList, timelineItem, metricGrid.
// =============================================================================

export const BRAND = {
  name: 'GC Mission Control',
  primary: '#2E5A1A',
  primaryDark: '#1c4a12',
  primaryLight: '#4d7c2a',
  accent: '#8DC63F',
  accentSoft: '#f0f7e8',
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
  emerald: '#059669',
  emeraldDark: '#047857',
  emeraldSoft: '#ecfdf5',
  amber: '#d97706',
  amberDark: '#b45309',
  amberSoft: '#fffbeb',
  rose: '#e11d48',
  roseDark: '#be123c',
  roseSoft: '#fff1f2',
  blue: '#2563eb',
  blueDark: '#1d4ed8',
  blueSoft: '#eff6ff',
  violet: '#7c3aed',
  violetSoft: '#f5f3ff',
};

// Header variant colours — used by brandedWrapper(opts.headerVariant)
export const HEADER_VARIANTS = {
  brand:    { bg: '#2E5A1A', accent: '#8DC63F', subtitle: '#8DC63F' },
  emerald:  { bg: '#047857', accent: '#6ee7b7', subtitle: '#a7f3d0' },
  amber:    { bg: '#b45309', accent: '#fcd34d', subtitle: '#fde68a' },
  rose:     { bg: '#be123c', accent: '#fda4af', subtitle: '#fecdd3' },
  blue:     { bg: '#1d4ed8', accent: '#93c5fd', subtitle: '#bfdbfe' },
  violet:   { bg: '#6d28d9', accent: '#c4b5fd', subtitle: '#ddd6fe' },
  slate:    { bg: '#334155', accent: '#94a3b8', subtitle: '#cbd5e1' },
};

// ── Escaping ──────────────────────────────────────────────────────────────
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── App base URL ──────────────────────────────────────────────────────────
export async function getAppBaseUrl(base44) {
  try {
    const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' });
    return (list[0] && list[0].app_base_url) || '';
  } catch (e) {
    return '';
  }
}

// ── Date parsing (YYYY-MM or YYYY-MM-DD → Date at local midnight) ──────────
export function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function formatGBP(n) {
  return '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// =============================================================================
// Building blocks — composable HTML helpers
// =============================================================================

// CTA button — branded pill button
export function ctaButton(url, label, opts?) {
  if (!url) return '';
  const bg = (opts && opts.bg) || BRAND.primary;
  const full = (opts && opts.fullWidth) ? 'display:block;text-align:center;' : 'display:inline-block;';
  return `<a href="${escapeHtml(url)}" style="${full}background:${bg};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2px;border:1px solid ${bg};">${escapeHtml(label)}</a>`;
}

// Secondary/ghost button
export function ghostButton(url, label) {
  if (!url) return '';
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:transparent;color:${BRAND.primary};text-decoration:none;padding:11px 24px;border-radius:10px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif;border:1.5px solid ${BRAND.slate200};">${escapeHtml(label)}</a>`;
}

// Link block wrapper (legacy compat — wraps ctaButton in a <p>)
export function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return `<p style="margin-top:20px">${ctaButton(href, label)}</p>`;
}

// Status pill — coloured rounded badge
export function statusPill(text, color) {
  const colorMap = {
    [BRAND.emerald]: { bg: BRAND.emeraldSoft, fg: BRAND.emeraldDark },
    [BRAND.amber]:   { bg: BRAND.amberSoft, fg: BRAND.amberDark },
    [BRAND.rose]:    { bg: BRAND.roseSoft, fg: BRAND.roseDark },
    [BRAND.blue]:    { bg: BRAND.blueSoft, fg: BRAND.blueDark },
    [BRAND.primary]: { bg: BRAND.accentSoft, fg: BRAND.primary },
    [BRAND.violet]:  { bg: BRAND.violetSoft, fg: BRAND.violet },
  };
  const c = colorMap[color] || { bg: BRAND.slate100, fg: BRAND.slate700 };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;background:${c.bg};color:${c.fg};letter-spacing:0.3px;text-transform:uppercase;">${escapeHtml(text)}</span>`;
}

// Convenience pill presets
export function pillSuccess(text) { return statusPill(text, BRAND.emerald); }
export function pillWarning(text) { return statusPill(text, BRAND.amber); }
export function pillDanger(text)  { return statusPill(text, BRAND.rose); }
export function pillInfo(text)    { return statusPill(text, BRAND.blue); }
export function pillNeutral(text) { return statusPill(text, BRAND.primary); }

// Icon badge — small coloured circle with a unicode glyph (email-safe, no fonts)
export function iconBadge(glyph, color) {
  const c = color || BRAND.primary;
  const colorMap = {
    [BRAND.emerald]: BRAND.emeraldSoft,
    [BRAND.amber]: BRAND.amberSoft,
    [BRAND.rose]: BRAND.roseSoft,
    [BRAND.blue]: BRAND.blueSoft,
    [BRAND.primary]: BRAND.accentSoft,
  };
  const bg = colorMap[c] || BRAND.slate100;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${bg};color:${c};font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;vertical-align:middle">${escapeHtml(glyph)}</span>`;
}

// Info row — label / value pair (for key details)
export function infoRow(label, value) {
  return `<tr><td style="padding:6px 0;color:${BRAND.slate500};font-size:13px;font-weight:500;width:40%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:${BRAND.slate900};font-size:14px;font-weight:600;vertical-align:top">${value == null ? '—' : escapeHtml(String(value))}</td></tr>`;
}

// Info table — a borderless key/value grid
export function infoTable(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows.map(r => infoRow(r[0], r[1])).join('')}</table>`;
}

// Section card — titled block with soft background
export function sectionCard(title, bodyHtml, opts?) {
  const bg = (opts && opts.bg) || BRAND.slate50;
  const border = (opts && opts.border) || BRAND.slate200;
  const titleBg = (opts && opts.titleBg) || BRAND.primary;
  const titleColor = (opts && opts.titleColor) || '#ffffff';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:10px;overflow:hidden;margin:16px 0">` +
    (title ? `<tr><td style="background:${titleBg};padding:10px 16px;color:${titleColor};font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(title)}</td></tr>` : '') +
    `<tr><td style="background:${bg};padding:16px;color:${BRAND.slate700};font-size:14px;line-height:1.6">${bodyHtml}</td></tr>` +
    `</table>`;
}

// Data table — the flagship branded table with header row and zebra rows
export function dataTable(headers, rows, opts?) {
  const accent = (opts && opts.accent) || BRAND.primary;
  const thStyle = `padding:11px 14px;background:${accent};color:#ffffff;text-align:left;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.4px;border-bottom:2px solid ${BRAND.primaryDark}`;
  const tdBase = `padding:10px 14px;font-size:13px;color:${BRAND.slate700};border-bottom:1px solid ${BRAND.slate200};font-family:Arial,Helvetica,sans-serif`;

  const head = '<tr>' + headers.map(h => `<th style="${thStyle}">${escapeHtml(h)}</th>`).join('') + '</tr>';
  const body = rows.map((row, i) => {
    const bg = i % 2 === 1 ? `background:${BRAND.slate50};` : '';
    return '<tr>' + row.map((cell, ci) => {
      const align = ci === 0 ? '' : 'text-align:left;';
      const isHtml = typeof cell === 'string' && cell.startsWith('__HTML__:');
      const content = isHtml ? cell.slice(8) : escapeHtml(cell);
      return `<td style="${tdBase}${bg}${align}">${content}</td>`;
    }).join('') + '</tr>';
  }).join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid ${BRAND.slate200};margin:12px 0"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// Helper to inject raw HTML into a table cell (use with dataTable)
export function html(content) {
  return '__HTML__:' + content;
}

// Callout / alert box — coloured highlight panel
export function callout(text, type) {
  const colors = {
    info:    { bg: BRAND.blueSoft, border: '#bfdbfe', text: '#1e40af', icon: 'ℹ️' },
    success: { bg: BRAND.emeraldSoft, border: '#a7f3d0', text: '#065f46', icon: '✓' },
    warning: { bg: BRAND.amberSoft, border: '#fde68a', text: '#92400e', icon: '⚠' },
    danger:  { bg: BRAND.roseSoft, border: '#fecdd3', text: '#9f1239', icon: '⚠' },
  };
  const c = colors[type] || colors.info;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${c.border};border-radius:8px;background:${c.bg};margin:12px 0"><tr><td style="padding:12px 16px;color:${c.text};font-size:13px;font-weight:500;font-family:Arial,Helvetica,sans-serif;line-height:1.5"><span style="font-size:15px;margin-right:6px">${c.icon}</span>${escapeHtml(text)}</td></tr></table>`;
}

// Callout with HTML content (for pills/links inside)
export function calloutHtml(htmlContent, type) {
  const colors = {
    info:    { bg: BRAND.blueSoft, border: '#bfdbfe', text: '#1e40af', icon: 'ℹ️' },
    success: { bg: BRAND.emeraldSoft, border: '#a7f3d0', text: '#065f46', icon: '✓' },
    warning: { bg: BRAND.amberSoft, border: '#fde68a', text: '#92400e', icon: '⚠' },
    danger:  { bg: BRAND.roseSoft, border: '#fecdd3', text: '#9f1239', icon: '⚠' },
  };
  const c = colors[type] || colors.info;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${c.border};border-radius:8px;background:${c.bg};margin:12px 0"><tr><td style="padding:12px 16px;color:${c.text};font-size:13px;font-weight:500;font-family:Arial,Helvetica,sans-serif;line-height:1.5"><span style="font-size:15px;margin-right:6px">${c.icon}</span>${htmlContent}</td></tr></table>`;
}

// ── v2 NEW BUILDING BLOCKS ────────────────────────────────────────────────

// Stat tile — single KPI tile with icon, value, label
export function statTile(label, value, opts?) {
  const color = (opts && opts.color) || BRAND.primary;
  const icon = (opts && opts.icon) || '';
  const colorMap = {
    [BRAND.emerald]: { bg: BRAND.emeraldSoft, fg: BRAND.emeraldDark },
    [BRAND.amber]:   { bg: BRAND.amberSoft, fg: BRAND.amberDark },
    [BRAND.rose]:    { bg: BRAND.roseSoft, fg: BRAND.roseDark },
    [BRAND.blue]:    { bg: BRAND.blueSoft, fg: BRAND.blueDark },
    [BRAND.primary]: { bg: BRAND.accentSoft, fg: BRAND.primary },
    [BRAND.violet]:  { bg: BRAND.violetSoft, fg: BRAND.violet },
  };
  const c = colorMap[color] || { bg: BRAND.slate100, fg: BRAND.slate700 };
  return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${BRAND.slate200};border-radius:10px;overflow:hidden;background:#ffffff">` +
    `<tr><td style="padding:14px 16px">` +
    (icon ? `<div style="margin-bottom:6px;font-size:18px">${escapeHtml(icon)}</div>` : '') +
    `<div style="font-size:22px;font-weight:800;color:${c.fg};font-family:Arial,Helvetica,sans-serif;line-height:1.1">${escapeHtml(String(value))}</div>` +
    `<div style="margin-top:4px;font-size:11px;font-weight:600;color:${BRAND.slate500};font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.3px">${escapeHtml(label)}</div>` +
    `</td></tr></table>`;
}

// Stat tile row — 2-4 tiles in a responsive row
export function statTileRow(tiles) {
  const n = tiles.length;
  const widthPct = Math.floor(100 / n);
  const cells = tiles.map(t => {
    const opts = typeof t === 'object' ? t : { label: t, value: '' };
    return `<td style="width:${widthPct}%;padding:0 4px;vertical-align:top">${statTile(opts.label, opts.value, opts)}</td>`;
  }).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:12px 0"><tr>${cells}</tr></table>`;
}

// Progress bar — labelled bar showing percentage
export function progressBar(label, percent, opts?) {
  const color = (opts && opts.color) || BRAND.primary;
  const pct = Math.max(0, Math.min(100, percent));
  const barColor = pct >= 100 ? BRAND.emerald : pct >= 75 ? BRAND.primary : pct >= 50 ? BRAND.amber : BRAND.rose;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:10px 0">` +
    `<tr><td style="padding:0 0 6px 0;font-size:12px;font-weight:600;color:${BRAND.slate700};font-family:Arial,Helvetica,sans-serif">${escapeHtml(label)} <span style="float:right;color:${BRAND.slate500};font-weight:700">${Math.round(pct)}%</span></td></tr>` +
    `<tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${BRAND.slate200};border-radius:6px;overflow:hidden"><tr><td style="background:${barColor};height:8px;width:${pct}%;border-radius:6px;font-size:8px;line-height:8px">&nbsp;</td></tr></table></td></tr>` +
    `</table>`;
}

// Help tip box — soft blue background with lightbulb icon badge
export function helpTip(title, bodyHtml) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #bfdbfe;border-radius:10px;background:${BRAND.blueSoft};margin:16px 0">` +
    `<tr><td style="padding:14px 16px">` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
    `<td style="width:32px;vertical-align:top">${iconBadge('💡', BRAND.blue)}</td>` +
    `<td style="padding-left:10px;vertical-align:top">` +
    `<div style="font-size:13px;font-weight:700;color:${BRAND.blueDark};font-family:Arial,Helvetica,sans-serif;margin-bottom:4px">${escapeHtml(title)}</div>` +
    `<div style="font-size:13px;color:#1e40af;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${bodyHtml}</div>` +
    `</td></tr></table>` +
    `</td></tr></table>`;
}

// Two-column row — left/right layout for side-by-side content
export function twoColumnRow(leftHtml, rightHtml, opts?) {
  const leftWidth = (opts && opts.leftWidth) || '50%';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:12px 0"><tr>` +
    `<td style="width:${leftWidth};padding:0 8px 0 0;vertical-align:top">${leftHtml}</td>` +
    `<td style="padding:0 0 0 8px;vertical-align:top">${rightHtml}</td>` +
    `</tr></table>`;
}

// Summary card — a compact card with icon, title, value, and optional pill
export function summaryCard(icon, title, value, pillHtml, opts?) {
  const bg = (opts && opts.bg) || '#ffffff';
  const border = (opts && opts.border) || BRAND.slate200;
  const iconColor = (opts && opts.iconColor) || BRAND.primary;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:10px;background:${bg};margin:8px 0">` +
    `<tr><td style="padding:12px 16px">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
    `<td style="width:36px;vertical-align:top">${iconBadge(icon, iconColor)}</td>` +
    `<td style="padding-left:10px;vertical-align:top">` +
    `<div style="font-size:11px;font-weight:600;color:${BRAND.slate500};font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.3px">${escapeHtml(title)}</div>` +
    `<div style="font-size:15px;font-weight:700;color:${BRAND.slate900};font-family:Arial,Helvetica,sans-serif;margin-top:2px">${escapeHtml(String(value))}</div>` +
    (pillHtml ? `<div style="margin-top:6px">${pillHtml}</div>` : '') +
    `</td></tr></table>` +
    `</td></tr></table>`;
}

// Bullet list — simple styled list
export function bulletList(items) {
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0">${items.map(item =>
    `<tr><td style="padding:3px 0;color:${BRAND.slate700};font-size:13px;font-family:Arial,Helvetica,sans-serif;line-height:1.5"><span style="color:${BRAND.accent};font-weight:700;margin-right:8px">●</span>${escapeHtml(item)}</td></tr>`
  ).join('')}</table>`;
}

// Timeline item — a step in a sequential flow
export function timelineItem(step, title, bodyHtml, isLast) {
  const dot = `<td style="width:28px;vertical-align:top;padding-top:2px"><div style="width:24px;height:24px;border-radius:50%;background:${BRAND.primary};color:#ffffff;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-align:center;line-height:24px">${escapeHtml(String(step))}</div></td>`;
  const line = isLast ? '' : `<tr><td style="width:28px;padding:0 0 0 11px"><div style="width:2px;height:20px;background:${BRAND.slate200};margin:0 auto">&nbsp;</div></td></tr>`;
  return `<tr>${dot}<td style="padding:0 0 4px 10px;vertical-align:top"><div style="font-size:13px;font-weight:700;color:${BRAND.slate900};font-family:Arial,Helvetica,sans-serif">${escapeHtml(title)}</div><div style="font-size:13px;color:${BRAND.slate500};font-family:Arial,Helvetica,sans-serif;line-height:1.5">${bodyHtml}</div></td></tr>${line}`;
}

export function timeline(items) {
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0">${items.map((it, i) => timelineItem(i + 1, it.title, it.body, i === items.length - 1)).join('')}</table>`;
}

// Metric grid — 2x2 or 2x3 grid of small metrics
export function metricGrid(metrics) {
  const rows = [];
  for (let i = 0; i < metrics.length; i += 2) {
    const pair = metrics.slice(i, i + 2);
    rows.push(`<tr>${pair.map(m => `<td style="width:50%;padding:4px;vertical-align:top">${statTile(m.label, m.value, m)}</td>`).join('')}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0">${rows.join('')}</table>`;
}

// Divider
export function divider() {
  return `<hr style="border:none;border-top:1px solid ${BRAND.slate200};margin:20px 0" />`;
}

// Paragraph
export function p(text) {
  return `<p style="margin:0 0 12px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">${escapeHtml(text)}</p>`;
}

// Heading (h2)
export function heading(text) {
  return `<h2 style="margin:0 0 10px 0;color:${BRAND.slate900};font-size:17px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.2px">${escapeHtml(text)}</h2>`;
}

// Sub-heading (h3)
export function subheading(text) {
  return `<h3 style="margin:0 0 8px 0;color:${BRAND.slate700};font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.3px">${escapeHtml(text)}</h3>`;
}

// =============================================================================
// Rotating safety tip strip — deterministic by day-of-year
// =============================================================================

const SAFETY_TIPS = [
  'Complete your daily vehicle walk-round check before leaving for site.',
  'Always wear your full PPE — hard hat, boots, hi-vis, and eye protection.',
  'Complete a POWRA (Point of Work Risk Assessment) on arrival at every site.',
  'Sign in at site arrival so the office knows you have arrived safely.',
  'Check the weather forecast before travelling to site — don\'t work in unsafe conditions.',
  'Report any near-miss or incident immediately — no matter how small it seems.',
  'Ensure your CSCS/CPCS card is valid and on your person at all times on site.',
  'Check your equipment is in date for its PAT test and service before use.',
  'Keep your work area tidy — slips, trips and falls are the most common site accident.',
  'Never use a mobile phone while operating plant or driving on site.',
  'Make sure you know where the first aid kit and emergency contacts are on every site.',
  'Take your breaks — fatigue is a major contributor to site accidents.',
  'Check underground services before any excavation — use CAT scan and utility drawings.',
  'Secure all loads properly before driving — check straps and weight distribution.',
  'Log your hours accurately at the end of every shift — don\'t leave it to the end of the week.',
  'If you see something unsafe on site, stop work and report it to your supervisor.',
  'Keep your training up to date — expired certificates can stop you working on site.',
  'Wash your hands before eating or drinking on site — contamination is a real risk.',
  'Check your vehicle\'s MOT and tax are valid before driving — it\'s your responsibility.',
  'Stay hydrated in hot weather — take regular water breaks and work in shade where possible.',
  'Never enter an unsupported excavation — always check shoring is in place first.',
  'Check your fire extinguisher is in date and accessible before starting hot works.',
  'Report any damage to equipment immediately — don\'t use damaged plant.',
  'Keep your phone charged and with you at all times on site for emergencies.',
  'Follow the site traffic management plan — stick to designated walkways and vehicle routes.',
  'Check for overhead hazards before setting up plant — power lines, branches, structures.',
  'Never lift beyond your capability — use mechanical aids or ask for help with heavy loads.',
  'Ensure proper ventilation when working in confined spaces — test the atmosphere first.',
  'Keep your Mitti/SafetyCulture audits up to date — they protect you and the company.',
  'Log your meterage accurately at the end of every drilling shift — it drives the billing.',
];

export function safetyTipStrip(date?) {
  const d = date ? new Date(date) : new Date();
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const tip = SAFETY_TIPS[dayOfYear % SAFETY_TIPS.length];
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${BRAND.amberSoft};border-top:2px solid ${BRAND.amber};margin:0">` +
    `<tr><td style="padding:12px 20px">` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
    `<td style="width:28px;vertical-align:top">${iconBadge('⚠', BRAND.amber)}</td>` +
    `<td style="padding-left:10px;vertical-align:top">` +
    `<div style="font-size:10px;font-weight:700;color:${BRAND.amberDark};font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Safety Tip of the Day</div>` +
    `<div style="font-size:12px;color:${BRAND.amberDark};font-family:Arial,Helvetica,sans-serif;line-height:1.4">${escapeHtml(tip)}</div>` +
    `</td></tr></table>` +
    `</td></tr></table>`;
}

// =============================================================================
// Branded wrapper — the master email shell (v2 with header variants + safety tip)
// =============================================================================

export function brandedWrapper(contentHtml, opts?) {
  const o = opts || {};
  const bannerTitle = o.banner_title || BRAND.name;
  const showBanner = o.show_banner !== false;
  const footerText = o.footer_text || BRAND.name;
  const preheader = o.preheader || '';
  const showSafetyTip = o.show_safety_tip !== false;
  const headerVariant = HEADER_VARIANTS[o.headerVariant] || HEADER_VARIANTS.brand;

  const logoBlock = `<td style="padding:20px 32px;background:${headerVariant.bg};text-align:center">` +
    `<h1 style="margin:0;color:#ffffff;font-size:20px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;font-weight:800">${escapeHtml(bannerTitle)}</h1>` +
    (o.banner_subtitle ? `<p style="margin:4px 0 0 0;color:${headerVariant.subtitle};font-size:12px;font-family:Arial,Helvetica,sans-serif;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(o.banner_subtitle)}</p>` : '') +
    `</td>`;

  const accentBar = `<tr><td style="padding:0;background:${headerVariant.accent};height:4px;line-height:4px;font-size:4px">&nbsp;</td></tr>`;

  const footer = `<tr><td style="padding:20px 32px;background:${BRAND.slate50};border-top:1px solid ${BRAND.slate200};text-align:center">` +
    `<p style="margin:0 0 4px 0;color:${BRAND.slate500};font-size:12px;font-family:Arial,Helvetica,sans-serif;font-weight:600">${escapeHtml(footerText)}</p>` +
    `<p style="margin:0;color:${BRAND.slate400};font-size:11px;font-family:Arial,Helvetica,sans-serif">This is an automated message from ${BRAND.name}. Please do not reply directly.</p>` +
    `</td></tr>`;

  const safetyTip = showSafetyTip ? `<tr><td style="padding:0">${safetyTipStrip()}</td></tr>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(bannerTitle)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BRAND.slate100};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">` +
    (preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : '') +
    `<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:${BRAND.white};border-radius:14px;overflow:hidden;border:1px solid ${BRAND.slate200};box-shadow:0 8px 32px rgba(15,42,31,0.10)">` +
    (showBanner ? `<tr>${logoBlock}</tr>` : '') +
    accentBar +
    `<tr><td style="padding:28px 32px;color:${BRAND.slate900};font-size:14px;line-height:1.65">${contentHtml}</td></tr>` +
    safetyTip +
    footer +
    `</table></body></html>`;
}

// Legacy alias for backward compat (old functions call `styledHtml`)
export const styledHtml = brandedWrapper;