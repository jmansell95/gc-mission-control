import React from 'react';
import {
  X, Wrench, Package, Truck, Anchor, Plug, Cog, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Pencil, ChevronRight, Link2, CalendarClock, RefreshCw,
  Warehouse, MapPin, Hash, Activity, Settings, Check,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, ASSET_TYPE_META, daysUntil } from '@/utils/rigRollup';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';
import RigCertificateHero from '@/components/righub/RigCertificateHero';
import AssetPandaInfoPanel from '@/components/righub/AssetPandaInfoPanel';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700', machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600', vehicle: 'from-slate-500 to-slate-700',
  lifting: 'from-teal-500 to-cyan-700', portable_appliance: 'from-amber-400 to-yellow-600',
};

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

export default function EquipmentDetailDrawer({ equipment, parentRig, onClose, onOpenRig, onEdit, onRecert }) {
  if (!equipment) return null;
  const Icon = TYPE_ICON[equipment.asset_type] || Wrench;
  const meta = COMPLIANCE_META[equipment.compliance_status || 'unknown'];
  const CompIcon = equipment.compliance_status === 'expired' ? ShieldX : equipment.compliance_status === 'expiring' ? ShieldAlert : equipment.compliance_status === 'unknown' ? HelpCircle : ShieldCheck;
  const d = daysUntil(equipment.compliance_expiry_date);
  const grad = TYPE_GRADIENT[equipment.asset_type] || 'from-slate-500 to-slate-700';
  const depotTagged = (equipment.storage_location || '').toLowerCase().match(/depot|yard|dartford/);
  const ready = equipment.is_active !== false && equipment.stock_level !== 'out_of_stock' && equipment.stock_level !== 'needs_service';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-pop-in">
        {/* Hero header with type-coloured gradient */}
        <div className={`sticky top-0 z-20 bg-gradient-to-br ${grad} text-white rounded-t-2xl px-5 py-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white truncate text-lg">{equipment.name}</h3>
                <p className="text-xs text-white/80 truncate">{ASSET_TYPE_META[equipment.asset_type]?.label || equipment.asset_type}{equipment.equipment_type ? ` · ${equipment.equipment_type}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <CompIcon className="w-3.5 h-3.5" /> {meta.label}
              </span>
              {onEdit && (
                <button onClick={() => onEdit(equipment)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition backdrop-blur-sm">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              {onRecert && (
                <button onClick={() => onRecert(equipment)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/80 hover:bg-amber-400 text-amber-950 rounded-lg text-xs font-semibold transition">
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
          {/* Certificate hero — front and centre compliance status */}
          <RigCertificateHero asset={equipment} />

          {/* Depot / ready banner */}
          {depotTagged && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Warehouse className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-800">In Depot — Ready to Assign</p>
                <p className="text-[11px] text-emerald-600">{equipment.storage_location} · {ready ? 'Available for rig or staff assignment' : 'Currently unavailable'}</p>
              </div>
              {ready && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-600 text-white">
                  <Check className="w-3 h-3" /> Ready
                </span>
              )}
            </div>
          )}

          {/* Parent rig link — bidirectional navigation */}
          {parentRig ? (
            <button onClick={() => onOpenRig(parentRig)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition text-left group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Cog className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1"><Link2 className="w-3 h-3" /> Linked to rig</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{parentRig.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{parentRig.rig_type?.toUpperCase()} rig system · click to view rig</p>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
            </button>
          ) : (
            !depotTagged && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-500">Not linked to any rig. Open a rig and use <strong>Link</strong> to attach this equipment.</p>
              </div>
            )
          )}

          {/* Identity & specs */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Hash className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Identity & Specs</p>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1"><Hash className="w-3 h-3" /> {equipment.serial_number || 'No serial'}</span>
                {equipment.compliance_category && <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">{equipment.compliance_category}</span>}
                {!equipment.is_active && <span className="text-red-700 font-bold bg-red-50 px-2 py-1 rounded uppercase">Inactive</span>}
                {equipment.colour && <span className="text-slate-600 bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> {equipment.colour}</span>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 divide-x divide-slate-100">
                <div className="pr-2">
                  <InfoRow icon={CalendarClock} label="Expiry" value={equipment.compliance_expiry_date ? safeFormat(equipment.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime'} tone={d === null ? 'text-slate-700' : d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-700'} />
                  <InfoRow icon={Activity} label="Last service" value={equipment.last_service_date ? safeFormat(equipment.last_service_date, 'dd MMM yyyy') : '—'} />
                  <InfoRow icon={Settings} label="Next service" value={equipment.next_service_date ? safeFormat(equipment.next_service_date, 'dd MMM yyyy') : '—'} />
                </div>
                <div className="pl-2">
                  <InfoRow icon={Wrench} label="Responsible" value={equipment.responsible_person || '—'} />
                  <InfoRow icon={MapPin} label="Storage" value={equipment.storage_location || '—'} />
                  {equipment.maintenance_status && equipment.maintenance_status !== 'unknown' && (
                    <InfoRow icon={Activity} label="Maintenance" value={equipment.maintenance_status.replace('_', ' ')} tone={equipment.maintenance_status === 'overdue' ? 'text-red-600' : equipment.maintenance_status === 'due_soon' ? 'text-amber-600' : 'text-emerald-600'} />
                  )}
                </div>
              </div>
              {equipment.tooling_notes && <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 rounded-lg p-2.5"><span className="font-semibold text-slate-600">Tooling:</span> {equipment.tooling_notes}</p>}
              {equipment.service_notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Service:</span> {equipment.service_notes}</p>}
              {equipment.notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Notes:</span> {equipment.notes}</p>}
              {equipment.repair_notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Repair history:</span> {equipment.repair_notes}</p>}
            </div>
          </div>

          {/* Asset Panda inventory source */}
          <AssetPandaInfoPanel asset={equipment} />

          {/* Certificate vault for this equipment */}
          <CertificateVault assetIds={[equipment.id]} assetNames={{ [equipment.id]: equipment.name }} />

          {/* Service history */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <CalendarClock className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Service & Inspection Timeline</p>
            </div>
            <div className="p-4">
              <ServiceHistoryPanel assetId={equipment.id} assetName={equipment.name} assetType={equipment.asset_type} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}