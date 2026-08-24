import React from 'react';
import { Download, FileText } from 'lucide-react';
import { detectActivityType } from '@/utils/siteLogUtils';

function exportCSV(logs, jobName) {
  const headers = ['Date', 'Start', 'End', 'Duration (mins)', 'Driller', 'Borehole', 'Activity Type', 'Description', 'Status', 'Charge (GBP)'];
  const rows = logs.map(l => [
    l.date || '',
    l.start_time || '',
    l.end_time || '',
    l.duration_minutes || 0,
    l.staff_name || '',
    l.borehole_ref || '',
    detectActivityType(l.description).label,
    `"${(l.description || '').replace(/"/g, '""')}"`,
    l.manager_review_status || 'pending',
    l.charge_amount || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SiteLogs_${(jobName || 'job').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(logs, jobName) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = logs.map(l => `<tr>
    <td>${l.date || ''}</td>
    <td>${l.start_time || ''}</td>
    <td>${l.end_time || ''}</td>
    <td>${l.duration_minutes || 0}</td>
    <td>${(l.staff_name || '').replace(/</g, '&lt;')}</td>
    <td>${l.borehole_ref || ''}</td>
    <td>${detectActivityType(l.description).label}</td>
    <td>${(l.description || '').replace(/</g, '&lt;')}</td>
    <td>${l.manager_review_status || 'pending'}</td>
  </tr>`).join('');
  win.document.write(`<html><head><title>Site Logs — ${jobName}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 4px; color: #2E5A1A; }
      .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
      th { background: #2E5A1A; color: white; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
      @media print { body { padding: 0; } @page { size: landscape; } }
    </style>
  </head><body>
    <h1>Site Logs — ${jobName}</h1>
    <div class="meta">Generated: ${new Date().toLocaleString('en-GB')} · ${logs.length} activities</div>
    <table>
      <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Mins</th><th>Driller</th><th>BH</th><th>Type</th><th>Description</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>setTimeout(() => { window.print(); }, 500);</script>
  </body></html>`);
  win.document.close();
}

/**
 * SiteLogExport — Excel (CSV) and PDF export buttons.
 */
export default function SiteLogExport({ logs, jobName, disabled }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => exportCSV(logs, jobName)} disabled={disabled || logs.length === 0}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition disabled:opacity-40">
        <Download className="w-3.5 h-3.5" /> Excel
      </button>
      <button onClick={() => exportPDF(logs, jobName)} disabled={disabled || logs.length === 0}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition disabled:opacity-40">
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}