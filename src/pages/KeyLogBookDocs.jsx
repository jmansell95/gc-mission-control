import React from 'react';
import { Download, FileText, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';

export default function KeyLogBookDocs() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 50;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (need) => {
      if (y + need > pageH - margin) { doc.addPage(); y = margin; }
    };

    const addHeading = (text, size = 16) => {
      ensureSpace(size + 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(46, 90, 26);
      doc.text(text, margin, y);
      y += size + 6;
      doc.setDrawColor(141, 198, 63);
      doc.setLineWidth(1.5);
      doc.line(margin, y, margin + contentW, y);
      y += 14;
    };

    const addSubHeading = (text) => {
      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, y);
      y += 16;
    };

    const addParagraph = (text, size = 10) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(text, contentW);
      lines.forEach((line) => {
        ensureSpace(size + 4);
        doc.text(line, margin, y);
        y += size + 4;
      });
      y += 6;
    };

    const addKeyValue = (key, value) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(key, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const valLines = doc.splitTextToSize(value, contentW - 140);
      valLines.forEach((line, i) => {
        ensureSpace(14);
        doc.text(line, margin + 140, y + (i * 14));
      });
      y += Math.max(14, valLines.length * 14) + 4;
    };

    const addCodeBlock = (code) => {
      const lines = doc.splitTextToSize(code, contentW - 20);
      const blockH = lines.length * 11 + 16;
      ensureSpace(blockH);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, contentW, blockH, 4, 4, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      lines.forEach((line, i) => {
        doc.text(line, margin + 10, y + 14 + (i * 11));
      });
      y += blockH + 10;
    };

    const addTable = (headers, rows) => {
      const colW = contentW / headers.length;
      ensureSpace(24);
      doc.setFillColor(46, 90, 26);
      doc.rect(margin, y, contentW, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      headers.forEach((h, i) => {
        doc.text(h, margin + i * colW + 6, y + 15);
      });
      y += 22;
      rows.forEach((row, ri) => {
        const rowH = 20;
        ensureSpace(rowH);
        if (ri % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentW, rowH, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        row.forEach((cell, i) => {
          const cellLines = doc.splitTextToSize(String(cell), colW - 12);
          doc.text(cellLines[0] || '', margin + i * colW + 6, y + 13);
        });
        y += rowH;
      });
      y += 10;
    };

    // === COVER ===
    doc.setFillColor(46, 90, 26);
    doc.rect(0, 0, pageW, 140, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(255, 255, 255);
    doc.text('GC Mission Control', margin, 70);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(141, 198, 63);
    doc.text('KeyLogBook Webhook Integration Specification', margin, 95);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`Document Version 1.0  ·  ${new Date().toLocaleDateString('en-GB')}`, margin, 118);
    y = 175;

    addParagraph('This document defines the webhook integration between KeyLogBook and GC Mission Control — our field operations, compliance, and financial lifecycle platform. It is intended for the KeyLogBook development team to implement automated data push from KeyLogBook into our system.');
    y += 10;

    // === 1. OVERVIEW ===
    addHeading('1. Overview');
    addParagraph('GC Mission Control ingests real-time borehole log data and driller daily remarks from KeyLogBook via a single webhook endpoint. The integration supports two data streams:');
    addParagraph('• Stream 1 — Driller Remarks: Free-text daily remarks (e.g. "7:30_8:45 = Start briefing...") are parsed into individual time-stamped activities, AI-professionalised, and saved as pending Site Logs for manager review. On approval, these auto-generate timesheet entries.');
    addParagraph('• Stream 2 — Structured Borehole Data: Technical borehole/log records (AGS-style) are ingested as read-only records shown in our Borehole Data Explorer.');
    y += 6;

    // === 2. ENDPOINT ===
    addHeading('2. Webhook Endpoint');
    addKeyValue('URL', 'https://gc-mission-control.base44.app/api/functions/receiveKeyLogBookData');
    addKeyValue('Method', 'POST');
    addKeyValue('Content-Type', 'application/json');
    y += 6;

    // === 3. AUTH ===
    addHeading('3. Authentication');
    addParagraph('All requests must include a shared secret token for validation. The token is configured in the GC Mission Control admin panel under Settings → KeyLogBook. Include it in one of the following ways:');
    addParagraph('• Header: x-klb-signature: <shared-secret>');
    addParagraph('• Header: x-keylogbook-signature: <shared-secret>');
    addParagraph('• Query parameter: ?secret=<shared-secret>');
    addParagraph('Requests without a valid secret receive a 401 response. If sync is disabled in our admin panel, a 403 is returned.', 9);
    y += 6;

    // === 4. PAYLOAD ===
    addHeading('4. Payload Structure');
    addParagraph('The webhook expects a JSON object. Fields marked optional may be omitted; the system applies sensible defaults.');
    addTable(
      ['Field', 'Type', 'Description'],
      [
        ['job_reference', 'string', 'Our internal job reference or PO number. Used to match the log to an active Job. Required unless job_id is provided.'],
        ['job_id', 'string', 'Explicit GC Mission Control Job ID (UUID). Takes precedence over job_reference. Optional.'],
        ['date', 'string', 'Working date in YYYY-MM-DD format. Defaults to today if omitted.'],
        ['lead_driller_name', 'string', 'Full name of the lead driller on shift. Optional but recommended.'],
        ['lead_driller_id', 'string', 'GC Mission Control Staff ID (UUID). Optional.'],
        ['meterage', 'number', 'Total metres drilled that day. Optional.'],
        ['remarks', 'string', 'Driller daily remarks string. Parsed into time-stamped activities. Optional but this is the primary value stream.'],
        ['notes', 'string', 'Alternative field for remarks (used if remarks is empty).'],
        ['boreholes', 'array', 'Structured borehole records (reference, final_depth, date, notes). Optional.'],
        ['logs', 'array', 'Structured log entries (log_type, borehole_ref, depth_from, depth_to, description). Optional.'],
      ]
    );
    y += 4;

    // === 5. REMARKS FORMAT ===
    addHeading('5. Driller Remarks Format');
    addParagraph('The remarks string is the most important field. Our parser splits it into individual activities using the pattern "HH:MM_HH:MM = description". Each segment becomes a separate Site Log entry with start time, end time, duration, and description.');
    addSubHeading('Example remarks string:');
    addCodeBlock('7:30_8:00 = Travel to site\n8:00_8:30 = Site setup and induction\n8:30_12:00 = Drilling BH-01 cable percussion\n12:00_12:30 = Break\n12:30_16:00 = Drilling BH-01 continued, sampling at 5m');
    y += 4;

    // === 6. EXAMPLE PAYLOAD ===
    addHeading('6. Example Payload');
    addCodeBlock(`{
  "job_reference": "EWR-001",
  "date": "2026-08-03",
  "lead_driller_name": "John Smith",
  "meterage": 12.5,
  "remarks": "7:30_8:00 = Travel to site\\n8:00_8:30 = Site setup and induction\\n8:30_12:00 = Drilling BH-01",
  "boreholes": [
    {
      "reference": "BH-01",
      "final_depth": 12.5,
      "date": "2026-08-03",
      "notes": "Made ground to 2m, stiff clay below"
    }
  ],
  "logs": [
    {
      "log_type": "borehole_progress",
      "borehole_ref": "BH-01",
      "depth_from": 0,
      "depth_to": 12.5,
      "description": "Cable percussion drilling in made ground"
    }
  ]
}`);
    y += 6;

    // === 7. RESPONSES ===
    addHeading('7. Response Codes');
    addTable(
      ['Status', 'Code', 'Meaning'],
      [
        ['Success', '200', 'Payload processed. Returns job_id, logs_inserted, remarks_activities, borehole_records.'],
        ['Bad Request', '400', 'Invalid JSON payload.'],
        ['Unauthorized', '401', 'Missing or invalid shared secret.'],
        ['Forbidden', '403', 'KeyLogBook sync is disabled in the admin panel.'],
        ['Service Unavailable', '503', 'Webhook secret not configured on our side.'],
        ['Unprocessable', '422', 'job_reference could not be matched to an existing Job. Ensure the reference matches our Job reference field exactly (case-insensitive).'],
        ['Server Error', '500', 'Unexpected processing error.'],
      ]
    );
    y += 4;

    // === 8. SUCCESS RESPONSE ===
    addHeading('8. Success Response Body');
    addCodeBlock(`{
  "status": "success",
  "job_id": "uuid-here",
  "job_name": "EWR Geotechnical SI - Lot 1",
  "deleted": 5,
  "logs_inserted": 8,
  "remarks_activities": 5,
  "borehole_records": 3,
  "lead_driller": "John Smith",
  "summary": "Processed 8 log entries · 5 site log activities (pending review) · 3 borehole records"
}`);
    y += 6;

    // === 9. BEHAVIOUR NOTES ===
    addHeading('9. Behaviour Notes');
    addParagraph('• Overwrite Mode: Each webhook call replaces previous KeyLogBook-imported data for the same job + date. This allows drillers to re-submit corrected logs without creating duplicates.');
    addParagraph('• Job Matching: The system matches job_reference case-insensitively — first by exact job_reference, then by exact job name, then by partial match. Providing job_id (UUID) guarantees an exact match.');
    addParagraph('• Driller Attribution: If lead_driller_name is omitted, the system resolves the driller from the day\'s rota assignment, preferring staff on a drilling crew (CP or Rotary).');
    addParagraph('• Auto-Pricing: Parsed remark activities are automatically matched against the project rate card to calculate client charges. Matched activities are flagged chargeable.');
    addParagraph('• Manager Review: Remark-based Site Logs start with manager_review_status = "pending". A manager reviews, edits if needed, then approves them to auto-generate the driller\'s timesheet.');
    addParagraph('• Borehole Records: Structured borehole/log data is imported as approved, read-only technical records (no manager review needed).');
    y += 6;

    // === 10. TESTING ===
    addHeading('10. Testing & Support');
    addParagraph('To test the integration, contact our admin team to receive a shared secret and a test job reference. We recommend sending a test payload with a known job_reference and verifying the 200 response before enabling automated push from production.');
    addParagraph('For integration support, contact the GC Mission Control admin team.', 9);
    y += 20;

    // Footer on every page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('GC Mission Control — KeyLogBook Webhook Integration Specification', margin, pageH - 20);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin - 60, pageH - 20);
    }

    doc.save('GC-MissionControl-KeyLogBook-Integration.pdf');
    toast({ title: 'PDF downloaded', description: 'The integration document has been saved to your downloads.' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader
        icon={FileText}
        title="KeyLogBook Integration"
        subtitle="Webhook integration specification for automated data push"
        actions={
          <button onClick={generatePDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#2E5A1A] rounded-lg font-semibold text-sm hover:bg-white/90 active:scale-95 transition shadow-sm">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 text-sm text-slate-700">
        <section>
          <h2 className="font-bold text-slate-900 text-base mb-1.5">1. Overview</h2>
          <p className="text-slate-600">GC Mission Control ingests real-time borehole log data and driller daily remarks from KeyLogBook via a single webhook endpoint, supporting two streams: parsed driller remarks (pending manager review) and structured borehole records (read-only technical data).</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 text-base mb-1.5">2. Webhook Endpoint</h2>
          <p className="font-mono text-xs bg-slate-100 px-3 py-2 rounded-lg">POST https://gc-mission-control.base44.app/api/functions/receiveKeyLogBookData</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 text-base mb-1.5">3. Authentication</h2>
          <p className="text-slate-600">Shared secret via header <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">x-klb-signature</code> or query param <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">?secret=</code>.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 text-base mb-1.5">4. Key Payload Fields</h2>
          <ul className="text-slate-600 space-y-1 list-disc pl-5">
            <li><strong>job_reference</strong> — string, matches our Job reference</li>
            <li><strong>date</strong> — YYYY-MM-DD</li>
            <li><strong>remarks</strong> — driller daily remarks (primary value stream)</li>
            <li><strong>boreholes</strong> — structured borehole records array</li>
            <li><strong>logs</strong> — structured log entries array</li>
          </ul>
        </section>
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">Click "Download PDF" above to generate the full specification document.</p>
      </div>
    </div>
  );
}