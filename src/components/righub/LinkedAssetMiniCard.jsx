import React from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug, ChevronRight, ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
} from 'lucide-react';
import { COMPLIANCE_META, ASSET_TYPE_META, daysUntil } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

/**
 * LinkedAssetMiniCard — a compact horizontal card showing a child asset's
 * compliance status at a glance. Used in the rig certificate drill-down view.
 * Shows a small compliance dot, asset name, type icon, and expiry countdown.
 * Tapping opens the asset's own detail popup with the same certificate-first layout.
 */
export default function LinkedAssetMiniCard({ asset, onClick, onUnlink }) {
  if (!asset) return null;
  const Icon = TYPE_ICON[asset.asset_type] || Wrench;
  const meta = COMPLIANCE_META[asset.compliance_status || 'unknown'];
  const d = daysUntil(asset.compliance_expiry_date);
  const StatusIcon = asset.compliance_status === 'expired' ? ShieldX
    : asset.compliance_status === 'expiring' ? ShieldAlert
    : asset.compliance_status === 'unknown' ? HelpCircle
    : ShieldCheck;

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition cursor-pointer"
      onClick={() => onClick(asset)}
    >
      {/* Icon tile */}
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>

      {/* Name + type */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">{asset.name}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {asset.equipment_type || ASSET_TYPE_META[asset.asset_type]?.label || asset.asset_type}
          {asset.serial_number ? ` · ${asset.serial_number}` : ''}
        </p>
      </div>

      {/* Expiry countdown */}
      {d !== null && (
        <span className={`text-[11px] font-medium flex-shrink-0 ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
          {d < 0 ? 'Expired' : `${d}d`}
        </span>
      )}

      {/* Compliance dot + status icon */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <StatusIcon className="w-4 h-4" style={{ color: meta.color || '#94a3b8' }} />
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition flex-shrink-0" />

      {onUnlink && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnlink(asset.id); }}
          className="p-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
          title="Unlink child asset"
        >
          <span className="text-xs">✕</span>
        </button>
      )}
    </div>
  );
}