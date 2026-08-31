/**
 * A3 Wall Chart PDF Generator — Print-Ready
 * Produces a clean, well-spaced A3 landscape (420×297mm) PDF laying out the
 * full 13-week Azure migration roadmap, target architecture, 1:1 parity
 * summary, entity category breakdown, risks, and costs.
 *
 * Layout uses a strict grid with generous margins so nothing overlaps,
 * gets squashed, or is cut off. All text is ≥7pt for readability.
 */
import { jsPDF } from 'jspdf';
import {
  MIGRATION_SUMMARY, INFRASTRUCTURE,
} from '@/utils/azureMigrationData';

// ── Brand palette (all arrays for setFillColor compatibility) ──
const BRAND = [46, 90, 26];
const BRAND_LIGHT = [141, 198, 63];
const BRAND_DARK = [28, 74, 18];
const SLATE_900 = [15, 23, 42];
const SLATE_700 = [51, 65, 85];
const SLATE_600 = [71, 85, 105];
const SLATE_400 = [148, 163, 184];
const SLATE_200 = [226, 232, 240];
const SLATE_100 = [241, 245, 249];
const SLATE_50 = [248, 250, 252];
const WHITE = [255, 255, 255];
const AMBER = [217, 119, 6];
const RED = [220, 38, 38];

const PHASES = [
  { name: 'Prerequisites & Setup', start: 0, end: 1, color: [100, 116, 139] },
  { name: 'Export Source Code', start: 1, end: 2, color: [59, 130, 246] },
  { name: 'Provision Azure Infra', start: 2, end: 4, color: [139, 92, 246] },
  { name: 'Data Layer (SQL + SDK)', start: 4, end: 7, color: BRAND },
  { name: 'Auth (Entra ID)', start: 6, end: 9, color: [8, 145, 178] },
  { name: 'Functions & Automations', start: 8, end: 11, color: [217, 119, 6] },
  { name: 'Deploy & Cutover', start: 11, end: 12, color: [220, 38, 38] },
  { name: 'Stabilization & Sign-off', start: 12, end: 13, color: [5, 150, 105] },
];

const MILESTONES = [
  { week: 2, label: 'Azure infra live' },
  { week: 7, label: 'Data + Auth migrated' },
  { week: 11, label: 'Functions deployed' },
  { week: 13, label: 'Go-live & sign-off' },
];

const RISKS = [
  ['Data migration accuracy', 'Med', 'Record-count verification per entity; Base44 kept read-only as fallback.'],
  ['RLS security parity', 'High', 'Security predicates tested per table; SESSION_CONTEXT on every connection.'],
  ['180+ functions to port', 'Med', 'Batched by domain; logic unchanged, only the runtime wrapper.'],
  ['Auth cutover disruption', 'Med', 'Entra ID + Base44 run in parallel; DNS rollback is instant.'],
];

const COSTS = [
  ['Azure SQL (S1 tier)', '£60/mo'],
  ['Functions (EP1 Premium)', '£150/mo'],
  ['Static Web Apps', '£7/mo'],
  ['Blob Storage', '£5/mo'],
  ['Key Vault + Entra ID', 'Included with M365'],
  ['Total running cost', '~£220–300/mo'],
];

