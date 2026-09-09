import React from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';

/**
 * AuditExportBar — CSV/PDF export buttons for audit lists.
 * Props: audits (array of SafetyReport records), fileName (string)
 */
export default function AuditExportBar({ audits = [], fileName = 'audits' }) {
  const handleCsv = () => {
    const headers = ['Audit Title', 'Template', 'Category', 'Auditor', 'Job', 'Site', 'Conducted', 'Completed', 'Score %', 'Pass/Fail', 'Items Failed', 'Items Passed', 'Action Items', 'Status'];
    const rows = audits.map(r => [
      `"${(r.audit_title || '').replace(/"/g, '""')}"`,
      `"${(r.audit_template_name || '').replace(/"/g, '""')}"`,
      r.audit_category || 'general',
      `"${(r.auditor_name || '').replace(/"/g, '""')}"`,
      `"${(r.job_name || '').replace(/"/g, '""')}"`,
      `"${(r.site_name || '').replace(/"/g, '""')}"`,
      r.conducted_at || '',
      r.completed_at || '',
      r.score_percentage != null ? Math.round(r.score_percentage) : '',
      r.pass_fail || 'pending',
      r.items_failed || 0,
      r.items_passed || 0,
      (r.action_items || []).length,
      r.status || 'open',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(46, 90, 26);
    doc.text('Compliance Audit Export', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} · ${audits.length} audits`, 14, 24);

    // Table headers
    const headers = ['Audit', 'Auditor', 'Date', 'Score', 'Result', 'Actions'];
    const colWidths = [60, 35, 28, 18, 22, 18];
    let y = 32;
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    headers.forEach((h, i) => doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y));
    doc.setFont(undefined, 'normal');
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y - 1, 196, y - 1);
    y += 2;

    for (const r of audits.slice(0, 40)) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const title = (r.audit_title || r.audit_template_name || 'Untitled').slice(0, 35);
      const auditor = (r.auditor_name || '—').slice(0, 20);
      const date = r.conducted_at ? new Date(r.conducted_at).toLocaleDateString('en-GB') : '—';
      const score = r.score_percentage != null ? `${Math.round(r.score_percentage)}%` : '—';
      const result = (r.pass_fail || 'pending').toUpperCase();
      const actions = String((r.action_items || []).length);

      doc.setTextColor(result === 'FAIL' ? 225 : result === 'PASS' ? 22 : 100, result === 'FAIL' ? 29 : result === 'PASS' ? 101 : 116, result === 'FAIL' ? 29 : result === 'PASS' ? 52 : 139);
      doc.text(title, 14, y);
      doc.setTextColor(71, 85, 105);
      doc.text(auditor, 74, y);
      doc.text(date, 109, y);
      doc.text(score, 137, y);
      doc.text(result, 155, y);
      doc.text(actions, 180, y);
      y += 5;
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y - 2, 196, y - 2);
    }

    doc.save(`${fileName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (audits.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleCsv}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      <button
        onClick={handlePdf}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition active:scale-95"
      >
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}