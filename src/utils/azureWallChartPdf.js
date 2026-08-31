/**
 * A3 Wall Chart PDF Generator
 * Produces a comprehensive, print-optimized A3 landscape (420×297mm) PDF
 * laying out the full 13-week Azure migration roadmap, target architecture,
 * 1:1 parity summary, risks, and costs — designed to be hung on a wall.
 *
 * Uses jsPDF (installed) with vector drawing for crisp print at any size.
 */
import { jsPDF } from 'jspdf';
import {
  MIGRATION_SUMMARY, ENTITY_GROUPS, INFRASTRUCTURE,
} from '@/utils/azureMigrationData';

const BRAND = { r: 46, g: 90, b: 26 };       // #2E5A1A
const BRAND_LIGHT = { r: 141, g: 198, b: 63 }; // #8DC63F
const BRAND_DARK = { r: 28, g: 74, b: 18 };    // #1c4a12
const SLATE_900 = { r: 15, g: 23, b: 42 };
const SLATE_600 = { r: 71, g: 85, b: 105 };
const SLATE_400 = { r: 148, g: 163, b: 184 };
const SLATE_100 = { r: 241, g: 245, b: 249 };
const WHITE = { r: 255, g: 255, b: 255 };

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

function setFill(doc, c) { doc.setFillColor(c.r, c.g, c.b); }
function setText(doc, c) { doc.setTextColor(c.r, c.g, c.b); }
function setDraw(doc, c) { doc.setDrawColor(c.r, c.g, c.b); }