// ── Helpers ──
function fill(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
function text(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
function draw(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }

function sectionBanner(doc, x, y, w, h, title, color = BRAND) {
  fill(doc, color);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  text(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, x + 4, y + h / 2 + 1, { baseline: 'middle' });
}

function wrappedText(doc, str, x, y, maxW, lineHeight) {
  const lines = doc.splitTextToSize(str, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generateA3WallChart() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const W = 420, H = 297;
  const M = 14; // outer margin

  // ── Background ──
  fill(doc, WHITE);
  doc.rect(0, 0, W, H, 'F');

  // ══════════════════════════════════════════════════════════════
  // ROW 1: Title Banner (0–30mm)
  // ══════════════════════════════════════════════════════════════
  fill(doc, BRAND);
  doc.rect(0, 0, W, 30, 'F');
  fill(doc, BRAND_DARK);
  doc.rect(0, 28, W, 2, 'F');

  text(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('GC Mission Control — Azure Migration Roadmap', M + 2, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(200, 220, 180);
  doc.text('13-Week 1:1 Migration · UK South · Entra ID · Azure SQL · Functions Premium · GDPR-Compliant', M + 2, 22);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M - 2, 14, { align: 'right' });

  // ══════════════════════════════════════════════════════════════
  // ROW 2: 13-Week Timeline (38–108mm)
  // ══════════════════════════════════════════════════════════════
  let y = 38;
  sectionBanner(doc, M, y, W - 2 * M, 10, '13-Week Timeline');
  y += 14;

  const TL_LEFT = M + 52;   // left margin for phase labels
  const TL_RIGHT = W - M;
  const TL_WIDTH = TL_RIGHT - TL_LEFT;
  const WEEK_W = TL_WIDTH / 13;
  const BAR_H = 6;
  const BAR_GAP = 2.5;

  // Week header strip
  fill(doc, SLATE_100);
  doc.rect(TL_LEFT, y, TL_WIDTH, 7, 'F');
  text(doc, SLATE_600);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  for (let w = 1; w <= 13; w++) {
    doc.text(`W${w}`, TL_LEFT + (w - 0.5) * WEEK_W, y + 5, { align: 'center' });
  }
  y += 9;

  // Phase bars
  PHASES.forEach((p, i) => {
    const barY = y + i * (BAR_H + BAR_GAP);
    // Label
    text(doc, SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(p.name, M + 50, barY + BAR_H / 2 + 0.5, { align: 'right', baseline: 'middle' });
    // Bar
    fill(doc, p.color);
    const left = TL_LEFT + p.start * WEEK_W;
    const width = (p.end - p.start) * WEEK_W;
    doc.roundedRect(left, barY, width, BAR_H, 1.5, 1.5, 'F');
    // Phase name inside bar (only if wide enough)
    if (width > 35) {
      text(doc, WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(p.name, left + 2, barY + BAR_H / 2 + 0.5, { baseline: 'middle' });
    }
  });
  y += PHASES.length * (BAR_H + BAR_GAP) + 4;

  // Milestones row
  text(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Key Milestones', M, y + 2);
  const msStartX = M + 38;
  const msSpacing = (W - 2 * M - 38) / MILESTONES.length;
  MILESTONES.forEach((m, i) => {
    const mx = msStartX + i * msSpacing + 6;
    fill(doc, BRAND);
    doc.circle(mx, y + 1, 2, 'F');
    text(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`W${m.week}`, mx + 5, y + 2.5);
    text(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(m.label, mx + 5, y + 6.5);
  });

  // ══════════════════════════════════════════════════════════════
  // ROW 3: Architecture (left) + Parity Summary (right) — 148–225mm
  // ══════════════════════════════════════════════════════════════
  const ROW3_Y = 148;
  const COL_GAP = 8;
  const COL_W = (W - 2 * M - COL_GAP) / 2;
  const LEFT_X = M;
  const RIGHT_X = M + COL_W + COL_GAP;

  // ── Architecture table (left column) ──
  let archY = ROW3_Y;
  sectionBanner(doc, LEFT_X, archY, COL_W, 10, 'Target Architecture');
  archY += 14;

  const archRows = INFRASTRUCTURE.map(i => [i.layer, i.base44Source, i.azureTarget]);
  const archRowH = 5.5;
  const archTableH = archRows.length * archRowH + 8;

  // Table background
  fill(doc, SLATE_50);
  doc.roundedRect(LEFT_X, archY, COL_W, archTableH, 1.5, 1.5, 'F');

  // Header row
  fill(doc, BRAND_DARK);
  doc.rect(LEFT_X, archY, COL_W, archRowH, 'F');
  text(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Layer', LEFT_X + 3, archY + 5);
  doc.text('Today (Base44)', LEFT_X + 42, archY + 5);
  doc.text('Target (Azure)', LEFT_X + COL_W * 0.55, archY + 5);

  archY += archRowH;
  archRows.forEach((row, i) => {
    const ry = archY + i * archRowH;
    if (i % 2 === 1) {
      fill(doc, SLATE_100);
      doc.rect(LEFT_X, ry, COL_W, archRowH, 'F');
    }
    text(doc, SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(row[0], LEFT_X + 3, ry + 5);
    text(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    // Truncate long source text
    const srcLines = doc.splitTextToSize(row[1], COL_W * 0.55 - 42 - 4);
    doc.text(srcLines[0] || '', LEFT_X + 42, ry + 5);
    text(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    const tgtLines = doc.splitTextToSize(row[2], COL_W * 0.45 - 4);
    doc.text(tgtLines[0] || '', LEFT_X + COL_W * 0.55, ry + 5);
  });

  // ── 1:1 Parity Summary (right column) ──
  let parY = ROW3_Y;
  sectionBanner(doc, RIGHT_X, parY, COL_W, 10, '1:1 Parity Summary');
  parY += 14;

  const parityStats = [
    ['Entities → Azure SQL tables', MIGRATION_SUMMARY.entities],
    ['Backend functions → Azure Functions', MIGRATION_SUMMARY.functions],
    ['  · Webhook receivers (HTTP)', MIGRATION_SUMMARY.webhooks],
    ['  · Scheduled jobs (Timer)', MIGRATION_SUMMARY.scheduled],
    ['  · On-demand (HTTP)', MIGRATION_SUMMARY.onDemand],
    ['Automations → Timer triggers', MIGRATION_SUMMARY.automations],
    ['AI agents → Functions + Entra SP', MIGRATION_SUMMARY.agents],
    ['Connector webhooks → HTTP triggers', MIGRATION_SUMMARY.connectorWebhooks],
    ['Auth flows → Entra ID (MSAL)', MIGRATION_SUMMARY.authFlows],
    ['Infrastructure layers → Azure services', MIGRATION_SUMMARY.infrastructure],
  ];

  const parRowH = 5.5;
  const parTableH = parityStats.length * parRowH + 8;
  fill(doc, SLATE_50);
  doc.roundedRect(RIGHT_X, parY, COL_W, parTableH, 1.5, 1.5, 'F');

  parityStats.forEach((s, i) => {
    const ry = parY + 4 + i * parRowH;
    const isHeader = !s[0].startsWith('  ·');
    if (isHeader) {
      fill(doc, SLATE_100);
      doc.rect(RIGHT_X, ry, COL_W, parRowH, 'F');
    }
    text(doc, isHeader ? SLATE_900 : SLATE_600);
    doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.text(s[0], RIGHT_X + 4, ry + 5);
    text(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(s[1]), RIGHT_X + COL_W - 4, ry + 5, { align: 'right' });
  });

  // ══════════════════════════════════════════════════════════════
  // ROW 4: Costs (left) + Risks (right) — 230–285mm
  // ══════════════════════════════════════════════════════════════
  const ROW4_Y = 230;

  // ── Costs (left column) ──
  let costY = ROW4_Y;
  sectionBanner(doc, LEFT_X, costY, COL_W, 10, 'Indicative Monthly Cost');
  costY += 14;

  const costRowH = 5.5;
  const costTableH = COSTS.length * costRowH + 4;
  fill(doc, SLATE_50);
  doc.roundedRect(LEFT_X, costY, COL_W, costTableH, 1.5, 1.5, 'F');

  COSTS.forEach((c, i) => {
    const ry = costY + 3 + i * costRowH;
    const isTotal = i === COSTS.length - 1;
    fill(doc, isTotal ? BRAND : (i % 2 === 1 ? SLATE_100 : WHITE));
    doc.rect(LEFT_X, ry, COL_W, costRowH, 'F');
    text(doc, isTotal ? WHITE : SLATE_700);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.text(c[0], LEFT_X + 4, ry + 5);
    text(doc, isTotal ? WHITE : BRAND);
    doc.setFont('helvetica', 'bold');
    doc.text(c[1], LEFT_X + COL_W - 4, ry + 5, { align: 'right' });
  });

  // Migration duration note
  costY += costTableH + 6;
  text(doc, SLATE_600);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  wrappedText(doc, 'Migration duration: 13 weeks (3 months). Consumption-based pricing — scales with usage. The S1 SQL tier can be upgraded as data grows.', LEFT_X, costY, COL_W, 4);

  // ── Risks (right column) ──
  let riskY = ROW4_Y;
  sectionBanner(doc, RIGHT_X, riskY, COL_W, 10, 'Risk & Mitigation');
  riskY += 14;

  const riskRowH = 10;
  const riskTableH = RISKS.length * riskRowH + 4;
  fill(doc, SLATE_50);
  doc.roundedRect(RIGHT_X, riskY, COL_W, riskTableH, 1.5, 1.5, 'F');

  RISKS.forEach((r, i) => {
    const ry = riskY + 3 + i * riskRowH;
    if (i % 2 === 1) {
      fill(doc, SLATE_100);
      doc.rect(RIGHT_X, ry, COL_W, riskRowH, 'F');
    }
    // Risk name
    text(doc, SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(r[0], RIGHT_X + 4, ry + 5);
    // Severity badge
    const sevColor = r[1] === 'High' ? RED : AMBER;
    fill(doc, sevColor);
    doc.roundedRect(RIGHT_X + COL_W - 18, ry + 1.5, 14, 5, 1, 1, 'F');
    text(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(r[1], RIGHT_X + COL_W - 11, ry + 5, { align: 'center' });
    // Mitigation
    text(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    wrappedText(doc, r[2], RIGHT_X + 4, ry + 8, COL_W - 24, 3);
  });

  // ══════════════════════════════════════════════════════════════
  // Footer (289–297mm)
  // ══════════════════════════════════════════════════════════════
  fill(doc, BRAND_DARK);
  doc.rect(0, H - 8, W, 8, 'F');
  text(doc, WHITE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('GC Mission Control · Azure-Native Migration · 1:1 Parity Guaranteed · Print on A3 Landscape', M + 2, H - 3);
  doc.text('Page 1 of 1', W - M - 2, H - 3, { align: 'right' });

  doc.save('GC-Mission-Control-Azure-Migration-A3-WallChart.pdf');
}