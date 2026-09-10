import React from 'react';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { addBrandHeader, addSectionHeader, addTable, addKpiRow, addPageNumbers } from '@/lib/pdfStyles';

const TYPE_LABELS = {
  rig: 'Rigs', machinery: 'Machinery', trailer: 'Trailers', vehicle: 'Vehicles',
  lifting: 'Lifting Gear', portable_appliance: 'Portable Appliances',
};

/**
 * Asset weight register PDF download — a catalogue of every SiteAsset
 * with its weight_kg, grouped by asset type, with subtotals per group and
 * a grand total. Uses jsPDF with the shared brand styling.
 */
export default function PrintWeightRegister({ assets }) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    addBrandHeader(doc, 'Asset Weight Register', `Ground Control — ${dateStr}`);

    const withWeight = assets.filter(a => a.weight_kg).length;
    const grandTotal = assets.reduce((s, a) => s + (Number(a.weight_kg) || 0), 0);

    let y = addKpiRow(doc, [
      { label: 'Total Assets', value: assets.length },
      { label: 'With Weight', value: withWeight },
      { label: 'Missing Weight', value: assets.length - withWeight },
      { label: 'Grand Total', value: `${Math.round(grandTotal)} kg` },
    ], 48);

    // Group by type
    const grouped = {};
    for (const a of assets) {
      const t = a.asset_type || 'machinery';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(a);
    }

    const typeOrder = ['rig', 'machinery', 'trailer', 'vehicle', 'lifting', 'portable_appliance'];
    for (const t of typeOrder) {
      if (!grouped[t]) continue;
      const items = grouped[t];
      const subtotal = items.reduce((s, a) => s + (Number(a.weight_kg) || 0), 0);

      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
      y = addSectionHeader(doc, `${TYPE_LABELS[t] || t} (${items.length} · ${Math.round(subtotal)} kg)`, y);

      const rows = items.map((a, i) => [
        String(i + 1),
        (a.name || 'Unnamed').substring(0, 40),
        (a.serial_number || a.fleet_number || '—').substring(0, 20),
        a.panda_asset_id ? 'Panda' : 'Local',
        a.weight_kg ? `${Math.round(a.weight_kg)} kg` : '—',
      ]);
      y = addTable(doc, ['#', 'Asset', 'Serial/FAA', 'Source', 'Weight'], rows, y);
      y += 3;
    }

    addPageNumbers(doc);
    doc.save(`weight-register-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <button onClick={handleDownload} type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
      <Download className="w-3.5 h-3.5" /> Weight Register
    </button>
  );
}