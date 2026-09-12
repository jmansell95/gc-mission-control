import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  X, Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Pencil, Link2, Unlink, Plus, Save, ChevronRight, ScanLine, Layers, RefreshCw,
  Warehouse, MapPin, CalendarClock, Activity, Hash, Settings, Printer,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { rollupCompliance, COMPLIANCE_META, ASSET_TYPE_META, daysUntil } from '@/utils/rigRollup';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';
import RigCertificateHero from '@/components/righub/RigCertificateHero';
import LinkedAssetMiniCard from '@/components/righub/LinkedAssetMiniCard';
import AssetPandaInfoPanel from '@/components/righub/AssetPandaInfoPanel';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

function MasterBadge({ master }) {
  const meta = COMPLIANCE_META[master];
  const Icon = master === 'expired' ? ShieldX : master === 'expiring' ? ShieldAlert : master === 'unknown' ? HelpCircle : ShieldCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${meta.tone}`}>
      <Icon className="w-4 h-4" /> {meta.label} System
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-slate-400" />} {label}
      </span>
      <span className={`text-xs font-semibold ${tone || 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

export default function RigDetailDrawer({ rig, allAssets = [], onClose, onOpenEquipment, onEdit, onRecert }) {
  const [showLinker, setShowLinker] = useState(false);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const linkedItems = useMemo(
    () => (rig.linked_equipment_ids || []).map(id => allAssets.find(a => a.id === id)).filter(Boolean),
    [rig, allAssets]
  );

  const rollup = useMemo(() => rollupCompliance(rig, linkedItems), [rig, linkedItems]);
  const assetNames = useMemo(() => {
    const m = { [rig.id]: rig.name };
    linkedItems.forEach(i => { m[i.id] = i.name; });
    return m;
  }, [rig, linkedItems]);

  const linkable = allAssets.filter(a =>
    a.id !== rig.id && a.asset_type !== 'rig' && !(rig.linked_equipment_ids || []).includes(a.id) && a.is_active !== false
  );

  const togglePending = (id) => setPendingLinks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveLinks = async () => {
    if (pendingLinks.length === 0) { setShowLinker(false); return; }
    setSaving(true);
    try {
      const newIds = [...(rig.linked_equipment_ids || []), ...pendingLinks];
      await base44.entities.SiteAsset.update(rig.id, { linked_equipment_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setPendingLinks([]);
      setShowLinker(false);
    } catch (e) { /* bubble */ }
    setSaving(false);
  };

  const unlink = async (eqId) => {
    const newIds = (rig.linked_equipment_ids || []).filter(id => id !== eqId);
    try {
      await base44.entities.SiteAsset.update(rig.id, { linked_equipment_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (e) { /* bubble */ }
  };

  // ── Child assets (certificate drill-down) ──
  const [showChildLinker, setShowChildLinker] = useState(false);
  const [pendingChildren, setPendingChildren] = useState([]);

  const childAssets = useMemo(
    () => (rig.child_asset_ids || []).map(id => allAssets.find(a => a.id === id)).filter(Boolean),
    [rig, allAssets]
  );

  const linkableChildren = allAssets.filter(a =>
    a.id !== rig.id && !(rig.child_asset_ids || []).includes(a.id) && a.is_active !== false
  );

  const togglePendingChild = (id) => setPendingChildren(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveChildren = async () => {
    if (pendingChildren.length === 0) { setShowChildLinker(false); return; }
    setSaving(true);
    try {
      const newIds = [...(rig.child_asset_ids || []), ...pendingChildren];
      await base44.entities.SiteAsset.update(rig.id, { child_asset_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setPendingChildren([]);
      setShowChildLinker(false);
    } catch (e) { /* bubble */ }
    setSaving(false);
  };

  const unlinkChild = async (childId) => {
    const newIds = (rig.child_asset_ids || []).filter(id => id !== childId);
    try {
      await base44.entities.SiteAsset.update(rig.id, { child_asset_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (e) { /* bubble */ }
  };

  const depotTagged = (rig.storage_location || '').toLowerCase().match(/depot|yard|dartford/);

  const printQrLabel = async () => {
    try {
      const qrData = rig.qr_code || rig.serial_number || rig.name || rig.id;
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } });
      const w = window.open('', '_blank', 'width=800,height=600');
      if (!w) return;
      w.document.write(`<html><head><title>QR Label — ${rig.name || 'Rig'}</title><style>@page{margin:10mm;size:A4;}*{box-sizing:border-box;}body{font-family:Inter,sans-serif;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh}.label{border:2px solid #2E5A1A;border-radius:8px;padding:6mm;text-align:center;width:70mm}.label img{width:50mm;height:50mm;display:block;margin:0 auto}.name{font-size:13px;font-weight:700;color:#1c4a12;margin-top:3mm}.fleet{font-size:10px;color:#475569;font-family:monospace;margin-top:1mm}</style></head><body><div class="label"><img src="${qrDataUrl}" alt="QR" /><div class="name">${rig.name || 'Rig'}</div>${rig.fleet_number ? `<div class="fleet">Fleet: ${rig.fleet_number}</div>` : ''}<div class="fleet">Scan with GC app</div></div></body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    } catch (e) { console.error('QR print failed:', e); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto animate-pop-in">
        {/* Hero header with gradient */}
        <div className="sticky top-0 z-20 hero-gradient text-white rounded-t-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                <Cog className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white truncate text-lg">{rig.name}</h3>
                <p className="text-xs text-white/70 truncate">
                  {rig.rig_type && rig.rig_type !== 'n/a' ? <span className="uppercase font-semibold text-white/90">{rig.rig_type} · </span> : null}
                  Rig System · {rollup.total} asset{rollup.total !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <MasterBadge master={rollup.master} />
              <button onClick={printQrLabel} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition backdrop-blur-sm">
                <Printer className="w-3.5 h-3.5" /> Print QR
              </button>
              {onEdit && (
                <button onClick={() => onEdit(rig)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition backdrop-blur-sm">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              {onRecert && (
                <button onClick={() => onRecert(rig)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/80 hover:bg-amber-400 text-amber-950 rounded-lg text-xs font-semibold transition">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-cert
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Rig Certificate Hero — front and centre compliance status */}
          <RigCertificateHero asset={rig} />

          {/* Compliance rollup strip — vibrant stat tiles */}
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { key: 'compliant', label: 'Compliant', grad: 'stat-gradient-emerald', icon: ShieldCheck },
              { key: 'expiring', label: 'Expiring', grad: 'stat-gradient-amber', icon: ShieldAlert },
              { key: 'expired', label: 'Expired', grad: 'stat-gradient-rose', icon: ShieldX },
              { key: 'unknown', label: 'Unknown', grad: 'stat-gradient-slate', icon: HelpCircle },
            ].map(s => {
              const SIcon = s.icon;
              return (
                <div key={s.key} className={`rounded-xl p-3 text-white ${s.grad} shadow-md relative overflow-hidden`}>
                  <SIcon className="w-4 h-4 absolute top-2 right-2 opacity-30" />
                  <p className="text-2xl font-bold tabular-nums leading-none">{rollup.counts[s.key]}</p>
                  <p className="text-[10px] font-medium mt-1 opacity-90">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Rig passport — identity + key dates */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Rig Passport</p>
              {depotTagged && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <Warehouse className="w-3 h-3" /> In Depot
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1"><Hash className="w-3 h-3" /> {rig.serial_number || 'No serial'}</span>
                {rig.equipment_type && <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded">{rig.equipment_type}</span>}
                {!rig.is_active && <span className="text-red-700 font-bold bg-red-50 px-2 py-1 rounded uppercase">Inactive</span>}
                {rig.colour && <span className="text-slate-600 bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> {rig.colour}</span>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 divide-x divide-slate-100">
                <div className="pr-2">
                  <InfoRow icon={ShieldCheck} label="Status" value={COMPLIANCE_META[rig.compliance_status || 'unknown'].label} tone={COMPLIANCE_META[rig.compliance_status || 'unknown'].tone.split(' ')[0]} />
                  <InfoRow icon={CalendarClock} label="Expiry" value={rig.compliance_expiry_date ? safeFormat(rig.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime'} />
                  <InfoRow icon={Activity} label="Last service" value={rig.last_service_date ? safeFormat(rig.last_service_date, 'dd MMM yyyy') : '—'} />
                </div>
                <div className="pl-2">
                  <InfoRow icon={Settings} label="Next service" value={rig.next_service_date ? safeFormat(rig.next_service_date, 'dd MMM yyyy') : '—'} tone={(daysUntil(rig.next_service_date) ?? 99) < 0 ? 'text-red-600' : (daysUntil(rig.next_service_date) ?? 99) <= 30 ? 'text-amber-600' : 'text-slate-700'} />
                  <InfoRow icon={MapPin} label="Location" value={rig.storage_location || '—'} />
                  <InfoRow icon={Wrench} label="Responsible" value={rig.responsible_person || '—'} />
                </div>
              </div>
              {rig.tooling_notes && <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 rounded-lg p-2.5"><span className="font-semibold text-slate-600">Tooling:</span> {rig.tooling_notes}</p>}
            </div>
          </div>

          {/* Asset Panda inventory source */}
          <AssetPandaInfoPanel asset={rig} />

          {/* Linked Toolkit */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Linked Toolkit & Equipment</p>
                <p className="text-[10px] text-slate-400">{linkedItems.length} item{linkedItems.length !== 1 ? 's' : ''} — click any to open its record</p>
              </div>
              <button onClick={() => setShowLinker(s => !s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition">
                <Plus className="w-3.5 h-3.5" /> Link
              </button>
            </div>

            {showLinker && (
              <div className="p-3 bg-emerald-50/40 border-b border-emerald-100">
                <p className="text-[11px] font-medium text-slate-600 mb-2">Select equipment to link to this rig:</p>
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {linkable.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No unlinked equipment available.</p>
                  ) : linkable.map(a => {
                    const Icon = TYPE_ICON[a.asset_type] || Wrench;
                    const checked = pendingLinks.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                        <input type="checkbox" checked={checked} onChange={() => togglePending(a.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{a.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{a.equipment_type || a.asset_type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${COMPLIANCE_META[a.compliance_status || 'unknown'].dot} flex-shrink-0`} />
                      </label>
                    );
                  })}
                </div>
                {pendingLinks.length > 0 && (
                  <button onClick={saveLinks} disabled={saving}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Linking…' : `Link ${pendingLinks.length} item${pendingLinks.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}

            <div className="p-3">
              {linkedItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">No equipment linked yet. Use <strong>Link</strong> to build this rig's toolkit.</p>
              ) : (
                <div className="space-y-1.5">
                  {linkedItems.map(eq => {
                    const Icon = TYPE_ICON[eq.asset_type] || Wrench;
                    const meta = COMPLIANCE_META[eq.compliance_status || 'unknown'];
                    const d = daysUntil(eq.compliance_expiry_date);
                    return (
                      <div key={eq.id} className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => onOpenEquipment(eq)}>
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{eq.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {eq.equipment_type || ASSET_TYPE_META[eq.asset_type]?.label || eq.asset_type}
                            {eq.serial_number ? ` · ${eq.serial_number}` : ''}
                          </p>
                        </div>
                        {d !== null && (
                          <span className={`text-[10px] font-medium flex-shrink-0 ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {d < 0 ? 'Expired' : `${d}d`}
                          </span>
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} flex-shrink-0`} />
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition flex-shrink-0" />
                        <button onClick={(e) => { e.stopPropagation(); unlink(eq.id); }}
                          className="p-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Unlink">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Child Assets — certificate drill-down view */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Child Assets</p>
                <p className="text-[10px] text-slate-400">{childAssets.length} linked — click any to drill into its certificate</p>
              </div>
              <button onClick={() => setShowChildLinker(s => !s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition">
                <Plus className="w-3.5 h-3.5" /> Link
              </button>
            </div>

            {showChildLinker && (
              <div className="p-3 bg-emerald-50/40 border-b border-emerald-100">
                <p className="text-[11px] font-medium text-slate-600 mb-2">Select assets to link as children:</p>
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {linkableChildren.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No unlinked assets available.</p>
                  ) : linkableChildren.map(a => {
                    const Icon = TYPE_ICON[a.asset_type] || Wrench;
                    const checked = pendingChildren.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                        <input type="checkbox" checked={checked} onChange={() => togglePendingChild(a.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{a.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{a.equipment_type || a.asset_type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${COMPLIANCE_META[a.compliance_status || 'unknown'].dot} flex-shrink-0`} />
                      </label>
                    );
                  })}
                </div>
                {pendingChildren.length > 0 && (
                  <button onClick={saveChildren} disabled={saving}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Linking…' : `Link ${pendingChildren.length} child asset${pendingChildren.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}

            <div className="p-3">
              {childAssets.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">No child assets linked yet. Use <strong>Link</strong> to add assets for the certificate drill-down.</p>
              ) : (
                <div className="space-y-1.5">
                  {childAssets.map(child => (
                    <LinkedAssetMiniCard key={child.id} asset={child} onClick={onOpenEquipment} onUnlink={unlinkChild} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Certificate vault — rig + all linked */}
          <CertificateVault assetIds={[rig.id, ...linkedItems.map(i => i.id), ...childAssets.map(i => i.id)]} assetNames={assetNames} />

          {/* Service history for the rig itself */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Rig Service & Inspection Timeline</p>
            </div>
            <div className="p-4">
              <ServiceHistoryPanel assetId={rig.id} assetName={rig.name} assetType={rig.asset_type} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}