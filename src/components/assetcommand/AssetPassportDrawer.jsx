import React, { useState } from 'react';
import {
  X, Cog, Wrench, Package, Truck, Anchor, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Link2, Pencil, Clock, CalendarClock, Database, Plug,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';
import CompliancePackGenerator from '@/components/assetcommand/CompliancePackGenerator';
import AssetQRCard from '@/components/assetcommand/AssetQRCard';
import AssetFinancialLifecycle from '@/components/assethub/AssetFinancialLifecycle';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { label: 'PAT / Electrical', icon: Plug, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck, bar: '#10b981' },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert, bar: '#f59e0b' },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX, bar: '#ef4444' },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle, bar: '#94a3b8' },
};

const MAINTENANCE_META = {
  ok: { label: 'Serviced & Current', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: Wrench, pct: 100 },
  due_soon: { label: 'Service Due Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: CalendarClock, pct: 60 },
  overdue: { label: 'Service Overdue', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX, pct: 10 },
  unknown: { label: 'No Service Data', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle, pct: 35 },
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'service', label: 'Service History' },
  { key: 'financial', label: 'Financial' },
  { key: 'pack', label: 'Compliance Pack' },
  { key: 'qr', label: 'QR Code' },
];

function Row({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-700 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * Asset Passport Drawer — comprehensive right-hand slide-over that surfaces
 * everything about an asset across tabbed panels: overview, certificate vault,
 * service timeline, compliance-pack PDF generator and on-site QR code.
 */
export default function AssetPassportDrawer({ asset, allAssets = [], onClose, onEdit }) {
  const [tab, setTab] = useState('overview');

  if (!asset) return null;

  const typeMeta = TYPE_META[asset.asset_type] || TYPE_META.machinery;
  const compMeta = COMPLIANCE_META[asset.compliance_status] || COMPLIANCE_META.unknown;
  const maintMeta = MAINTENANCE_META[asset.maintenance_status] || MAINTENANCE_META.unknown;

  const linkedItems = (asset.linked_equipment_ids || [])
    .map(id => allAssets.find(a => a.id === id))
    .filter(Boolean);

  const vaultAssetIds = [asset.id, ...linkedItems.map(i => i.id)];
  const vaultAssetNames = { [asset.id]: asset.name, ...Object.fromEntries(linkedItems.map(i => [i.id, i.name])) };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${typeMeta.tint} flex-shrink-0`}>
              <typeMeta.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{asset.name}</h3>
              <p className="text-[11px] text-slate-400 truncate">Asset Passport · {typeMeta.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button onClick={() => onEdit(asset)} type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Compliance status banner */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${compMeta.tone}`}>
            <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
          </span>
          {asset.compliance_expiry_date
            ? <span className="text-xs text-slate-500">Expires {safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}</span>
            : (asset.asset_type === 'machinery' || asset.asset_type === 'trailer')
              ? <span className="text-xs text-slate-500">Lifetime CoC</span>
              : <span className="text-xs text-slate-400">No expiry recorded</span>}
          {!asset.is_active && <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full uppercase ml-auto">Inactive</span>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-3 flex-shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} type="button"
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'overview' && (
            <>
              {/* Identity strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{asset.serial_number || 'No serial'}</span>
                {asset.rig_type && asset.rig_type !== 'n/a' && <span className="uppercase font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">{asset.rig_type}</span>}
                {asset.equipment_type && <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded">{asset.equipment_type}</span>}
                {asset.compliance_category && <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">{asset.compliance_category}</span>}
              </div>

              {/* Compliance & safety panel */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><compMeta.Icon className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">Compliance &amp; Safety</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1"><Link2 className="w-2.5 h-2.5" /> Managed in Asset Hub</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${compMeta.tone}`}>
                      <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-auto">
                      {asset.compliance_last_checked ? `Checked ${safeFormat(asset.compliance_last_checked, 'dd MMM yyyy')}` : 'Never checked'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5 divide-y divide-slate-50">
                    <Row label="Expiry date" value={asset.compliance_expiry_date ? safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime CoC'} />
                    <Row label="Responsible person" value={asset.responsible_person} />
                    <Row label="Tooling" value={asset.tooling_notes} />
                  </div>
                </div>
              </div>

              {/* Maintenance gauge */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><maintMeta.Icon className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">Maintenance Status</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {asset.last_service_date ? `Last serviced ${safeFormat(asset.last_service_date, 'dd MMM yyyy')}` : 'No prior service'}{asset.next_service_date ? ` · Next ${safeFormat(asset.next_service_date, 'dd MMM yyyy')}` : ''}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${maintMeta.tone}`}>{maintMeta.label}</span>
                </div>
                {asset.service_notes && <p className="text-xs text-slate-600 p-3 bg-slate-50/40">{asset.service_notes}</p>}
                {asset.repair_notes && <p className="text-xs text-amber-700 p-3 bg-amber-50/40 border-t border-amber-100">{asset.repair_notes}</p>}
              </div>

              {/* Inventory (Asset Panda) */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><Database className="w-3.5 h-3.5 text-emerald-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">Inventory (Asset Panda)</p>
                    <p className="text-[10px] text-slate-400">{asset.sync_status === 'synced' ? 'Synced' : asset.sync_status === 'failed' ? 'Sync failed' : 'Never synced'}</p>
                  </div>
                </div>
                <div className="p-4 space-y-0.5 divide-y divide-slate-50">
                  <Row label="Last sync" value={asset.last_sync_timestamp ? safeFormat(asset.last_sync_timestamp, 'dd MMM yyyy HH:mm') : 'Never'} />
                  <Row label="Asset Panda ID" value={asset.panda_asset_id} mono />
                  <Row label="GC Compliance ID" value={asset.external_compliance_id} mono />
                </div>
              </div>

              {/* Linked equipment */}
              {linkedItems.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-2">{linkedItems.length} linked item(s)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedItems.map(eq => {
                      const m = TYPE_META[eq.asset_type] || TYPE_META.machinery;
                      return (
                        <span key={eq.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${m.tint}`}>
                          <m.icon className="w-3 h-3" /> {eq.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'certificates' && (
            <CertificateVault assetIds={vaultAssetIds} assetNames={vaultAssetNames} />
          )}

          {tab === 'service' && (
            <ServiceHistoryPanel assetId={asset.id} assetName={asset.name} assetType={asset.asset_type} />
          )}

          {tab === 'financial' && (
            <AssetFinancialLifecycle assetId={asset.id} />
          )}

          {tab === 'pack' && (
            <CompliancePackGenerator asset={asset} linkedItems={linkedItems} />
          )}

          {tab === 'qr' && (
            <AssetQRCard asset={asset} />
          )}
        </div>
      </div>
    </div>
  );
}