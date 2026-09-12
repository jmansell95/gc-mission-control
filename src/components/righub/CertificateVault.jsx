import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, Shield,
  Lock, Download, FolderDown, ChevronDown, ChevronRight, Cog, Wrench,
  Package, Truck, Anchor, Plug,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, daysUntil, ASSET_TYPE_META } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

/**
 * Enhanced aggregated certificate vault — pulls every ServiceRecord that has
 * an uploaded certificate for the rig itself AND all its linked equipment.
 *
 * Organised into grouped sections by asset, sorted by urgency (expired /
 * expiring first), with expiry dates, days left, compliance status and
 * per-section / bulk download controls.
 */
export default function CertificateVault({ assetIds = [], assetNames = {}, assets = [] }) {
  const [downloading, setDownloading] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(assetIds.map(id => [id, true])));

  const idSet = new Set(assetIds);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['cert-vault', assetIds.join('|')],
    queryFn: () => base44.entities.ServiceRecord.list('-date', 500),
    enabled: assetIds.length > 0,
  });

  // Map of assetId -> full asset record (for type + responsible person).
  const assetMap = useMemo(() => {
    const m = new Map();
    (assets || []).forEach(a => m.set(a.id, a));
    return m;
  }, [assets]);

  // Group certificates by asset, preserving asset order from assetIds.
  const groups = useMemo(() => {
    const map = new Map();
    records
      .filter(r => idSet.has(r.site_asset_id) && r.certificate_url)
      .forEach(r => {
        if (!map.has(r.site_asset_id)) map.set(r.site_asset_id, []);
        map.get(r.site_asset_id).push(r);
      });
    return assetIds.map(id => ({
      assetId: id,
      asset: assetMap.get(id),
      name: assetNames[id] || assetMap.get(id)?.name || 'Asset',
      certs: (map.get(id) || []).sort((a, b) => new Date(b.date) - new Date(a.date)),
    })).filter(g => g.certs.length > 0);
  }, [records, assetIds, assetNames, assetMap, idSet]);

  // Overall summary
  const allCerts = useMemo(() => groups.flatMap(g => g.certs), [groups]);
  const expiredCount = allCerts.filter(c => {
    const d = daysUntil(c.resulting_expiry_date);
    return d !== null && d < 0;
  }).length;
  const expiringCount = allCerts.filter(c => {
    const d = daysUntil(c.resulting_expiry_date);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const compliantCount = allCerts.filter(c => {
    const d = daysUntil(c.resulting_expiry_date);
    return d !== null && d > 30;
  }).length;

  // Sort groups so the most urgent asset bubbles to the top.
  const sortedGroups = useMemo(() => {
    const urgency = (g) => {
      let worst = 0;
      g.certs.forEach(c => {
        const d = daysUntil(c.resulting_expiry_date);
        if (d !== null) {
          if (d < 0) worst = Math.max(worst, 3);
          else if (d <= 30) worst = Math.max(worst, 2);
          else worst = Math.max(worst, 1);
        }
      });
      return -worst; // higher urgency first
    };
    return [...groups].sort((a, b) => urgency(a) - urgency(b));
  }, [groups]);

  const toggleGroup = (id) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const openAll = () => {
    allCerts.slice(0, 15).forEach((c, i) => setTimeout(() => window.open(c.certificate_url, '_blank'), i * 200));
  };

  const openGroup = (certs) => {
    certs.slice(0, 10).forEach((c, i) => setTimeout(() => window.open(c.certificate_url, '_blank'), i * 200));
  };

  const downloadOne = async (url, name) => {
    setDownloading(true);
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
    setDownloading(false);
  };

  const downloadGroup = async (certs) => {
    setDownloading(true);
    for (const c of certs) {
      await downloadOneSilent(c.certificate_url, c.certificate_name || `${assetNames[c.site_asset_id] || 'certificate'}`);
    }
    setDownloading(false);
  };

  const downloadOneSilent = (url, name) => new Promise((resolve) => {
    fetch(url).then(r => r.blob()).then(blob => {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = name || 'certificate';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      resolve();
    }).catch(() => { window.open(url, '_blank'); resolve(); });
  });

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Header + overall summary */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-white border-slate-200">
          <Lock className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Certificate Vault</p>
          <p className="text-[11px] text-slate-400">
            {allCerts.length} certificate{allCerts.length !== 1 ? 's' : ''} across {groups.length} asset{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        {allCerts.length > 0 && (
          <button onClick={openAll} title="Open all certificates"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold transition">
            <FolderDown className="w-3.5 h-3.5" /> Open All
          </button>
        )}
      </div>

      {/* Status summary tiles */}
      {allCerts.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-slate-200">
          <div className="bg-white px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><ShieldX className="w-3.5 h-3.5 text-red-600" /></div>
            <div><p className="text-base font-bold text-red-700 leading-none tabular-nums">{expiredCount}</p><p className="text-[10px] text-slate-400 mt-0.5">Expired</p></div>
          </div>
          <div className="bg-white px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center"><ShieldAlert className="w-3.5 h-3.5 text-amber-600" /></div>
            <div><p className="text-base font-bold text-amber-700 leading-none tabular-nums">{expiringCount}</p><p className="text-[10px] text-slate-400 mt-0.5">Expiring ≤30d</p></div>
          </div>
          <div className="bg-white px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /></div>
            <div><p className="text-base font-bold text-emerald-700 leading-none tabular-nums">{compliantCount}</p><p className="text-[10px] text-slate-400 mt-0.5">Compliant</p></div>
          </div>
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">No certificates uploaded yet. Log a service record with a certificate to populate the vault.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map(g => {
              const asset = g.asset || {};
              const TypeIcon = TYPE_ICON[asset.asset_type] || FileText;
              const typeMeta = ASSET_TYPE_META[asset.asset_type];
              const isOpen = openGroups[g.assetId] !== false;
              const gExpired = g.certs.filter(c => { const d = daysUntil(c.resulting_expiry_date); return d !== null && d < 0; }).length;
              const gExpiring = g.certs.filter(c => { const d = daysUntil(c.resulting_expiry_date); return d !== null && d >= 0 && d <= 30; }).length;
              return (
                <div key={g.assetId} className="rounded-lg border border-slate-200 overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-2.5 bg-slate-50/60 px-3 py-2.5 border-b border-slate-100">
                    <button onClick={() => toggleGroup(g.assetId)} className="p-0.5 text-slate-400 hover:text-slate-700 transition flex-shrink-0">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${typeMeta?.tint || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      <TypeIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {g.certs.length} cert{g.certs.length !== 1 ? 's' : ''}
                        {asset.responsible_person && ` · ${asset.responsible_person}`}
                        {gExpired > 0 && <span className="text-red-600 font-medium"> · {gExpired} expired</span>}
                        {gExpiring > 0 && <span className="text-amber-600 font-medium"> · {gExpiring} expiring</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openGroup(g.certs)} title="Open all in this group"
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => downloadGroup(g.certs)} disabled={downloading} title="Download all in this group"
                        className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition disabled:opacity-50">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Certificates */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {g.certs.map(c => {
                        const d = daysUntil(c.resulting_expiry_date);
                        const tone = d === null ? 'unknown' : d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'compliant';
                        const meta = COMPLIANCE_META[tone];
                        const StatusIcon = tone === 'expired' ? ShieldX : tone === 'expiring' ? ShieldAlert : tone === 'compliant' ? ShieldCheck : Shield;
                        const daysLabel = d === null ? 'No expiry' : d < 0 ? `Expired ${Math.abs(d)}d ago` : d === 0 ? 'Expires today' : `${d}d left`;
                        return (
                          <div key={c.id} className="flex items-center gap-2.5 bg-white px-3 py-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${meta.tone} flex-shrink-0`}>
                              <StatusIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate">{c.certificate_name || 'Certificate'}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {c.record_type?.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase()) || 'Service'} · {safeFormat(c.date, 'dd MMM yyyy')}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 mr-1">
                              {c.resulting_expiry_date && (
                                <>
                                  <p className={`text-[11px] font-bold ${tone === 'expired' ? 'text-red-600' : tone === 'expiring' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {daysLabel}
                                  </p>
                                  <p className="text-[10px] text-slate-400">Exp {safeFormat(c.resulting_expiry_date, 'dd MMM yyyy')}</p>
                                </>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-1 flex-shrink-0">
                              <a href={c.certificate_url} target="_blank" rel="noreferrer" title="View"
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button onClick={() => downloadOne(c.certificate_url, c.certificate_name || `${g.name}-certificate`)} disabled={downloading} title="Download"
                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition disabled:opacity-50">
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}