import { format } from 'date-fns';

// ============================================================
// Job Pack PDF Report Generator
// ============================================================
// Produces a professional, multi-page A4 PDF report for auditors
// using jsPDF's native drawing API — selectable text, small file
// size, automatic page breaks, branded headers and footers.

// Transparent PNG logo (same lockup used across the app) — so the brand
// colour of the header/cover shows through the logo's transparent areas
// instead of a white box behind it.
const LOGO_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png';

const BRAND = {
  // Ground Control brand palette
  orange: [245, 130, 31],       // #F5821F — primary
  orangeDark: [200, 90, 10],    // darker orange
  green: [141, 198, 63],        // #8DC63F — leaf green
  greenDark: [90, 140, 30],
  greenLight: [237, 246, 214],
  // Semantic / accent colours
  slate: [15, 23, 42],
  slateLight: [100, 116, 139],
  slateBorder: [226, 232, 240],
  blue: [37, 99, 235],
  amber: [217, 119, 6],
  red: [220, 38, 38],
  violet: [124, 58, 237],
  cyan: [8, 145, 178],
  indigo: [79, 70, 229],
  white: [255, 255, 255],
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 16,
  marginRight: 16,
  marginTop: 20,
  marginBottom: 20,
  contentWidth: 210 - 16 - 16, // 178
};

const SECTION_COLORS = {
  overview: BRAND.green,
  personnel: BRAND.blue,
  activity: BRAND.violet,
  compliance: BRAND.green,
  equipment: BRAND.amber,
  commercial: BRAND.green,
  documents: BRAND.slate,
  timeline: BRAND.indigo,
};

/** Loads the brand logo as a base64 data URL so it can be embedded in the PDF. */
async function loadLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';
const fmtDateTime = (d) => d ? format(new Date(d), 'dd MMM yyyy · HH:mm') : '—';
const gbp = (n) => `£${Number(n || 0).toFixed(2)}`;
const clean = (s) => s ? String(s).replace(/_/g, ' ') : '';

