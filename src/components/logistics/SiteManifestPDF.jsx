import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Printer, Package, QrCode, X, Loader2, MapPin } from 'lucide-react';

/**
 * SiteManifestPDF — generates a printable van manifest for a job.
 * Lists every physical item currently ON SITE for the job, each with
 * its name, serial number and a scannable QR code. The driver prints
 * this, takes it to site, and scans the QR codes to confirm collection.
 */
export default function SiteManifestPDF({ jobId, jobName, onClose }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['job-manifest-items', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: !!jobId,
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets-manifest'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  // Only physical items currently on site
  const assetMap = useMemo(() => {
    const m = {};
    (assets || []).forEach(a => { m[a.id] = a; });
    return m;
  }, [assets]);

  const onSiteItems = useMemo(() => {
    return items
      .filter(c => c.current_location === 'site' && c.site_asset_id)
      .filter(c => c.category !== 'labour' && c.category !== 'contractor_supplied' && c.category !== 'client_supplied')
      .map(c => ({ ...c, asset: assetMap[c.site_asset_id] }))
      .filter(c => c.asset);
  }, [items, assetMap]);

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;

    const rows = onSiteItems.map((item, i) => {
      const qrData = item.asset.serial_number || item.asset.name || item.asset.id;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(qrData)}`;
      return `
        <tr>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1; font-weight:700;">${i + 1}</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">
            <div style="font-weight:700; font-size:14px;">${item.asset.name}</div>
            <div style="font-size:11px; color:#64748b; font-family:monospace;">${item.asset.serial_number || '—'}</div>
            <div style="font-size:11px; color:#64748b;">${(item.asset.asset_type || '').toUpperCase()}${item.asset.colour ? ' · ' + item.asset.colour : ''}</div>
          </td>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
            <img src="${qrSrc}" width="90" height="90" alt="QR" />
          </td>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1; font-size:13px; font-weight:600;">
            ${item.quantity || 1} ${item.unit_label || ''}
          </td>
          <td style="padding:8px; border:1px solid #cbd5e1; width:80px;">
            <div style="width:60px; height:24px; border:1.5px solid #94a3b8; border-radius:4px;"></div>
          </td>
        </tr>`;
    }).join('');

    w.document.write(`
      <html><head><title>Van Manifest — ${jobName || 'Job'}</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2E5A1A; padding-bottom: 16px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; color: #2E5A1A; }
        .header .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
        .header .badge { background: #2E5A1A; color: white; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
        .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 12px; } }
      </style></head>
      <body>
        <div class="header">
          <div>
            <h1>Van Manifest — Site Collection</h1>
            <div class="meta">Job: ${jobName || jobId}</div>
            <div class="meta">Printed: ${new Date().toLocaleString('en-GB')}</div>
          </div>
          <div class="badge">${onSiteItems.length} items on site</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th style="text-align:left;">Item</th>
              <th style="width:110px;">QR Code</th>
              <th style="width:80px;">Qty</th>
              <th style="width:80px;">Collected</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          Ground Control · Site Collection Manifest
          <br/>Scan each QR code with the driver app to confirm collection. Tick the box as a manual backup.
        </div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-pop-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Van Manifest</h2>
              <p className="text-xs text-white/80">{jobName || 'Job'} · {onSiteItems.length} items on site</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : onSiteItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No items currently on site for this job</p>
              <p className="text-slate-400 text-sm mt-1">Items will appear here once they are delivered to site.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {onSiteItems.map((item, i) => {
                const qrData = item.asset.serial_number || item.asset.name || item.asset.id;
                const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(qrData)}`;
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{item.asset.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{item.asset.serial_number || '—'}</p>
                      <p className="text-[11px] text-slate-500">{(item.asset.asset_type || '').toUpperCase()}{item.asset.colour ? ' · ' + item.asset.colour : ''} · Qty {item.quantity || 1}</p>
                    </div>
                    <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-white flex-shrink-0">
                      <img src={qrSrc} alt="QR" className="w-full h-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {onSiteItems.length > 0 && (
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition shadow-sm active:scale-95"
            >
              <Printer className="w-5 h-5" /> Print Manifest ({onSiteItems.length} items)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}