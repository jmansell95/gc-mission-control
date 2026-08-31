// ============================================================
// Team Briefing Pack — PDF Builder
// Multi-page A4 PDF with cover page, page breaks between sections,
// clean typography, and consistent branding. Print-ready.
// ============================================================
import { jsPDF } from 'jspdf';
import {
  whyBuilt, hubTour, deepDive, closingPoints,
} from '@/lib/teamBriefingContent';

const BRAND = '#2E5A1A';
const BRAND_LIGHT = '#8DC63F';
const BRAND_DARK = '#1c4a12';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';
const WHITE = '#ffffff';

function textHeight(doc, text, maxW, lineHeight) {
  return doc.splitTextToSize(text, maxW).length * lineHeight;
}

function wrapped(doc, text, x, y, maxW, lineHeight) {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawFooter(doc, margin, pageW, pageH) {
  doc.setDrawColor(SLATE_300);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
  doc.setTextColor(SLATE_500);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('GC Mission Control · Team Briefing · Internal Use Only', margin, pageH - 22);
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  doc.text(`Page ${pageNum}`, pageW - margin, pageH - 22, { align: 'right' });
}

function sectionHeader(doc, margin, pageW, title, subtitle) {
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 76, 'F');
  doc.setFillColor(BRAND_LIGHT);
  doc.rect(0, 76, pageW, 3, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 180);
  doc.text(subtitle, margin, 56);
}

