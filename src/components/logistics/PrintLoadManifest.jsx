import React from 'react';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { addBrandHeader, addSectionHeader, addTable, addKpiRow, addPageNumbers } from '@/lib/pdfStyles';
import { getPayloadStatus, calculateAxleGuidance } from '@/utils/loadWeight';

/**
 * Per-run load manifest PDF download — vehicle reg, driver name, each loaded
 * item with its weight, a running total, the vehicle payload limit, a
 * safe-to-drive confirmation line, and axle guidance. Uses jsPDF with the
 * shared brand styling.
 */
export default function PrintLoadManifest({ delivery, vehicle, driverName, items, axleGuidanceNote }) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const totalKg = items.reduce((s, i) => s + (Number(i.weight_kg) || 0) * (Number(i.quantity) || 1), 0);
    const maxKg = vehicle?.max_weight_kg || null;
    const status = getPayloadStatus(totalKg, maxKg);
    const guidance = axleGuidanceNote || calculateAxleGuidance(items, vehicle).note;
    const dateStr = delivery?.scheduled_date
      ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const subtitle = `${vehicle?.registration_number || 'Vehicle'}${driverName ? ` · ${driverName}` : ''} · ${dateStr}`;
    addBrandHeader(doc, 'Load Manifest', subtitle);

    let y = addKpiRow(doc, [
      { label: 'Total Weight', value: `${Math.round(totalKg)} kg` },
      { label: 'Max Payload', value: maxKg ? `${Math.round(maxKg)} kg` : '—' },
      { label: 'Status', value: status?.label || '—' },
      { label: 'Items', value: items.length },
    ], 48);

    y = addSectionHeader(doc, 'Loaded Items', y);
    const rows = items.map((item, i) => {
      const qty = Number(item.quantity) || 1;
      const w = (Number(item.weight_kg) || 0) * qty;
      return [String(i + 1), (item.description || item.name || 'Item').substring(0, 50), String(qty), w > 0 ? `${Math.round(w)} kg` : '—'];
    });
    y = addTable(doc, ['#', 'Item', 'Qty', 'Weight'], rows, y);

    if (guidance) {
      y += 5;
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 20; }
      y = addSectionHeader(doc, 'Axle Guidance', y);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(guidance, doc.internal.pageSize.getWidth() - 28);
      lines.forEach(line => { doc.text(line, 14, y); y += 5; });
    }

    addPageNumbers(doc);
    doc.save(`load-manifest-${(vehicle?.registration_number || 'vehicle').replace(/\s/g, '')}-${delivery?.scheduled_date || new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <button onClick={handleDownload} type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
      <Download className="w-3.5 h-3.5" /> Load Manifest
    </button>
  );
}