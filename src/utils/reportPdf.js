// ============================================================
// Shared PDF Report Generator — polished Ground Control branded
// multi-page PDFs with transparent logo, cover page, auto-breaking
// data tables, and footers. Used by every report export.
// ============================================================
import { jsPDF } from 'jspdf';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_50 = '#f8fafc';
const WHITE = '#ffffff';

const LOGO_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png';
let logoCache = null;

async function loadLogo() {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    logoCache = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return logoCache;
  } catch {
    return null;
  }
}

function fmtDate(d) {
  if (!d) return 'All dates';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function fmtTimestamp() {
  return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Cover Page ──
function drawCoverPage(doc, { title, subtitle, filterSummary }) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Top dark-green band (45% of page height)
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, pageW, pageH * 0.42, 'F');

  // Leaf-green accent line
  doc.setFillColor(BRAND_LEAF);
  doc.rect(0, pageH * 0.42, pageW, 3, 'F');

  // Logo centered in the band
  if (logoCache) {
    const logoW = 90;
    const logoH = 45;
    doc.addImage(logoCache, 'PNG', (pageW - logoW) / 2, 50, logoW, logoH);
  }

  // Title
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(title, pageW / 2, 130, { align: 'center' });

  // Subtitle
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(200, 220, 180);
    doc.text(subtitle, pageW / 2, 148, { align: 'center' });
  }

  // Filter summary box
  if (filterSummary && filterSummary.length > 0) {
    const boxY = pageH * 0.50;
    const boxH = filterSummary.length * 16 + 24;
    const boxX = 80;
    const boxW = pageW - 160;

    doc.setFillColor(SLATE_50);
    doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6, 'F');
    doc.setDrawColor(SLATE_300);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6, 'S');

    doc.setTextColor(SLATE_700);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Scope', boxX + 16, boxY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(SLATE_700);
    filterSummary.forEach((line, i) => {
      doc.text(line, boxX + 16, boxY + 36 + i * 16);
    });
  }

  // Generation timestamp at bottom
  doc.setTextColor(SLATE_500);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${fmtTimestamp()}`, pageW / 2, pageH - 24, { align: 'center' });

  // Confidential notice
  doc.setTextColor(SLATE_300);
  doc.setFontSize(8);
  doc.text('Ground Control · Confidential — Internal Use Only', pageW / 2, pageH - 14, { align: 'center' });
}

// ── Page Header (data pages) ──
function drawPageHeader(doc, sectionTitle) {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, pageW, 46, 'F');
  doc.setFillColor(BRAND_LEAF);
  doc.rect(0, 46, pageW, 2, 'F');

  // Logo left
  if (logoCache) {
    doc.addImage(logoCache, 'PNG', 20, 7, 34, 30);
  }

  // Section title right
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sectionTitle, pageW - 20, 28, { align: 'right' });
}

// ── Footer ──
function drawFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;

  doc.setDrawColor(SLATE_300);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 18, pageW - margin, pageH - 18);

  doc.setTextColor(SLATE_500);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Ground Control · Confidential — Internal Use Only', margin, pageH - 10);

  const pageNum = doc.getCurrentPageInfo().pageNumber;
  doc.text(`Page ${pageNum}`, pageW - margin, pageH - 10, { align: 'right' });
}

// ── Table renderer with auto page-break ──
function drawTable(doc, columns, rows, totals, startY, sectionTitle) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const tableW = pageW - margin * 2;
  const rowH = 16;
  const headerH = 18;
  const bottomLimit = pageH - 26;

  const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0);
  const colWidths = columns.map(c => (c.width || 1) / totalWeight * tableW);

  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(BRAND_DARK);
    doc.rect(margin, y, tableW, headerH, 'F');
    doc.setTextColor(WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let x = margin;
    columns.forEach((col, i) => {
      const label = String(col.label || '');
      if (col.align === 'right') {
        doc.text(label, x + colWidths[i] - 4, y + 12, { align: 'right' });
      } else {
        doc.text(label, x + 4, y + 12);
      }
      x += colWidths[i];
    });
    y += headerH;
  };

  drawHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  rows.forEach((row, idx) => {
    if (y + rowH > bottomLimit) {
      drawFooter(doc);
      doc.addPage();
      drawPageHeader(doc, sectionTitle);
      y = 60;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(SLATE_50);
      doc.rect(margin, y, tableW, rowH, 'F');
    }

    doc.setTextColor(SLATE_900);
    let x = margin;
    columns.forEach((col, i) => {
      const val = String(row[i] != null ? row[i] : '');
      if (col.align === 'right') {
        doc.text(val, x + colWidths[i] - 4, y + 11, { align: 'right' });
      } else {
        const maxChars = Math.floor(colWidths[i] / 4.2);
        const displayVal = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
        doc.text(displayVal, x + 4, y + 11);
      }
      x += colWidths[i];
    });
    y += rowH;
  });

  // Totals row
  if (totals) {
    if (y + rowH > bottomLimit) {
      drawFooter(doc);
      doc.addPage();
      drawPageHeader(doc, sectionTitle);
      y = 60;
      drawHeader();
    }
    doc.setFillColor(BRAND_LEAF);
    doc.rect(margin, y, tableW, rowH, 'F');
    doc.setTextColor(BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    columns.forEach((col, i) => {
      const val = String(totals[i] != null ? totals[i] : '');
      if (col.align === 'right') {
        doc.text(val, x + colWidths[i] - 4, y + 11, { align: 'right' });
      } else {
        doc.text(val, x + 4, y + 11);
      }
      x += colWidths[i];
    });
    y += rowH;
  }

  return y;
}

// ── Main entry point ──
export async function generateReportPdf({ title, subtitle = '', filterSummary = [], sections = [] }) {
  await loadLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Cover page
  drawCoverPage(doc, { title, subtitle, filterSummary });

  // Data pages — one per section
  sections.forEach((section) => {
    doc.addPage();
    drawPageHeader(doc, section.title);
    drawTable(doc, section.columns, section.rows, section.totals, 60, section.title);
  });

  // Draw footer on all data pages (skip cover)
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
  doc.save(filename);
}

// ── Helper: build filter summary lines from filter object ──
export function buildFilterSummary(filters, divisionName, teamName, clientName, jobTypeName) {
  const lines = [];
  if (filters.dateFrom || filters.dateTo) {
    lines.push(`Date Range: ${fmtDate(filters.dateFrom)} – ${fmtDate(filters.dateTo)}`);
  } else if (filters.datePreset && filters.datePreset !== 'custom') {
    lines.push(`Date Range: ${filters.datePreset.toUpperCase()}`);
  } else {
    lines.push('Date Range: All dates');
  }
  lines.push(`Business Stream: ${divisionName || 'All streams'}`);
  if (teamName) lines.push(`Team: ${teamName}`);
  if (clientName) lines.push(`Client: ${clientName}`);
  if (jobTypeName) lines.push(`Job Type: ${jobTypeName}`);
  return lines;
}