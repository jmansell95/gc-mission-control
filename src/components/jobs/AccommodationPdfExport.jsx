import React, { useState } from 'react';
import { FileDown, X, Loader2, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import { nightsBetween, bookingType, bookingTotal, perPersonTotal, fmtGBP } from '@/components/jobs/hotelCost';

const BRAND = [46, 90, 26];
const SLATE = [71, 85, 105];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
}

/**
 * AccommodationPdfExport — date-range-selectable PDF export of all
 * hotel/Air B&B bookings for a job.
 *
 * Opens a modal with a date-range picker (defaulting to the job span),
 * then generates a polished PDF with per-staff cost breakdowns, nights,
 * booking references, and a total cost summary.
 */
export default function AccommodationPdfExport({ job, bookings, assignedStaff }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(job?.start_date || '');
  const [to, setTo] = useState(job?.end_date || '');
  const [generating, setGenerating] = useState(false);

  const staffMap = {};
  (assignedStaff || []).forEach(s => { staffMap[s.id] = s; });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Filter bookings overlapping the selected date range
      const filtered = bookings.filter(b => {
        if (!from && !to) return true;
        const ci = b.check_in_date || '';
        const co = b.check_out_date || '';
        if (from && co && co < from) return false;
        if (to && ci && ci > to) return false;
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
      doc.text('Accommodation Report', margin, 13);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(job?.name || '—', margin, 19);
      doc.text(`${fmtDate(from) || 'All time'} → ${fmtDate(to)}`, pageW - margin, 19, { align: 'right' });
      y = 36;

      // Summary
      const totalNights = filtered.reduce((s, b) => s + nightsBetween(b.check_in_date, b.check_out_date), 0);
      const totalCost = filtered.reduce((s, b) => s + bookingTotal(b), 0);
      const hotelCount = filtered.filter(b => bookingType(b) === 'hotel').length;
      const airbnbCount = filtered.filter(b => bookingType(b) === 'airbnb').length;
      const crewCovered = new Set(filtered.flatMap(b => b.assigned_staff_ids || [])).size;

      doc.setFillColor(...[240, 249, 235]);
      doc.roundedRect(margin, y, pageW - margin * 2, 20, 2, 2, 'F');
      doc.setTextColor(...BRAND);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', margin + 3, y + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`Bookings: ${filtered.length} (${hotelCount} hotel, ${airbnbCount} Air B&B)`, margin + 3, y + 11);
      doc.text(`Total nights: ${totalNights}  ·  Crew covered: ${crewCovered}`, margin + 3, y + 16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(fmtGBP(totalCost, { decimals: 0 }), pageW - margin - 3, y + 12, { align: 'right' });
      y += 26;

      // Bookings table
      doc.setTextColor(...SLATE);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setFillColor(...[241, 245, 249]);
      doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
      doc.text('Property', margin + 2, y + 5);
      doc.text('Type', margin + 60, y + 5);
      doc.text('Check-in', margin + 76, y + 5);
      doc.text('Check-out', margin + 100, y + 5);
      doc.text('Nights', margin + 124, y + 5);
      doc.text('Cost', margin + 140, y + 5);
      y += 10;

      filtered.forEach((b, i) => {
        if (y > pageH - margin - 20) { doc.addPage(); y = margin; }
        const nights = nightsBetween(b.check_in_date, b.check_out_date);
        const cost = bookingTotal(b);
        const type = bookingType(b) === 'airbnb' ? 'Air B&B' : 'Hotel';
        const crewNames = (b.assigned_staff_names || []).join(', ') || '—';

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.setTextColor(...SLATE);
        doc.text((b.hotel_name || '—').slice(0, 28), margin + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.text(type, margin + 60, y);
        doc.text(fmtDate(b.check_in_date), margin + 76, y);
        doc.text(fmtDate(b.check_out_date), margin + 100, y);
        doc.text(String(nights), margin + 124, y);
        doc.setFont('helvetica', 'bold');
        doc.text(fmtGBP(cost, { decimals: 0 }), margin + 140, y);
        y += 4;

        // Crew detail line
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.setTextColor(120, 130, 145);
        doc.text(`Crew: ${crewNames.slice(0, 70)}${b.booking_reference ? `  ·  Ref: ${b.booking_reference}` : ''}`, margin + 5, y);
        y += 5;

        // Per-staff breakdown for multi-crew bookings
        if ((b.assigned_staff_ids || []).length > 1) {
          const perPerson = perPersonTotal(b);
          doc.setFontSize(7); doc.setTextColor(100, 110, 125);
          doc.text(`Per crew: ${fmtGBP(perPerson, { decimals: 0 })} (${fmtGBP(perPerson / Math.max(1, nights), { decimals: 0 })}/night each)`, margin + 5, y);
          y += 4;
        }
        y += 3;
        if (i < filtered.length - 1) {
          doc.setDrawColor(230, 235, 240);
          doc.line(margin, y - 1, pageW - margin, y - 1);
        }
      });

      // Total row
      y += 4;
      doc.setFillColor(...BRAND);
      doc.roundedRect(margin, y, pageW - margin * 2, 9, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', margin + 3, y + 6);
      doc.text(fmtGBP(totalCost, { decimals: 0 }), pageW - margin - 3, y + 6, { align: 'right' });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount} · GC Mission Control · ${job?.name || ''}`, pageW / 2, pageH - 6, { align: 'center' });
      }

      doc.save(`accommodation-${job?.job_reference || job?.id || 'export'}.pdf`);
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
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
      >
        <FileDown className="w-3.5 h-3.5" /> Download PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !generating && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-pop-in">
            <div className="hero-gradient px-5 py-4 flex items-center gap-2.5 rounded-t-2xl">
              <FileDown className="w-5 h-5 text-white" />
              <h3 className="font-bold text-white">Download Accommodation PDF</h3>
              <button onClick={() => setOpen(false)} disabled={generating} className="ml-auto w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">Choose a date range for the report. Bookings overlapping this range will be included.</p>
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
                <span className="font-semibold">{bookings.filter(b => (!from || (b.check_out_date || '') >= from) && (!to || (b.check_in_date || '') <= to)).length}</span> bookings will be included in the report.
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