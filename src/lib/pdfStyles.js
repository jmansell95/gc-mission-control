/**
 * Shared PDF styling module for all GC Mission Control PDF reports.
 * Provides a consistent brand header, section headers, table styles,
 * and footer with page numbers — so every PDF looks the same.
 *
 * Usage with jsPDF:
 *   import { addBrandHeader, addSectionHeader, addTable, addPageNumbers } from '@/lib/pdfStyles';
 *   const doc = new jsPDF();
 *   addBrandHeader(doc, 'Job Report', 'Cambridge North · Sep 2026');
 *   let y = addSectionHeader(doc, 'Summary', 55);
 *   y = addTable(doc, ['Item', 'Qty', 'Amount'], rows, y);
 *   addPageNumbers(doc);
 *   doc.save('report.pdf');
 */

// Brand colours
export const COLORS = {
  BRAND_GREEN: [46, 90, 26],       // #2E5A1A — primary
  ACCENT_GREEN: [141, 198, 63],    // #8DC63F — accent stripe
  DARK_GREEN: [20, 60, 16],        // darker shade
  WHITE: [255, 255, 255],
  SLATE_900: [15, 23, 42],
  SLATE_700: [51, 65, 85],
  SLATE_500: [100, 116, 139],
  SLATE_300: [203, 213, 225],
  SLATE_200: [226, 232, 240],
  SLATE_100: [241, 245, 249],
  SLATE_50: [248, 250, 252],
  AMBER: [245, 158, 11],
  RED: [239, 68, 68],
  EMERALD: [16, 185, 129],
};

/** Brand header bar — green with accent stripe, white title text. */
export function addBrandHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  // Main green bar
  doc.setFillColor(...COLORS.BRAND_GREEN);
  doc.rect(0, 0, w, 38, 'F');
  // Accent stripe
  doc.setFillColor(...COLORS.ACCENT_GREEN);
  doc.rect(0, 38, w, 3, 'F');
  // Title
  doc.setTextColor(...COLORS.WHITE);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(String(title || ''), 14, 22);
  // Subtitle
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255, 0.85);
    doc.text(String(subtitle), 14, 30);
  }
  // Reset
  doc.setTextColor(...COLORS.SLATE_900);
}

/** Section header — green bold text with accent underline. Returns next Y. */
export function addSectionHeader(doc, title, y) {
  doc.setTextColor(...COLORS.BRAND_GREEN);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(String(title || ''), 14, y);
  const tw = doc.getTextWidth(String(title || ''));
  doc.setDrawColor(...COLORS.ACCENT_GREEN);
  doc.setLineWidth(1.2);
  doc.line(14, y + 1.5, 14 + tw + 3, y + 1.5);
  doc.setTextColor(...COLORS.SLATE_900);
  return y + 8;
}

/** Body text paragraph. Returns next Y. */
export function addBodyText(doc, text, y, opts = {}) {
  const { fontSize = 9, color = COLORS.SLATE_700, indent = 14, lineHeight = 5 } = opts;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(String(text || ''), doc.internal.pageSize.getWidth() - 28);
  lines.forEach((line) => {
    doc.text(line, indent, y);
    y += lineHeight;
  });
  return y;
}

/** Table with green header row and alternating row colours. Returns next Y. */
export function addTable(doc, headers, rows, startY, opts = {}) {
  const { fontSize = 8.5, cellPadding = 2, rowHeight = 7 } = opts;
  const w = doc.internal.pageSize.getWidth();
  const tableWidth = w - 28;
  const colWidths = opts.colWidths || headers.map(() => tableWidth / headers.length);

  // Header row
  doc.setFillColor(...COLORS.BRAND_GREEN);
  doc.rect(14, startY, tableWidth, rowHeight, 'F');
  doc.setTextColor(...COLORS.WHITE);
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  let x = 14;
  headers.forEach((h, i) => {
    doc.text(String(h || ''), x + cellPadding, startY + rowHeight - 2.5);
    x += colWidths[i];
  });

  // Data rows
  let y = startY + rowHeight;
  rows.forEach((row, idx) => {
    // Check page break
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }
    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(...COLORS.SLATE_50);
      doc.rect(14, y, tableWidth, rowHeight, 'F');
    }
    // Row border
    doc.setDrawColor(...COLORS.SLATE_200);
    doc.setLineWidth(0.2);
    doc.line(14, y + rowHeight, 14 + tableWidth, y + rowHeight);

    doc.setTextColor(...COLORS.SLATE_700);
    doc.setFont('helvetica', 'normal');
    x = 14;
    row.forEach((cell, i) => {
      const text = String(cell ?? '');
      const maxChars = Math.floor((colWidths[i] - cellPadding * 2) / (fontSize * 0.18));
      const display = text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : text;
      doc.text(display, x + cellPadding, y + rowHeight - 2.5);
      x += colWidths[i];
    });
    y += rowHeight;
  });
  return y + 4;
}

/** KPI row — small stat tiles in a horizontal row. Returns next Y. */
export function addKpiRow(doc, kpis, y) {
  const w = doc.internal.pageSize.getWidth();
  const gap = 4;
  const tileW = (w - 28 - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = 14 + i * (tileW + gap);
    // Tile background
    doc.setFillColor(...COLORS.SLATE_50);
    doc.roundedRect(x, y, tileW, 16, 2, 2, 'F');
    doc.setDrawColor(...COLORS.SLATE_200);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, tileW, 16, 2, 2, 'S');
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.SLATE_500);
    doc.text(String(kpi.label || ''), x + 3, y + 5);
    // Value
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.BRAND_GREEN);
    doc.text(String(kpi.value ?? ''), x + 3, y + 13);
  });
  return y + 22;
}

/** Footer with page numbers on every page. Call once at the end. */
export function addPageNumbers(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLORS.SLATE_200);
    doc.setLineWidth(0.4);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.SLATE_500);
    doc.text('GC Mission Control', 14, h - 9);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, w / 2, h - 9, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, w - 14, h - 9, { align: 'right' });
  }
}

/** Helper: format GBP currency for PDFs. */
export function formatGBP(value) {
  if (value == null || isNaN(value)) return '—';
  return '£' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Helper: format date for PDFs. */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}