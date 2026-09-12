import React from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug,
  ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  ArrowLeft, Pencil, RefreshCw, QrCode, Hash, Weight, Upload,
} from 'lucide-react';
import { COMPLIANCE_META, ASSET_TYPE_META } from '@/utils/rigRollup';
import AssetColourDot from '@/components/assethub/AssetColourDot';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700',
  machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600',
  vehicle: 'from-slate-500 to-slate-700',
  lifting: 'from-teal-500 to-cyan-700',
  portable_appliance: 'from-amber-400 to-yellow-600',
};

const COMPLIANCE_RING = {
  compliant: { color: '#10b981', pct: 100 },
  expiring: { color: '#f59e0b', pct: 70 },
  expired: { color: '#ef4444', pct: 25 },
  unknown: { color: '#94a3b8', pct: 8 },
};

/**
 * Premium glass-card hero with a circular compliance ring containing the
 * asset photo (or type icon fallback), key specs at a glance, and refined
 * action buttons. Used in both the mobile top and the desktop left rail.
 */
export default function AssetDetailHero({ asset, onBack, onEdit, onRecert, onQR, onRefresh, refreshing }) {
  if (!asset) return null;
  const Icon = TYPE_ICON[asset.asset_type] || Wrench;
  const meta = COMPLIANCE_META[asset.compliance_status || 'unknown'];
  const CompIcon = asset.compliance_status === 'expired' ? ShieldX
    : asset.compliance_status === 'expiring' ? ShieldAlert
    : asset.compliance_status === 'unknown' ? HelpCircle
    : ShieldCheck;
  const grad = TYPE_GRADIENT[asset.asset_type] || 'from-slate-500 to-slate-700';
  const ring = COMPLIANCE_RING[asset.compliance_status || 'unknown'] || COMPLIANCE_RING.unknown;
  const photo = asset.panda_image_urls?.[0];
  const photoUrl = photo?.medium || photo?.url;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (ring.pct / 100) * circumference;

  return (
    <div className="hub-glass rounded-3xl overflow-hidden">
      {/* Top accent bar — type-coloured gradient strip */}
      <div className={`h-1.5 bg-gradient-to-r ${grad}`} />

      {/* Top row — back + actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary text-xs font-semibold transition">
          <ArrowLeft className="w-4 h-4" /> Assets
        </button>
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {onRecert && (
            <button onClick={onRecert} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg text-xs font-bold transition shadow-sm">
              <Upload className="w-3.5 h-3.5" /> Upload Cert
            </button>
          )}
          {onQR && (
            <button onClick={onQR} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition">
              <QrCode className="w-3.5 h-3.5" /> QR
            </button>
          )}
          {asset.panda_asset_id && onRefresh && (
            <button onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Syncing' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {/* Main identity — compliance ring with photo/icon + details */}
      <div className="flex items-center gap-4 px-4 pb-3 pt-2">
        {/* Compliance ring with photo/icon inside */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle
              cx="32" cy="32" r={radius}
              fill="none"
              stroke={ring.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div
            className="absolute inset-2.5 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${ring.color}18, ${ring.color}06)` }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-8 h-8" style={{ color: ring.color }} />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AssetColourDot colour={asset.colour} size={16} />
            <h1 className="font-extrabold text-slate-900 text-lg lg:text-xl truncate leading-tight">{asset.name}</h1>
            {asset.fleet_number && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                <Hash className="w-3 h-3" /> FAA {asset.fleet_number}
              </span>
            )}
            {asset.serial_number && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap font-mono">
                <Hash className="w-3 h-3" /> S/N {asset.serial_number}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {[asset.make, asset.model].filter(Boolean).join(' · ') || (ASSET_TYPE_META[asset.asset_type]?.label || asset.asset_type)}
            {asset.equipment_type ? ` · ${asset.equipment_type}` : ''}
            {asset.rig_type && asset.rig_type !== 'n/a' ? ` · ${asset.rig_type.toUpperCase()}` : ''}
          </p>
        </div>
      </div>

      {/* Spec pills bar */}
      <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: `${ring.color}15`, color: ring.color }}
        >
          <CompIcon className="w-3.5 h-3.5" /> {meta.label}
        </span>
        {asset.is_active === false && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            <ShieldX className="w-3.5 h-3.5" /> Inactive
          </span>
        )}
        {asset.maintenance_status && asset.maintenance_status !== 'unknown' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
            <Wrench className="w-3.5 h-3.5" /> {asset.maintenance_status === 'ok' ? 'Serviced' : asset.maintenance_status === 'due_soon' ? 'Service Due' : asset.maintenance_status === 'overdue' ? 'Overdue' : ''}
          </span>
        )}
        {asset.weight_kg != null && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
            <Weight className="w-3.5 h-3.5" /> {Math.round(asset.weight_kg)} kg
          </span>
        )}
      </div>
    </div>
  );
}