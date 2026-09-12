import React, { useState } from 'react';
import { FileDown, X, Loader2, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import { detectActivityType, TAG_COLORS } from '@/utils/siteLogUtils';

const BRAND = [46, 90, 26]; // #2E5A1A
const SLATE = [71, 85, 105];
const LIGHT = [241, 245, 249];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
}

function weekCommencing(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
}

/**
 * SiteLogPdfExport — date-range-selectable PDF export of all activity logs.
 *
 * Opens a modal with a date-range picker (defaulting to the job span),
 * then generates a polished PDF grouped by month → week → day with
 * activity tags, durations, and driller attribution.
 */
export default function SiteLogPdfExport({ job, logs }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(job?.start_date || '');
  const [to, setTo] = useState(job?.end_date || '');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const filtered = logs.filter(l => {
        if (from && l.date < from) return false;
        if (to && l.date > to) return false;
        return true;
      });

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // Header band
      doc.setFillColor(...BRAND);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('Site Activity Logs', margin, 13);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(job?.name || '—', margin, 19);
      doc.text(`${fmtDate(from) || 'All time'} → ${fmtDate(to)}`, pageW - margin, 19, { align: 'right' });
      y = 36;

      doc.setTextColor(...SLATE);
      doc.setFontSize(8);
      doc.text(`${filtered.length} activities · ${filtered.reduce((s, l) => s + (l.duration_minutes || 0), 0)} total minutes`, margin, y);
      y += 6;

      // Group by month → week → day
      const byMonth = {};
      filtered.forEach(l => {
        const mk = (l.date || '—').slice(0, 7);
        if (!byMonth[mk]) byMonth[mk] = {};
        const wc = l.date ? weekCommencing(l.date) : '—';
        if (!byMonth[mk][wc]) byMonth[mk][wc] = {};
        const d = l.date || '—';
        if (!byMonth[mk][wc][d]) byMonth[mk][wc][d] = [];
        byMonth[mk][wc][d].push(l);
      });

      const monthKeys = Object.keys(byMonth).sort().reverse();

      const ensureSpace = (need) => {
        if (y + need > pageH - margin - 10) { doc.addPage(); y = margin; }
      };

      monthKeys.forEach(mk => {
        const year = parseInt(mk.slice(0, 4), 10);
        const monthIdx = mk === '—' ? -1 : parseInt(mk.slice(5, 7), 10) - 1;
        const monthLabel = mk === '—' ? 'No date' : `${MONTH_NAMES[monthIdx]} ${year}`;

        ensureSpace(14);
        doc.setFillColor(...BRAND);
        doc.roundedRect(margin, y, pageW - margin * 2, 8, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(monthLabel, margin + 3, y + 5.5);
        y += 12;

        const weeks = Object.keys(byMonth[mk]).sort().reverse();
        weeks.forEach(wc => {
          const days = Object.keys(byMonth[mk][wc]).sort().reverse();
          days.forEach(d => {
            const dayLogs = byMonth[mk][wc][d];
            ensureSpace(10);
            doc.setTextColor(...BRAND);
            doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.text(fmtDate(d), margin, y);
            y += 5;

            dayLogs.forEach(l => {
              ensureSpace(7);
              const tag = detectActivityType(l.description);
              const time = l.start_time ? `${l.start_time}${l.end_time ? `–${l.end_time}` : ''}` : '';
              const dur = fmtDur(l.duration_minutes);
              const driller = l.staff_name || l.completed_by_name || '—';
              const status = l.manager_review_status === 'approved' ? '✓' : (l.manager_review_status === 'queried' ? '?' : '○');

              doc.setFontSize(8); doc.setFont('helvetica', 'normal');
              doc.setTextColor(...SLATE);
              const x = margin + 2;
              doc.text(time || '—', x, y);
              doc.text(dur, x + 22, y);
              doc.text(driller, x + 38, y);
              doc.setTextColor(...BRAND);
              doc.text(status, x + 90, y);
              doc.setTextColor(...SLATE);
              const desc = doc.splitTextToSize((l.description || '—').slice(0, 120), pageW - margin * 2 - 100);
              doc.text(desc[0] || '', x + 98, y);
              y += 5;
            });
            y += 2;
          });
        });
        y += 3;
      });

      // Footer page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount} · GC Mission Control · ${job?.name || ''}`, pageW / 2, pageH - 6, { align: 'center' });
      }

      doc.save(`site-activity-logs-${job?.job_reference || job?.id || 'export'}.pdf`);
      setOpen(false);
    } catch (e) {
      console.error('PDF generation error:', e);
      alert('Could not generate PDF. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition backdrop-blur-sm border border-white/20"
      >
        <FileDown className="w-3.5 h-3.5" /> Download PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !generating && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-pop-in">
            <div className="hero-gradient px-5 py-4 flex items-center gap-2.5 rounded-t-2xl">
              <FileDown className="w-5 h-5 text-white" />
              <h3 className="font-bold text-white">Download Activity Logs PDF</h3>
              <button onClick={() => setOpen(false)} disabled={generating} className="ml-auto w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">Choose a date range for the report. Defaults to the job's start and end dates.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> To</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700">
                <span className="font-semibold">{logs.filter(l => (!from || l.date >= from) && (!to || l.date <= to)).length}</span> activities will be included in the report.
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50"
              >
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><FileDown className="w-4 h-4" /> Generate PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}