function drawTalkingPoints(doc, margin, pageW, points, y) {
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2 - 24;
  const pointH = 8;
  points.forEach((p, i) => {
    const lines = doc.splitTextToSize(p, maxW);
    const blockH = lines.length * pointH + 6;
    if (y + blockH > pageH - 46) { doc.addPage(); y = 100; }
    // Bullet dot
    doc.setFillColor(BRAND_LIGHT);
    doc.circle(margin + 3, y - 1.5, 2, 'F');
    // Text
    doc.setTextColor(SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(lines, margin + 12, y);
    y += blockH;
  });
  return y;
}

export async function buildTeamBriefingPDF(logoUrl) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  let logoImg = null;
  if (logoUrl) {
    try {
      logoImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = logoUrl;
      });
    } catch (e) { /* skip */ }
  }

  // ════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 280, 'F');
  doc.setFillColor(BRAND_LIGHT);
  doc.rect(0, 280, pageW, 4, 'F');
  if (logoImg) {
    const logoH = 56;
    const logoW = logoImg.naturalWidth * (logoH / logoImg.naturalHeight);
    doc.addImage(logoImg, 'PNG', margin, 48, logoW, logoH);
  }
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('GC Mission Control', margin, 150);
  doc.setFontSize(20);
  doc.text('Team Briefing Pack', margin, 180);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(200, 220, 180);
  doc.text('A full walkthrough of the platform — why we built it, every hub, and what is new', margin, 205);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), margin, 230);

  // Cover stats
  let y = 320;
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('What is inside this pack', margin, y);
  y += 20;

  const coverItems = [
    'Part 1 — Why we built this platform and what it changes',
    'Part 2 — A tour of every hub: Enterprise, Staff, Fleet, Assets, Compliance, Financial, Logistics, Operations, Settings',
    'Part 3 — Deep-dive on recent major work: Azure migration, multi-hub dashboard, parity matrix, A3 chart, settings overhaul, real-time sync, autopilot agents, AI assistants',
    'Part 4 — What this means for your role and what to do next',
  ];
  coverItems.forEach((item) => {
    doc.setFillColor(BRAND_LIGHT);
    doc.circle(margin + 3, y - 2, 2, 'F');
    doc.setTextColor(SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y = wrapped(doc, item, margin + 12, y, pageW - margin * 2 - 12, 14);
    y += 8;
  });

  drawFooter(doc, margin, pageW, pageH);

  // ════════════════════════════════════════════════════════════
  // PART 1: WHY WE BUILT THIS
  // ════════════════════════════════════════════════════════════
  doc.addPage();
  sectionHeader(doc, margin, pageW, whyBuilt.title, whyBuilt.subtitle);
  y = 100;

  // Intro
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('The problem we faced', margin, y);
  y += 16;
  doc.setTextColor(SLATE_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = wrapped(doc, whyBuilt.intro, margin, y, pageW - margin * 2, 14);
  y += 14;

  // Problems list
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('What was going wrong', margin, y);
  y += 16;
  y = drawTalkingPoints(doc, margin, pageW, whyBuilt.problems, y);
  y += 10;

  // Solution
  if (y > pageH - 120) { doc.addPage(); y = 100; }
  doc.setFillColor(BRAND);
  doc.roundedRect(margin, y, pageW - margin * 2, 70, 8, 8, 'F');
  doc.setFillColor(BRAND_LIGHT);
  doc.roundedRect(margin, y, 4, 70, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('The solution', margin + 16, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 240, 200);
  wrapped(doc, whyBuilt.solution, margin + 16, y + 38, pageW - margin * 2 - 32, 14);
  y += 86;

  // Outcomes
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('What it changes', margin, y);
  y += 16;
  const colW = (pageW - margin * 2 - 16) / 2;
  whyBuilt.outcomes.forEach((o, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + 16);
    const oy = y + row * 68;
    if (oy > pageH - 80) { doc.addPage(); y = 100; }
    doc.setFillColor(SLATE_50);
    doc.roundedRect(x, oy, colW, 58, 6, 6, 'F');
    doc.setFillColor(BRAND);
    doc.roundedRect(x, oy, colW, 22, 6, 6, 'F');
    doc.roundedRect(x, oy + 12, colW, 10, 0, 0, 'F');
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(o.label, x + 12, oy + 15);
    doc.setTextColor(SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    wrapped(doc, o.value, x + 10, oy + 36, colW - 20, 12);
  });
  drawFooter(doc, margin, pageW, pageH);

  // ════════════════════════════════════════════════════════════
  // PART 2: PLATFORM TOUR — every hub
  // ════════════════════════════════════════════════════════════
  doc.addPage();
  sectionHeader(doc, margin, pageW, 'Part 2 — Platform Tour', 'A high-level walkthrough of every hub in the system');
  y = 100;
  doc.setTextColor(SLATE_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = wrapped(doc, 'The platform is organised into nine hubs — each one a dedicated workspace for a specific operational domain. Here is what each one does and the key things to know.', margin, y, pageW - margin * 2, 14);
  y += 10;
  drawFooter(doc, margin, pageW, pageH);

  // Each hub gets its own page
  hubTour.forEach((hub, idx) => {
    doc.addPage();
    sectionHeader(doc, margin, pageW, hub.name, hub.summary);
    y = 100;

    doc.setTextColor(SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Key talking points', margin, y);
    y += 16;
    y = drawTalkingPoints(doc, margin, pageW, hub.talkingPoints, y);
    drawFooter(doc, margin, pageW, pageH);
  });

  // ════════════════════════════════════════════════════════════
  // PART 3: DEEP-DIVE — recent major work
  // ════════════════════════════════════════════════════════════
  doc.addPage();
  sectionHeader(doc, margin, pageW, 'Part 3 — Deep-Dive', 'Recent major work and what is coming next');
  y = 100;
  doc.setTextColor(SLATE_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = wrapped(doc, 'This section covers the major additions and improvements we have made recently — the Azure migration plan, the multi-hub dashboard restructure, the parity matrix, the A3 wall chart, the settings overhaul, real-time data sync, autopilot agents and AI assistants.', margin, y, pageW - margin * 2, 14);
  y += 10;
  drawFooter(doc, margin, pageW, pageH);

  // Each deep-dive topic gets its own page
  deepDive.forEach((topic) => {
    doc.addPage();
    sectionHeader(doc, margin, pageW, topic.name, topic.summary);
    y = 100;

    doc.setTextColor(SLATE_900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Key talking points', margin, y);
    y += 16;
    y = drawTalkingPoints(doc, margin, pageW, topic.talkingPoints, y);
    drawFooter(doc, margin, pageW, pageH);
  });

  // ════════════════════════════════════════════════════════════
  // PART 4: WHAT THIS MEANS FOR YOU
  // ════════════════════════════════════════════════════════════
  doc.addPage();
  sectionHeader(doc, margin, pageW, closingPoints.title, closingPoints.subtitle);
  y = 100;

  closingPoints.roles.forEach((roleBlock) => {
    if (y > pageH - 140) { doc.addPage(); y = 100; }
    // Role header
    doc.setFillColor(BRAND);
    doc.roundedRect(margin, y, pageW - margin * 2, 24, 4, 4, 'F');
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(roleBlock.role, margin + 10, y + 16);
    y += 32;

    roleBlock.points.forEach((p) => {
      if (y > pageH - 60) { doc.addPage(); y = 100; }
      doc.setFillColor(BRAND_LIGHT);
      doc.circle(margin + 3, y - 2, 2, 'F');
      doc.setTextColor(SLATE_700);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y = wrapped(doc, p, margin + 12, y, pageW - margin * 2 - 12, 14);
      y += 8;
    });
    y += 10;
  });

  // Closing call to action
  if (y > pageH - 100) { doc.addPage(); y = 100; }
  doc.setFillColor(BRAND);
  doc.roundedRect(margin, y, pageW - margin * 2, 60, 8, 8, 'F');
  doc.setFillColor(BRAND_LIGHT);
  doc.roundedRect(margin, y, 4, 60, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('What to do next', margin + 16, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 240, 200);
  wrapped(doc, 'Explore the platform — open each hub, try the features, ask questions. The infrastructure is built, the integrations are live, and the audit trail is running. The remaining work is adoption — getting every crew logging through the app rather than on paper.', margin + 16, y + 38, pageW - margin * 2 - 32, 14);

  drawFooter(doc, margin, pageW, pageH);

  doc.save(`GC-Mission-Control-Team-Briefing-${new Date().toISOString().slice(0, 10)}.pdf`);
}