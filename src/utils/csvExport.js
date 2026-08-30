// CSV download helpers used by the Reporting Hub export actions.

/**
 * Legacy CSV download — dumps row objects using their keys as headers.
 * Kept for backward compatibility with existing callers.
 */
export function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  _downloadBlob(filename, headers, rows.map(r => headers.map(h => r[h])));
}

/**
 * Structured CSV download — takes explicit column definitions
 * [{key, label}] and row objects, so each report type can define its
 * own meaningful column headers instead of dumping raw entity fields.
 */
export function downloadStructuredCsv(filename, columns, rows) {
  if (!rows || !rows.length) return;
  const headers = columns.map(c => c.label);
  const data = rows.map(r => columns.map(c => r[c.key]));
  _downloadBlob(filename, headers, data);
}

function _downloadBlob(filename, headers, dataRows) {
  const lines = [headers.map(h => _csvEscape(h)).join(',')];
  for (const row of dataRows) {
    lines.push(row.map(v => _csvEscape(v)).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _csvEscape(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? '"' + s + '"' : s;
}