export function generateA3WallChart() {
  // A3 landscape: 420 × 297 mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const W = 420, H = 297;
  const M = 12; // margin

  // ── Background ──
  setFill(doc, WHITE);
  doc.rect(0, 0, W, H, 'F');

  // ── Title banner ──
  setFill(doc, BRAND);
  doc.rect(0, 0, W, 28, 'F');
  setFill(doc, BRAND_DARK);
  doc.rect(0, 26, W, 2, 'F');

  setText(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('GC Mission Control — Azure Migration Roadmap', M + 2, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('13-Week 1:1 Migration · UK South · Entra ID · Azure SQL · Functions Premium · GDPR-Compliant', M + 2, 20);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M - 2, 13, { align: 'right' });

  let y = 36;

  // ── 13-Week Timeline ──
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('13-Week Timeline', M, y);
  y += 3;

  // Timeline area
  const TL_LEFT = M + 48;   // left margin for phase labels
  const TL_RIGHT = W - M;
  const TL_WIDTH = TL_RIGHT - TL_LEFT;
  const WEEK_W = TL_WIDTH / 13;
  const BAR_H = 7;
  const BAR_GAP = 2.5;

  // Week header
  setFill(doc, SLATE_100);
  doc.rect(TL_LEFT, y, TL_WIDTH, 6, 'F');
  setText(doc, SLATE_600);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  for (let w = 1; w <= 13; w++) {
    doc.text(`W${w}`, TL_LEFT + (w - 0.5) * WEEK_W, y + 4.2, { align: 'center' });
  }
  y += 7;

  // Phase bars
  PHASES.forEach((p, i) => {
    const barY = y + i * (BAR_H + BAR_GAP);
    // Label
    setText(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(p.name, M, barY + BAR_H / 2 + 0.5, { align: 'right' });
    // Bar
    setFill(doc, { r: p.color[0], g: p.color[1], b: p.color[2] });
    const left = TL_LEFT + p.start * WEEK_W;
    const width = (p.end - p.start) * WEEK_W;
    doc.roundedRect(left, barY, width, BAR_H, 1.5, 1.5, 'F');
    setText(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    if (width > 30) {
      doc.text(p.name, left + 2, barY + BAR_H / 2 + 0.5);
    }
  });

  y += PHASES.length * (BAR_H + BAR_GAP) + 3;

  // Milestones
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Key Milestones:', M, y + 2);
  MILESTONES.forEach((m, i) => {
    const mx = M + 35 + i * 88;
    setFill(doc, BRAND);
    doc.circle(mx, y + 1.5, 1.8, 'F');
    setText(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`W${m.week}`, mx + 4, y + 2.5);
    setText(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(m.label, mx + 4, y + 6);
  });
  y += 14;

  // ── Two-column section: Architecture (left) + Parity Summary (right) ──
  const COL_W = (W - 2 * M - 6) / 2;
  const LEFT_X = M;
  const RIGHT_X = M + COL_W + 6;

  // Architecture table
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Target Architecture', LEFT_X, y);
  y += 3;

  const archRows = INFRASTRUCTURE.map(i => [i.layer, i.base44Source, i.azureTarget]);
  const archH = archRows.length * 6 + 8;
  setFill(doc, SLATE_100);
  doc.rect(LEFT_X, y, COL_W, archH, 'F');
  // Header
  setFill(doc, BRAND);
  doc.rect(LEFT_X, y, COL_W, 6, 'F');
  setText(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Layer', LEFT_X + 2, y + 4);
  doc.text('Today (Base44)', LEFT_X + 35, y + 4);
  doc.text('Target (Azure)', LEFT_X + COL_W * 0.52, y + 4);
  // Rows
  archRows.forEach((row, i) => {
    const ry = y + 6 + i * 6;
    if (i % 2 === 1) { setFill(doc, { r: 248, g: 250, b: 252 }); doc.rect(LEFT_X, ry, COL_W, 6, 'F'); }
    setText(doc, SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(row[0], LEFT_X + 2, ry + 4);
    setText(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], LEFT_X + 35, ry + 4);
    setText(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    doc.text(row[2], LEFT_X + COL_W * 0.52, ry + 4);
  });
  y += archH + 5;

  // Costs + Risks under architecture
  const bottomY = y;
  // Costs
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Indicative Monthly Cost', LEFT_X, bottomY);
  let cy = bottomY + 3;
  COSTS.forEach((c, i) => {
    const isTotal = i === COSTS.length - 1;
    setFill(doc, isTotal ? BRAND : { r: 248, g: 250, b: 252 });
    doc.rect(LEFT_X, cy, COL_W * 0.7, 5.5, 'F');
    setText(doc, isTotal ? WHITE : SLATE_600);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(c[0], LEFT_X + 2, cy + 3.8);
    doc.text(c[1], LEFT_X + COL_W * 0.7 - 2, cy + 3.8, { align: 'right' });
    cy += 6;
  });

  // ── 1:1 Parity Summary (right column) ──
  let ry2 = 39; // align with architecture top
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1:1 Parity Summary', RIGHT_X, ry2);
  ry2 += 3;

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

  parityStats.forEach((s, i) => {
    const isHeader = !s[0].startsWith('  ·');
    setFill(doc, isHeader ? { r: 241, g: 245, b: 249 } : { r: 248, g: 250, b: 252 });
    doc.rect(RIGHT_X, ry2, COL_W, 6, 'F');
    setText(doc, isHeader ? SLATE_900 : SLATE_600);
    doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(s[0], RIGHT_X + 2, ry2 + 4);
    setText(doc, BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(String(s[1]), RIGHT_X + COL_W - 2, ry2 + 4, { align: 'right' });
    ry2 += 6;
  });
  ry2 += 3;

  // Entity categories breakdown
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Entity Categories (→ SQL table groups)', RIGHT_X, ry2);
  ry2 += 3;
  Object.entries(ENTITY_GROUPS).forEach(([cat, items]) => {
    setFill(doc, { r: 248, g: 250, b: 252 });
    doc.rect(RIGHT_X, ry2, COL_W, 5, 'F');
    setText(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(cat, RIGHT_X + 2, ry2 + 3.5);
    setText(doc, BRAND_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.text(`${items.length} tables`, RIGHT_X + COL_W - 2, ry2 + 3.5, { align: 'right' });
    ry2 += 5;
  });

  // ── Risks (bottom right) ──
  const riskY = ry2 + 3;
  setText(doc, SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Risk & Mitigation', RIGHT_X, riskY);
  let rky = riskY + 3;
  RISKS.forEach((r, i) => {
    setFill(doc, { r: 248, g: 250, b: 252 });
    doc.rect(RIGHT_X, rky, COL_W, 9, 'F');
    setText(doc, SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(r[0], RIGHT_X + 2, rky + 3.5);
    // Severity badge
    const sevColor = r[1] === 'High' ? { r: 220, g: 38, b: 38 } : { r: 217, g: 119, b: 6 };
    setFill(doc, sevColor);
    doc.roundedRect(RIGHT_X + COL_W - 14, rky + 1, 12, 4, 1, 1, 'F');
    setText(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(r[1], RIGHT_X + COL_W - 8, rky + 4, { align: 'center' });
    setText(doc, SLATE_600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(r[2], RIGHT_X + 2, rky + 7.5, { maxWidth: COL_W - 4 });
    rky += 10;
  });

  // ── Footer ──
  setFill(doc, BRAND_DARK);
  doc.rect(0, H - 8, W, 8, 'F');
  setText(doc, WHITE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('GC Mission Control · Azure-Native Migration · 1:1 Parity Guaranteed · Print on A3 Landscape', M + 2, H - 3);
  doc.text('Page 1 of 1', W - M - 2, H - 3, { align: 'right' });

  doc.save('GC-Mission-Control-Azure-Migration-A3-WallChart.pdf');
}