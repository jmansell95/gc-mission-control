// =============================================================================
// GC Mission Control — Unified Email Design Kit
// =============================================================================
// Single source of truth for every email the platform sends. Every backend
// email function and EmailTemplate render routes its content through
// `brandedWrapper()`. This guarantees a consistent, modern, branded look across
// all outgoing emails — header, footer, tables, pills, buttons, cards.
//
// Brand: Ground Control dark green (#2E5A1A) + leaf accent (#8DC63F).
// All sender/brand strings say "GC Mission Control".
// =============================================================================

export const BRAND = {
  name: 'GC Mission Control',
  primary: '#2E5A1A',
  primaryDark: '#1c4a12',
  accent: '#8DC63F',
  accentSoft: '#f0f7e8',
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
  emerald: '#059669',
  emeraldSoft: '#ecfdf5',
  amber: '#d97706',
  amberSoft: '#fffbeb',
  rose: '#e11d48',
  roseSoft: '#fff1f2',
  blue: '#2563eb',
  blueSoft: '#eff6ff',
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
  const bg = color || BRAND.slate100;
  const fg = color === BRAND.emerald ? BRAND.emerald
    : color === BRAND.amber ? BRAND.amber
    : color === BRAND.rose ? BRAND.rose
    : color === BRAND.blue ? BRAND.blue
    : color === BRAND.primary ? BRAND.primary
    : BRAND.slate700;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;background:${bg === BRAND.slate100 ? BRAND.slate100 : bg + '1a'};color:${fg};letter-spacing:0.3px;text-transform:uppercase;">${escapeHtml(text)}</span>`;
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
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:10px;overflow:hidden;margin:16px 0">` +
    (title ? `<tr><td style="background:${titleBg};padding:10px 16px;color:#ffffff;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(title)}</td></tr>` : '') +
    `<tr><td style="background:${bg};padding:16px;color:${BRAND.slate700};font-size:14px;line-height:1.6">${bodyHtml}</td></tr>` +
    `</table>`;
}

// Data table — the flagship branded table with header row and zebra rows
export function dataTable(headers, rows, opts?) {
  const accent = (opts && opts.accent) || BRAND.primary;
  const headerBg = accent;
  const thStyle = `padding:11px 14px;background:${headerBg};color:#ffffff;text-align:left;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.4px;border-bottom:2px solid ${BRAND.primaryDark}`;
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
    info: { bg: BRAND.blueSoft, border: '#bfdbfe', text: '#1e40af' },
    success: { bg: BRAND.emeraldSoft, border: '#a7f3d0', text: '#065f46' },
    warning: { bg: BRAND.amberSoft, border: '#fde68a', text: '#92400e' },
    danger: { bg: BRAND.roseSoft, border: '#fecdd3', text: '#9f1239' },
  };
  const c = colors[type] || colors.info;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${c.border};border-radius:8px;background:${c.bg};margin:12px 0"><tr><td style="padding:12px 16px;color:${c.text};font-size:13px;font-weight:500;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${escapeHtml(text)}</td></tr></table>`;
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

// =============================================================================
// Branded wrapper — the master email shell
// =============================================================================

export function brandedWrapper(contentHtml, opts?) {
  const o = opts || {};
  const bannerTitle = o.banner_title || BRAND.name;
  const showBanner = o.show_banner !== false;
  const footerText = o.footer_text || BRAND.name;
  const preheader = o.preheader || '';

  const logoBlock = `<td style="padding:20px 32px;background:${BRAND.primary};text-align:center">` +
    `<h1 style="margin:0;color:#ffffff;font-size:20px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;font-weight:800">${escapeHtml(bannerTitle)}</h1>` +
    (o.banner_subtitle ? `<p style="margin:4px 0 0 0;color:${BRAND.accent};font-size:12px;font-family:Arial,Helvetica,sans-serif;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(o.banner_subtitle)}</p>` : '') +
    `</td>`;

  const accentBar = `<tr><td style="padding:0;background:${BRAND.accent};height:4px;line-height:4px;font-size:4px">&nbsp;</td></tr>`;

  const footer = `<tr><td style="padding:20px 32px;background:${BRAND.slate50};border-top:1px solid ${BRAND.slate200};text-align:center">` +
    `<p style="margin:0 0 4px 0;color:${BRAND.slate500};font-size:12px;font-family:Arial,Helvetica,sans-serif;font-weight:600">${escapeHtml(footerText)}</p>` +
    `<p style="margin:0;color:${BRAND.slate400};font-size:11px;font-family:Arial,Helvetica,sans-serif">This is an automated message from ${BRAND.name}. Please do not reply directly.</p>` +
    `</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(bannerTitle)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BRAND.slate100};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">` +
    (preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : '') +
    `<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:${BRAND.white};border-radius:14px;overflow:hidden;border:1px solid ${BRAND.slate200};box-shadow:0 8px 32px rgba(15,42,31,0.10)">` +
    (showBanner ? `<tr>${logoBlock}</tr>` : '') +
    accentBar +
    `<tr><td style="padding:28px 32px;color:${BRAND.slate900};font-size:14px;line-height:1.65">${contentHtml}</td></tr>` +
    footer +
    `</table></body></html>`;
}

// Legacy alias for backward compat (old functions call `styledHtml`)
export const styledHtml = brandedWrapper;