export async function generateJobPackPDF({ job, clientName, contractorName, data }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let page = 1;
  const logoData = await loadLogoDataUrl();

  const { assignments = [], staffMap = {}, logs = [], briefings = [], assets = [], costItems = [], documents = [], photos = [], milestones = [], deliveries = [], timeline = [] } = data;

  // ---- Helpers ----
  const getDoc = () => doc;
  const cursor = { y: PAGE.marginTop };

  function newPage() {
    doc.addPage();
    page++;
    cursor.y = PAGE.marginTop;
  }

  function ensureSpace(h) {
    if (cursor.y + h > PAGE.height - PAGE.marginBottom - 10) {
      drawFooter();
      newPage();
      drawHeader();
    }
  }

  function drawHeader() {
    // Slim header bar — brand orange
    doc.setFillColor(...BRAND.orange);
    doc.rect(0, 0, PAGE.width, 12, 'F');
    // Logo mark in header (small) — transparent PNG, no background box
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', PAGE.marginLeft, 2.5, 16, 7, undefined, 'FAST'); } catch (e) {}
    }
    doc.setTextColor(...BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('AUDIT JOB PACK', PAGE.marginLeft + 19, 7.5);
    doc.text(job.name || 'Job', PAGE.width - PAGE.marginRight, 7.5, { align: 'right' });
    cursor.y = PAGE.marginTop;
  }

  function drawFooter() {
    const fy = PAGE.height - 10;
    doc.setDrawColor(...BRAND.slateBorder);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginLeft, fy, PAGE.width - PAGE.marginRight, fy);
    doc.setTextColor(...BRAND.slateLight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Generated ${format(new Date(), 'dd MMM yyyy HH:mm')} · ISO-compliant audit trail`, PAGE.marginLeft, fy + 4);
    doc.text(`Page ${page}`, PAGE.width - PAGE.marginRight, fy + 4, { align: 'right' });
  }

  function sectionHeader(title, color) {
    ensureSpace(16);
    const y = cursor.y;
    // Coloured accent bar
    doc.setFillColor(...color);
    doc.roundedRect(PAGE.marginLeft, y, 3, 5, 1, 1, 'F');
    doc.setTextColor(...BRAND.slate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, PAGE.marginLeft + 6, y + 4);
    cursor.y = y + 9;
    // Thin divider
    doc.setDrawColor(...BRAND.slateBorder);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginLeft, cursor.y, PAGE.width - PAGE.marginRight, cursor.y);
    cursor.y += 5;
  }

  function subHeader(title, color) {
    ensureSpace(10);
    doc.setTextColor(...(color || BRAND.slate));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, PAGE.marginLeft, cursor.y + 3);
    cursor.y += 6;
  }

  function paragraph(text, opts = {}) {
    if (!text) return;
    doc.setTextColor(...BRAND.slate);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 9);
    const lines = doc.splitTextToSize(text, PAGE.contentWidth - (opts.indent || 0));
    const lh = (opts.size || 9) * 0.45;
    lines.forEach(line => {
      ensureSpace(lh + 1);
      doc.text(line, PAGE.marginLeft + (opts.indent || 0), cursor.y + 3);
      cursor.y += lh + 1;
    });
  }

  function infoGrid(items, cols = 2) {
    const colW = PAGE.contentWidth / cols;
    const rowH = 10;
    items.forEach((item, i) => {
      if (i % cols === 0) ensureSpace(rowH);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PAGE.marginLeft + col * colW;
      const y = cursor.y + row * rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.slateLight);
      doc.text(String(item.label || '').toUpperCase(), x + 1, y + 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...BRAND.slate);
      const valLines = doc.splitTextToSize(String(item.value || '—'), colW - 4);
      doc.text(valLines[0] || '—', x + 1, y + 8);
    });
    cursor.y += Math.ceil(items.length / cols) * rowH + 2;
  }

  function statCards(cards, cols = 4) {
    const colW = PAGE.contentWidth / cols;
    const cardH = 16;
    const gap = 2;
    cards.forEach((c, i) => {
      if (i % cols === 0) ensureSpace(cardH + 2);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PAGE.marginLeft + col * (colW + gap / cols * 0);
      const y = cursor.y + row * (cardH + 2);
      const cx = PAGE.marginLeft + col * (PAGE.contentWidth / cols) + 1;
      const cw = PAGE.contentWidth / cols - 2;
      // Background tint
      doc.setFillColor(...(c.color || BRAND.greenLight));
      doc.roundedRect(cx, y, cw, cardH, 1.5, 1.5, 'F');
      // Left accent
      doc.setFillColor(...(c.accent || BRAND.green));
      doc.roundedRect(cx, y, 1.5, cardH, 0.5, 0.5, 'F');
      // Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...BRAND.slate);
      doc.text(String(c.value), cx + 4, y + 7);
      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.slateLight);
      doc.text(String(c.label).toUpperCase(), cx + 4, y + 12);
    });
    cursor.y += Math.ceil(cards.length / cols) * (cardH + 2) + 2;
  }

  function table(headers, rows, opts = {}) {
    if (!rows.length) {
      paragraph(opts.empty || 'No records.', { size: 8.5 });
      cursor.y += 2;
      return;
    }
    const colWidths = opts.colWidths || headers.map(() => PAGE.contentWidth / headers.length);
    const rowH = 7;

    // Header row
    ensureSpace(rowH + 2);
    doc.setFillColor(...BRAND.slate);
    doc.rect(PAGE.marginLeft, cursor.y, PAGE.contentWidth, rowH, 'F');
    doc.setTextColor(...BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let hx = PAGE.marginLeft + 2;
    headers.forEach((h, i) => {
      doc.text(String(h), hx, cursor.y + 4.5);
      hx += colWidths[i];
    });
    cursor.y += rowH;

    // Data rows
    rows.forEach((row, ri) => {
      ensureSpace(rowH);
      if (ri % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(PAGE.marginLeft, cursor.y, PAGE.contentWidth, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.slate);
      let dx = PAGE.marginLeft + 2;
      row.forEach((cell, i) => {
        const txt = String(cell ?? '—');
        const maxW = colWidths[i] - 3;
        const lines = doc.splitTextToSize(txt, maxW);
        doc.text(lines[0] || '—', dx, cursor.y + 4.5);
        dx += colWidths[i];
      });
      cursor.y += rowH;
    });
    cursor.y += 3;
  }

  function timelineItems(events) {
    if (!events.length) { paragraph('No timeline events recorded.', { size: 8.5 }); return; }
    const itemH = 9;
    events.forEach((e, i) => {
      ensureSpace(itemH + 2);
      const y = cursor.y;
      // Dot
      const color = e.colorRgb || BRAND.slate;
      doc.setFillColor(...color);
      doc.circle(PAGE.marginLeft + 3, y + 4, 1.8, 'F');
      // Line to next
      if (i < events.length - 1) {
        doc.setDrawColor(...BRAND.slateBorder);
        doc.setLineWidth(0.4);
        doc.line(PAGE.marginLeft + 3, y + 5.8, PAGE.marginLeft + 3, y + itemH + 2);
      }
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND.slate);
      doc.text(String(e.title || ''), PAGE.marginLeft + 8, y + 3.5);
      // Time
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.slateLight);
      const timeStr = e.time ? format(new Date(e.time), 'dd MMM yyyy · HH:mm') : '—';
      doc.text(timeStr, PAGE.width - PAGE.marginRight, y + 3.5, { align: 'right' });
      // Detail
      if (e.detail) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND.slateLight);
        const lines = doc.splitTextToSize(String(e.detail), PAGE.contentWidth - 10);
        doc.text(lines[0] || '', PAGE.marginLeft + 8, y + 7);
      }
      cursor.y += itemH + 1;
    });
    cursor.y += 2;
  }

  // Map timeline colour names to RGB
  const COLOR_RGB = {
    blue: BRAND.blue, emerald: BRAND.green, violet: BRAND.violet,
    amber: BRAND.amber, cyan: BRAND.cyan, slate: BRAND.slateLight,
    indigo: BRAND.indigo,
  };
  const timelineRgb = timeline.map(e => ({ ...e, colorRgb: COLOR_RGB[e.color] || BRAND.slate }));

  // ====== COVER PAGE ======
  // Full-bleed background — brand green base with orange top band
  doc.setFillColor(...BRAND.greenDark);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setFillColor(...BRAND.orange);
  doc.rect(0, 0, PAGE.width, 120, 'F');
  // Brand logo — large, transparent PNG on the orange cover band (no white box)
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', PAGE.marginLeft, 18, 56, 20, undefined, 'FAST');
    } catch (e) {}
  }
  // Decorative accent lines
  doc.setDrawColor(...BRAND.white);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 3], 0);
  doc.line(PAGE.marginLeft, 50, PAGE.width - PAGE.marginRight, 50);
  doc.setLineDashPattern([], 0);

  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ISO-COMPLIANT AUDIT TRAIL', PAGE.marginLeft, 47);
  doc.setFontSize(26);
  doc.text(job.name || 'Job Pack', PAGE.marginLeft, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(job.job_reference ? `Reference: ${job.job_reference}` : 'Audit Job Pack', PAGE.marginLeft, 70);

  // Info box on cover
  const boxY = 90;
  doc.setFillColor(...BRAND.white);
  doc.roundedRect(PAGE.marginLeft, boxY, PAGE.contentWidth, 90, 3, 3, 'F');
  doc.setTextColor(...BRAND.slate);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('JOB SUMMARY', PAGE.marginLeft + 5, boxY + 8);
  doc.setDrawColor(...BRAND.orange);
  doc.setLineWidth(0.5);
  doc.line(PAGE.marginLeft + 5, boxY + 10, PAGE.marginLeft + 40, boxY + 10);

  const coverItems = [
    { label: 'Client', value: clientName || '—' },
    { label: 'Contractor', value: contractorName || '—' },
    { label: 'Location', value: job.location || '—' },
    { label: 'Project Manager', value: job.project_manager || '—' },
    { label: 'Status', value: clean(job.status) || '—' },
    { label: 'Start Date', value: fmtDate(job.start_date) },
    { label: 'End Date', value: fmtDate(job.end_date) },
    { label: 'Generated', value: format(new Date(), 'dd MMM yyyy · HH:mm') },
  ];
  coverItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAGE.marginLeft + 5 + col * (PAGE.contentWidth / 2 - 5);
    const y = boxY + 18 + row * 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.slateLight);
    doc.text(item.label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.slate);
    doc.text(String(item.value), x, y + 5);
  });

  // Summary stats on cover
  const approvedLogs = logs.filter(l => l.manager_review_status === 'approved');
  const confirmedQuotes = costItems.filter(c => c.price_confirmed && c.negotiated_unit_cost != null);
  const coverStats = [
    { label: 'Personnel', value: assignments.length, color: BRAND.blue },
    { label: 'Activity Logs', value: logs.length, color: BRAND.violet },
    { label: 'Approved', value: approvedLogs.length, color: BRAND.green },
    { label: 'Briefings', value: briefings.length, color: BRAND.green },
    { label: 'Equipment', value: assets.length + costItems.length, color: BRAND.amber },
    { label: 'Confirmed Prices', value: confirmedQuotes.length, color: BRAND.green },
    { label: 'Documents', value: documents.length, color: BRAND.slate },
    { label: 'Photos', value: photos.length, color: BRAND.cyan },
  ];
  const statsY = boxY + 100;
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('AUDIT PACK CONTENTS', PAGE.marginLeft, statsY);
  coverStats.forEach((s, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = PAGE.marginLeft + col * (PAGE.contentWidth / 4);
    const y = statsY + 10 + row * 20;
    doc.setFillColor(...s.color);
    doc.roundedRect(x, y, PAGE.contentWidth / 4 - 3, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BRAND.white);
    doc.text(String(s.value), x + 4, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(s.label.toUpperCase(), x + 4, y + 12);
  });

  // Footer on cover
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('CONFIDENTIAL — For audit purposes only', PAGE.marginLeft, PAGE.height - 12);
  doc.text('Generated by Audit Trail System', PAGE.width - PAGE.marginRight, PAGE.height - 12, { align: 'right' });

  // ====== CONTENT PAGES ======
  newPage();
  drawHeader();

  // --- Overview ---
  sectionHeader('1. Job Overview', SECTION_COLORS.overview);
  infoGrid([
    { label: 'Job Name', value: job.name },
    { label: 'Job Reference', value: job.job_reference || '—' },
    { label: 'Client', value: clientName || '—' },
    { label: 'Contractor', value: contractorName || '—' },
    { label: 'Location', value: job.location || '—' },
    { label: 'Project Manager', value: job.project_manager || '—' },
    { label: 'Status', value: clean(job.status) || '—' },
    { label: 'Start Date', value: fmtDate(job.start_date) },
    { label: 'End Date', value: fmtDate(job.end_date) },
    { label: 'Budget', value: job.budget_amount ? gbp(job.budget_amount) : '—' },
  ], 2);
  if (job.notes) {
    subHeader('Job Notes', BRAND.slate);
    paragraph(job.notes, { size: 9 });
  }
  subHeader('Audit Pack Summary', BRAND.slate);
  statCards([
    { label: 'Personnel Records', value: assignments.length, color: BRAND.greenLight, accent: BRAND.blue },
    { label: 'Activity Logs', value: logs.length, color: BRAND.greenLight, accent: BRAND.violet },
    { label: 'Briefing Sign-offs', value: briefings.length, color: BRAND.greenLight, accent: BRAND.green },
    { label: 'Equipment Items', value: assets.length + costItems.length, color: BRAND.greenLight, accent: BRAND.amber },
    { label: 'Confirmed Prices', value: confirmedQuotes.length, color: BRAND.greenLight, accent: BRAND.green },
    { label: 'Documents', value: documents.length, color: BRAND.greenLight, accent: BRAND.slate },
    { label: 'Photos', value: photos.length, color: BRAND.greenLight, accent: BRAND.cyan },
    { label: 'Milestones', value: milestones.length, color: BRAND.greenLight, accent: BRAND.indigo },
  ], 4);

  // --- Personnel ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('2. Personnel Assignments', SECTION_COLORS.personnel);
  paragraph(`${assignments.length} personnel assignment(s) recorded for this job.`, { size: 8.5 });
  const sortedAssignments = [...assignments].sort((a, b) => (a.assigned_date || '').localeCompare(b.assigned_date || ''));
  table(
    ['Staff Member', 'Date', 'Shift', 'Status', 'Briefing', 'Arrived'],
    sortedAssignments.map(a => [
      staffMap[a.staff_id] || 'Unknown',
      a.assigned_date || '—',
      `${a.start_time || '—'} → ${a.end_time || '—'}`,
      clean(a.status) || 'assigned',
      a.briefing_signed ? `Signed ${a.briefing_signed_at ? format(new Date(a.briefing_signed_at), 'dd MMM HH:mm') : ''}` : 'Not signed',
      a.arrived_on_site_at ? format(new Date(a.arrived_on_site_at), 'dd MMM HH:mm') : '—',
    ]),
    { colWidths: [34, 22, 30, 22, 38, 32], empty: 'No personnel assigned to this job.' }
  );

  // --- Technical Activity ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('3. Technical Activity Logs', SECTION_COLORS.activity);
  const allLogs = [...logs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  paragraph(`Total: ${logs.length} log(s) · ${logs.filter(l => l.manager_review_status === 'approved').length} approved · ${logs.filter(l => l.manager_review_status === 'pending').length} pending · ${logs.filter(l => l.manager_review_status === 'queried').length} queried`, { size: 8.5 });
  table(
    ['Type', 'Borehole', 'Date', 'Staff / Source', 'Details', 'Review'],
    allLogs.map(l => [
      clean(l.log_type) || 'activity',
      l.borehole_ref || l.sample_id || '—',
      l.date || '—',
      l.source === 'ags_import' ? 'AGS Import' : (l.staff_name || '—'),
      [
        l.depth_from != null && l.depth_to != null ? `${l.depth_from}m–${l.depth_to}m` : '',
        l.spt_n_value != null ? `SPT N=${l.spt_n_value}` : '',
        l.coring_rqd != null ? `RQD ${l.coring_rqd}%` : '',
      ].filter(Boolean).join(' ') || (l.description || '').slice(0, 60),
      clean(l.manager_review_status) || 'pending',
    ]),
    { colWidths: [28, 20, 20, 28, 54, 28], empty: 'No technical activity logs recorded for this job.' }
  );

  // --- Compliance ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('4. Compliance & Sign-offs', SECTION_COLORS.compliance);
  subHeader('Briefing Sign-offs', BRAND.green);
  table(
    ['Staff Member', 'Date', 'Summary'],
    briefings.map(b => [
      b.staff_name || b.signed_by_name || 'Staff member',
      b.created_date ? format(new Date(b.created_date), 'dd MMM yyyy HH:mm') : '—',
      b.job_briefing_summary || 'Site briefing & induction sign-off',
    ]),
    { colWidths: [40, 40, 98], empty: 'No briefing signatures recorded.' }
  );
  subHeader('Log Review Trail', BRAND.green);
  const approvedLogs2 = logs.filter(l => l.manager_review_status === 'approved');
  const pendingLogs = logs.filter(l => l.manager_review_status === 'pending');
  const queriedLogs = logs.filter(l => l.manager_review_status === 'queried');
  statCards([
    { label: 'Approved', value: approvedLogs2.length, color: BRAND.greenLight, accent: BRAND.green },
    { label: 'Pending', value: pendingLogs.length, color: BRAND.greenLight, accent: BRAND.amber },
    { label: 'Queried', value: queriedLogs.length, color: BRAND.greenLight, accent: BRAND.red },
  ], 3);
  if (queriedLogs.length > 0) {
    subHeader('Queried Logs (requiring attention)', BRAND.red);
    queriedLogs.forEach(l => {
      paragraph(`${clean(l.log_type)} — ${l.borehole_ref || 'site'}: ${l.manager_review_note || 'No review note'}`, { size: 8.5, indent: 4 });
    });
  }

  // --- Equipment ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('5. Equipment & Assets', SECTION_COLORS.equipment);
  subHeader('Assets on Site', BRAND.amber);
  table(
    ['Asset', 'Role', 'Assigned', 'Returned', 'Status'],
    assets.map(a => [
      a.asset_name || 'Asset',
      clean(a.role) || '—',
      a.assigned_date || '—',
      a.returned_date || '—',
      clean(a.status) || 'assigned',
    ]),
    { colWidths: [44, 34, 30, 30, 40], empty: 'No assets assigned.' }
  );
  subHeader('Cost Items', BRAND.amber);
  table(
    ['Description', 'Category', 'Qty', 'Unit Cost', 'Status'],
    costItems.map(c => {
      const isPOA = c.is_poa && !c.price_confirmed;
      return [
        c.description || '—',
        clean(c.category) || '—',
        `${c.quantity || 1} ${c.unit_label || ''}`,
        isPOA ? 'POA' : (c.price_confirmed ? gbp(c.negotiated_unit_cost) : gbp(c.unit_cost)),
        isPOA ? 'POA — unconfirmed' : (c.price_confirmed ? 'Confirmed' : 'Standard'),
      ];
    }),
    { colWidths: [50, 34, 24, 30, 40], empty: 'No cost items recorded.' }
  );

  // --- Commercial ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('6. Commercial Confirmations', SECTION_COLORS.commercial);
  const totalConfirmed = confirmedQuotes.reduce((s, c) => s + (Number(c.negotiated_unit_cost) || 0) * (Number(c.quantity) || 1), 0);
  paragraph(`Total confirmed commercial value: ${gbp(totalConfirmed)} across ${confirmedQuotes.length} confirmed price(s).`, { size: 9, bold: true });
  subHeader('Confirmed Prices (POA items with evidence)', BRAND.green);
  table(
    ['Description', 'Unit Price', 'Qty', 'Total', 'Confirmed By', 'Evidence'],
    confirmedQuotes.map(c => [
      c.description || '—',
      gbp(c.negotiated_unit_cost),
      `${c.quantity || 1} ${c.unit_label || ''}`,
      gbp(Number(c.negotiated_unit_cost) * (Number(c.quantity) || 1)),
      c.confirmed_by_name || '—',
      c.quote_document_name || '—',
    ]),
    { colWidths: [40, 24, 22, 24, 32, 36], empty: 'No confirmed prices recorded.' }
  );
  const poaItems = costItems.filter(c => c.is_poa && !c.price_confirmed);
  if (poaItems.length > 0) {
    subHeader('Outstanding POA Items (unconfirmed)', BRAND.amber);
    paragraph('These items have been added but their prices have not yet been confirmed — no commercial value is recorded.', { size: 8.5 });
    table(
      ['Description', 'Qty', 'Unit'],
      poaItems.map(c => [c.description || '—', `${c.quantity || 1}`, c.unit_label || '—']),
      { colWidths: [100, 40, 38], empty: '' }
    );
  }

  // --- Documents ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('7. Documents & Evidence', SECTION_COLORS.documents);
  subHeader('Job Documents', BRAND.slate);
  table(
    ['Document Name', 'Category', 'Uploaded By', 'Date', 'Client Visible'],
    documents.map(d => [
      d.document_name || '—',
      clean(d.category) || 'other',
      d.uploaded_by_name || '—',
      d.created_date ? format(new Date(d.created_date), 'dd MMM yyyy') : '—',
      d.client_visible ? 'Yes' : 'No',
    ]),
    { colWidths: [50, 30, 34, 30, 34], empty: 'No documents uploaded.' }
  );
  subHeader(`Site Photos (${photos.length})`, BRAND.cyan);
  if (photos.length === 0) {
    paragraph('No site photos recorded.', { size: 8.5 });
  } else {
    paragraph(`${photos.length} site photo(s) captured as evidence. Photos are stored digitally and available in the app's Documents section.`, { size: 8.5 });
    table(
      ['Caption', 'Uploaded By', 'Date'],
      photos.map(p => [
        (p.caption || 'Site photo').slice(0, 60),
        p.uploaded_by_name || '—',
        p.created_date ? format(new Date(p.created_date), 'dd MMM yyyy') : '—',
      ]),
      { colWidths: [78, 50, 50], empty: '' }
    );
  }

  // --- Timeline ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('8. Chronological Audit Trail', SECTION_COLORS.timeline);
  paragraph(`${timeline.length} event(s) in merged chronological order — the complete start-to-finish history of this job.`, { size: 8.5 });
  timelineItems(timelineRgb);

  // --- Final page: sign-off ---
  drawFooter(); newPage(); drawHeader();
  sectionHeader('9. Audit Sign-off', SECTION_COLORS.overview);
  cursor.y += 10;
  paragraph('This Job Pack has been generated automatically from the audit trail system. All records are traceable to their original source with timestamps and user attribution.', { size: 9 });
  cursor.y += 8;
  // Sign-off lines
  doc.setDrawColor(...BRAND.slate);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginLeft, cursor.y + 25, PAGE.marginLeft + 80, cursor.y + 25);
  doc.line(PAGE.marginLeft + 98, cursor.y + 25, PAGE.marginLeft + 178, cursor.y + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.slateLight);
  doc.text('Auditor Signature', PAGE.marginLeft, cursor.y + 29);
  doc.text('Date', PAGE.marginLeft + 98, cursor.y + 29);
  cursor.y += 35;
  doc.line(PAGE.marginLeft, cursor.y + 25, PAGE.marginLeft + 80, cursor.y + 25);
  doc.line(PAGE.marginLeft + 98, cursor.y + 25, PAGE.marginLeft + 178, cursor.y + 25);
  doc.text('Reviewed By', PAGE.marginLeft, cursor.y + 29);
  doc.text('Date', PAGE.marginLeft + 98, cursor.y + 29);

  drawFooter();

  // Save
  const safeName = (job.name || 'job').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  const ref = (job.job_reference || '').replace(/[^a-zA-Z0-9-_]/g, '');
  doc.save(`Audit_JobPack_${safeName}${ref ? `_${ref}` : ''}.pdf`);
}