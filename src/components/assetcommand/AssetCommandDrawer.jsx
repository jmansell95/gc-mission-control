import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  X, Cog, Wrench, Package, Truck, Anchor, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Clock, CalendarClock, Database, Plug, Navigation,
  AlertTriangle, History, FileText, MapPin, ArrowRight,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { daysUntil } from '@/utils/rigRollup';
import AssetMovementHistory from '@/components/assetcommand/AssetMovementHistory';
import CertificateVault from '@/components/righub/CertificateVault';
import useBackIntercept from '@/hooks/useBackIntercept';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { label: 'PAT / Electrical', icon: Plug, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle },
};

const MAINTENANCE_META = {
  ok: { label: 'Serviced & Current', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: Wrench },
  due_soon: { label: 'Service Due Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: CalendarClock },
  overdue: { label: 'Service Overdue', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX },
  unknown: { label: 'No Service Data', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle },
};

const TABS = [
  { key: 'overview', label: 'Overview', Icon: FileText },
  { key: 'history', label: 'History', Icon: History },
  { key: 'certificates', label: 'Certificates', Icon: ShieldCheck },
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
 * Asset Command Drawer — Hilti ON!Track-style self-contained asset command
 * center. Opens from the scanner when a field/warehouse user taps "Details".
 * Shows the full asset passport (overview, movement history, certificates)
 * with one-tap action buttons: Start Shift & Drive (rigs/vehicles), Book to
 * Vehicle (equipment), Report Fault (all). No navigation away from the
 * scanner — everything the field team needs is in this drawer.
 */
export default function AssetCommandDrawer({ asset, allAssets = [], staffProfile, onClose, onDriveAway, onBookToVehicle, onReportFault }) {
  const [tab, setTab] = useState('overview');
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  useBackIntercept(!!asset, onClose);

  // Fetch today's job assignment for the current staff member — shows
  // context about where they're supposed to be right in the passport.
  const { data: todayAssignment } = useQuery({
    queryKey: ['passport-today-job', staffProfile?.id, today],
    queryFn: async () => {
      if (!staffProfile?.id) return null;
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: today });
      return all.find(a => a.assignment_type === 'job' && a.job_id) || null;
    },
    enabled: !!staffProfile?.id,
  });

  const { data: todayJob } = useQuery({
    queryKey: ['passport-today-job-detail', todayAssignment?.job_id],
    queryFn: async () => {
      if (!todayAssignment?.job_id) return null;
      const jobs = await base44.entities.Job.filter({ id: todayAssignment.job_id });
      return jobs[0] || null;
    },
    enabled: !!todayAssignment?.job_id,
  });

  if (!asset) return null;

  const typeMeta = TYPE_META[asset.asset_type] || TYPE_META.machinery;
  const compMeta = COMPLIANCE_META[asset.compliance_status] || COMPLIANCE_META.unknown;
  const maintMeta = MAINTENANCE_META[asset.maintenance_status] || MAINTENANCE_META.unknown;
  const TypeIcon = typeMeta.icon;

  const isDriveable = asset.asset_type === 'rig' || asset.asset_type === 'vehicle';
  const canDispatch = asset.compliance_status === 'compliant' || asset.compliance_status === 'unknown';
  const daysToExpiry = daysUntil(asset.compliance_expiry_date);

  const linkedItems = (asset.linked_equipment_ids || [])
    .map(id => allAssets.find(a => a.id === id))
    .filter(Boolean);

  const vaultAssets = [asset, ...linkedItems];
  const vaultAssetIds = vaultAssets.map(a => a.id);
  const vaultAssetNames = Object.fromEntries(vaultAssets.map(a => [a.id, a.name]));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col animate-pop-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${typeMeta.tint} flex-shrink-0`}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{asset.name}</h3>
              <p className="text-[11px] text-slate-400 truncate">Asset Command · {typeMeta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Compliance banner */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${compMeta.tone}`}>
            <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
          </span>
          {daysToExpiry !== null && (
            <span className="text-[11px] text-slate-500">
              {daysToExpiry >= 0 ? `${daysToExpiry}d until expiry` : `Expired ${Math.abs(daysToExpiry)}d ago`}
            </span>
          )}
          {!asset.is_active && <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full uppercase ml-auto">Inactive</span>}
        </div>

        {/* Action bar — Hilti-style one-tap actions */}
        <div className="px-4 py-3 border-b border-slate-100 flex gap-2 flex-shrink-0">
          {isDriveable ? (
            <button
              onClick={() => onDriveAway?.(asset)}
              disabled={!canDispatch}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                canDispatch ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" /> Start Shift & Drive
            </button>
          ) : (
            <button
              onClick={() => onBookToVehicle?.(asset)}
              disabled={!canDispatch}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                canDispatch ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Book to Vehicle
            </button>
          )}
          <button
            onClick={() => onReportFault?.(asset)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Report Fault
          </button>
        </div>

        {!canDispatch && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>Cannot dispatch — compliance expired. Log a new inspection to reactivate.</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-3 flex-shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map(t => {
            const TabIcon = t.Icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} type="button"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <TabIcon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'overview' && (
            <>
              {/* Current Job context — links the passport to the staff schedule */}
              {todayJob && (
                <button
                  onClick={() => navigate('/staff-schedule')}
                  className="w-full flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 hover:bg-emerald-100 transition active:scale-[0.99] text-left mb-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wide">Your Current Job</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{todayJob.name}</p>
                    {todayJob.location && (
                      <p className="text-[11px] text-slate-500 truncate">{todayJob.location}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                </button>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{asset.serial_number || 'No serial'}</span>
                {asset.rig_type && asset.rig_type !== 'n/a' && <span className="uppercase font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">{asset.rig_type}</span>}
                {asset.equipment_type && <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded">{asset.equipment_type}</span>}
                {asset.compliance_category && <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">{asset.compliance_category}</span>}
              </div>

              {/* Compliance & safety */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><compMeta.Icon className="w-3.5 h-3.5" /></div>
                  <p className="text-xs font-semibold text-slate-800">Compliance & Safety</p>
                </div>
                <div className="p-4 space-y-0.5 divide-y divide-slate-50">
                  <Row label="Expiry date" value={asset.compliance_expiry_date ? safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime CoC'} />
                  <Row label="Responsible person" value={asset.responsible_person} />
                  <Row label="Tooling" value={asset.tooling_notes} />
                  <Row label="Last checked" value={asset.compliance_last_checked ? safeFormat(asset.compliance_last_checked, 'dd MMM yyyy') : 'Never'} />
                </div>
              </div>

              {/* Maintenance */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><maintMeta.Icon className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">Maintenance</p>
                    <p className="text-[10px] text-slate-400">{asset.last_service_date ? `Last ${safeFormat(asset.last_service_date, 'dd MMM yyyy')}` : 'No prior service'}{asset.next_service_date ? ` · Next ${safeFormat(asset.next_service_date, 'dd MMM yyyy')}` : ''}</p>
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
                  <Row label="Stock level" value={asset.stock_level?.replace(/_/g, ' ')} />
                  <Row label="Storage location" value={asset.storage_location} />
                </div>
              </div>

              {/* Linked equipment */}
              {linkedItems.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-2">{linkedItems.length} linked item(s)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedItems.map(eq => {
                      const m = TYPE_META[eq.asset_type] || TYPE_META.machinery;
                      const EqIcon = m.icon;
                      return (
                        <span key={eq.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${m.tint}`}>
                          <EqIcon className="w-3 h-3" /> {eq.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'history' && (
            <AssetMovementHistory asset={asset} />
          )}

          {tab === 'certificates' && (
            <CertificateVault assets={vaultAssets} assetIds={vaultAssetIds} assetNames={vaultAssetNames} />
          )}
        </div>
      </div>
    </div>
  );
}