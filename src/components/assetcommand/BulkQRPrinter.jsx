import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, X, QrCode, Search, Loader2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';

/**
 * Bulk QR Printer — generates a printable A4 booklet of QR code labels for
 * selected assets. Each label encodes the asset's system-generated qr_code
 * (falling back to serial_number) so it can be scanned by the Asset Scanner
 * to book the asset in or out.
 *
 * Layout: A4 sheet, 12 labels per page (3 columns × 4 rows), each label
 * ~55mm tall with a 38mm QR code, asset name, and fleet number. QR codes
 * are generated client-side (no external API dependency) with error
 * correction level M and adequate quiet zones for reliable scanning from
 * a printed sheet of multiple codes.
 */
export default function BulkQRPrinter({ onClose }) {
  const queryClient = useQueryClient();
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return assets;
    return assets.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.serial_number || '').toLowerCase().includes(q) ||
      (a.fleet_number || '').toLowerCase().includes(q) ||
      (a.asset_type || '').toLowerCase().includes(q)
    );
  }, [assets, search]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(a => a.id)));
  const clearAll = () => setSelected(new Set());

  const selectedAssets = assets.filter(a => selected.has(a.id));
  const missingQr = selectedAssets.filter(a => !a.qr_code);

  const handlePrint = async () => {
    if (selectedAssets.length === 0) return;
    setPrinting(true);
    try {
      // Generate QR data URLs client-side for reliability (no external dependency)
      const labels = [];
      for (const a of selectedAssets) {
        const qrData = a.qr_code || a.serial_number || a.name || a.id;
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        labels.push({
          qrDataUrl,
          name: a.name || 'Unnamed',
          fleet: a.fleet_number || '',
          type: (a.asset_type || '').toUpperCase().replace(/_/g, ' '),
        });
      }

      const labelHtml = labels.map(l => `
        <div class="label">
          <img src="${l.qrDataUrl}" alt="QR" />
          <div class="name">${l.name}</div>
          ${l.fleet ? `<div class="fleet">Fleet: ${l.fleet}</div>` : ''}
          <div class="type">${l.type}</div>
        </div>`).join('');

      const pages = Math.ceil(labels.length / 12);
      const w = window.open('', '_blank', 'width=800,height=600');
      if (!w) return;
      w.document.write(`
        <html><head><title>Asset QR Labels — ${labels.length} labels</title>
        <style>
          @page { margin: 10mm; size: A4; }
          * { box-sizing: border-box; }
          body { font-family: Inter, sans-serif; margin: 0; padding: 0; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
          .label {
            border: 2px solid #2E5A1A;
            border-radius: 8px;
            padding: 5mm 3mm;
            text-align: center;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 55mm;
          }
          .label img { width: 38mm; height: 38mm; display: block; }
          .name {
            font-size: 11px; font-weight: 700; color: #1c4a12;
            margin-top: 3mm; line-height: 1.2;
            max-width: 55mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .fleet { font-size: 9px; color: #475569; font-family: monospace; margin-top: 1mm; }
          .type { font-size: 8px; color: #64748b; text-transform: uppercase; margin-top: 1mm; font-weight: 600; }
          h1 { font-size: 14px; color: #2E5A1A; margin: 0 0 4mm 0; }
          .subtitle { font-size: 10px; color: #64748b; margin-bottom: 8mm; }
          @media print { .no-print { display: none; } }
        </style></head>
        <body>
          <div class="no-print">
            <h1>Ground Control — Asset QR Labels (${labels.length})</h1>
            <p class="subtitle">Scan with the GC app scanner to book assets in/out. ${pages} page${pages > 1 ? 's' : ''}.</p>
          </div>
          <div class="grid">${labelHtml}</div>
        </body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 600);
    } catch (e) {
      console.error('QR print failed:', e);
    }
    setPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><QrCode className="w-4 h-4 text-emerald-700" /></div>
            <div>
              <h3 className="font-bold text-slate-900">Print QR Label Book</h3>
              <p className="text-[11px] text-slate-400">A4 sheet · 12 labels per page · 3×4 grid</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <button onClick={selectAll} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200">Select All</button>
            <button onClick={clearAll} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200">Clear</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {filtered.map(a => {
                const isSel = selected.has(a.id);
                return (
                  <button key={a.id} onClick={() => toggle(a.id)}
                    className={`text-left p-2.5 rounded-lg border-2 transition ${isSel ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                        {isSel && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{a.fleet_number || a.serial_number || '—'}</p>
                        {a.qr_code ? (
                          <p className="text-[9px] text-emerald-600 font-mono mt-0.5 truncate">{a.qr_code}</p>
                        ) : (
                          <p className="text-[9px] text-amber-500 mt-0.5">No QR yet</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected.size > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-800 flex-1">{selected.size} asset{selected.size > 1 ? 's' : ''} selected</span>
              <span className="text-[11px] text-emerald-600">{Math.ceil(selected.size / 12)} page{Math.ceil(selected.size / 12) > 1 ? 's' : ''}</span>
            </div>
          )}

          {missingQr.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  {missingQr.length} asset{missingQr.length > 1 ? 's have' : ' has'} no system QR code yet — the label will use the serial number instead. Generate QR codes now so every label is scannable.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const updates = missingQr.map(a => ({ id: a.id, qr_code: `GC-${crypto.randomUUID()}` }));
                      await base44.entities.SiteAsset.bulkUpdate(updates);
                      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
                    } catch (e) {
                      console.error('QR generation failed:', e);
                    }
                  }}
                  className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition inline-flex items-center gap-1.5"
                >
                  <QrCode className="w-3 h-3" /> Generate {missingQr.length} QR Code{missingQr.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handlePrint} disabled={selected.size === 0 || printing}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {printing ? 'Generating…' : `Print ${selected.size > 0 ? `${selected.size} Label${selected.size > 1 ? 's' : ''}` : 'Labels'}`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}