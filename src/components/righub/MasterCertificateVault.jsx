import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Lock, FileText, ExternalLink, Download, Search, ShieldCheck, ShieldAlert, ShieldX,
  CalendarClock, FolderDown, Cog, Wrench, Package, Truck, Anchor, Plug, Filter,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, daysUntil, ASSET_TYPE_META } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

/**
 * Master Certificate Vault — a fleet-wide searchable register of every
 * uploaded statutory certificate, report and service document. Filter by
 * asset, type or status, view inline, or download individually / in bulk.
 */
export default function MasterCertificateVault({ assets = [], onOpenAsset }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const assetMap = useMemo(() => Object.fromEntries(assets.map(a => [a.id, a])), [assets]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['master-cert-vault'],
    queryFn: () => base44.entities.ServiceRecord.list('-date', 500),
  });

  const certs = useMemo(() => records
    .filter(r => r.certificate_url)
    .map(r => ({ ...r, _asset: assetMap[r.site_asset_id] }))
    .filter(r => r._asset), [records, assetMap]);

  const q = search.toLowerCase().trim();
  const filtered = certs.filter(c => {
    if (typeFilter !== 'all' && c._asset.asset_type !== typeFilter) return false;
    const d = daysUntil(c.resulting_expiry_date);
    const st = d === null ? 'unknown' : d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'compliant';
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    if (!q) return true;
    return (c._asset.name || '').toLowerCase().includes(q)
      || (c.certificate_name || '').toLowerCase().includes(q)
      || (c._asset.serial_number || '').toLowerCase().includes(q);
  });

  const downloadAll = async () => {
    setDownloading(true);
    // Browsers block programmatic download of cross-origin files, so we open
    // each certificate in its own tab — the user can then save each one.
    filtered.slice(0, 20).forEach((c, i) => {
      setTimeout(() => window.open(c.certificate_url, '_blank'), i * 250);
    });
    setTimeout(() => setDownloading(false), filtered.slice(0, 20).length * 250 + 500);
  };

  const downloadOne = async (url, name) => {
    // Try a direct download; fall back to opening in a new tab.
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = name || 'certificate';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const stats = useMemo(() => {
    const expired = certs.filter(c => { const d = daysUntil(c.resulting_expiry_date); return d !== null && d < 0; }).length;
    const expiring = certs.filter(c => { const d = daysUntil(c.resulting_expiry_date); return d !== null && d >= 0 && d <= 30; }).length;
    return { total: certs.length, expired, expiring, valid: certs.length - expired - expiring };
  }, [certs]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Certificates', value: stats.total, grad: 'stat-gradient-brand', Icon: Lock },
          { label: 'Valid', value: stats.valid, grad: 'stat-gradient-emerald', Icon: ShieldCheck },
          { label: 'Expiring (30d)', value: stats.expiring, grad: 'stat-gradient-amber', Icon: ShieldAlert },
          { label: 'Expired', value: stats.expired, grad: 'stat-gradient-rose', Icon: ShieldX },
        ].map(s => {
          const SIcon = s.Icon;
          return (
            <div key={s.label} className="hub-glass rounded-xl p-3.5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.grad} flex items-center justify-center shadow-md`}>
                <SIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{s.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset, certificate or serial..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
          <option value="all">All Types</option>
          <option value="rig">Rigs</option>
          <option value="lifting">Lifting Gear</option>
          <option value="machinery">Machinery</option>
          <option value="trailer">Trailers</option>
          <option value="vehicle">Vehicles</option>
          <option value="portable_appliance">PAT</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
          <option value="all">All Status</option>
          <option value="compliant">Valid</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
          <option value="unknown">No Date</option>
        </select>
        <button onClick={downloadAll} disabled={downloading || filtered.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50">
          <FolderDown className="w-4 h-4" /> {downloading ? 'Opening…' : `Open All (${filtered.length})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading certificates…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{certs.length === 0 ? 'No certificates uploaded yet. Log a service record with a certificate to populate the vault.' : 'No certificates match your filters.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Asset</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden sm:table-cell">Certificate</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Test Date</th>
                  <th className="text-left font-semibold px-4 py-2.5">Expiry</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden lg:table-cell">Status</th>
                  <th className="text-right font-semibold px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const d = daysUntil(c.resulting_expiry_date);
                  const st = d === null ? 'unknown' : d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'compliant';
                  const meta = COMPLIANCE_META[st];
                  const Icon = TYPE_ICON[c._asset.asset_type] || Wrench;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2.5">
                        <button onClick={() => onOpenAsset?.(c._asset)} className="flex items-center gap-2.5 text-left group">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate group-hover:text-emerald-700">{c._asset.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{ASSET_TYPE_META[c._asset.asset_type]?.label || c._asset.asset_type}{c._asset.serial_number ? ` · ${c._asset.serial_number}` : ''}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <p className="text-xs text-slate-600 truncate max-w-[200px]">{c.certificate_name || 'Certificate'}</p>
                        <p className="text-[10px] text-slate-400">{c.tested_by || ''}{c.company ? ` · ${c.company}` : ''}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-500">{safeFormat(c.date, 'dd MMM yyyy')}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {c.resulting_expiry_date ? (
                          <span className={`font-semibold ${d !== null && d < 0 ? 'text-red-600' : d !== null && d <= 30 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {safeFormat(c.resulting_expiry_date, 'dd MMM yyyy')}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <a href={c.certificate_url} target="_blank" rel="noreferrer" title="View"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button onClick={() => downloadOne(c.certificate_url, c.certificate_name || `${c._asset.name}-certificate`)} title="Download"
                            className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}