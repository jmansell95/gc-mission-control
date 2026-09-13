import React, { useState, useRef } from 'react';
import {
  Cog, Wrench, Package, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, ChevronRight, Link2, Lock, Upload, Database, CircleDot,
  Warehouse, MapPin, Clock, CalendarClock, AlertTriangle, Weight,
  Boxes, Ruler, PoundSterling, TrendingDown, Loader2, Check,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { rollupCompliance, derivedComplianceStatus, COMPLIANCE_META, daysUntil } from '@/utils/rigRollup';
import AssetColourDot from '@/components/assethub/AssetColourDot';
import RigUtilizationSparkline from '@/components/righub/RigUtilizationSparkline';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700',
  machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600',
  lifting: 'from-teal-500 to-cyan-700',
  portable_appliance: 'from-amber-400 to-yellow-600',
};

function safeFmt(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

function isInDepot(asset) {
  const loc = (asset?.storage_location || '').toLowerCase().trim();
  return loc.includes('depot') || loc.includes('yard') || loc.includes('dartford');
}

/** Photo banner with compliance countdown overlay */
function CardBanner({ asset, height = 'h-32' }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const img = Array.isArray(asset?.panda_image_urls) ? asset.panda_image_urls[0] : null;
  const imgUrl = img?.thumb || img?.medium || img?.url;
  const Icon = TYPE_ICON[asset?.asset_type] || Wrench;
  const grad = TYPE_GRADIENT[asset?.asset_type] || 'from-slate-500 to-slate-700';
  const expiry = asset?.compliance_expiry_date;
  const days = expiry ? daysUntil(expiry) : null;
  const hasPanda = !!asset?.panda_asset_id;

  const pillCls = days < 0 ? 'bg-red-500 text-white' : days <= 30 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!hasPanda) {
      toast({ title: 'Not linked to Asset Panda', description: 'Sync this asset first.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await base44.functions.invoke('pushAssetPhotoToPanda', {
        site_asset_id: asset.id, action: 'upload', file_url, file_name: file.name,
      });
      toast({ title: 'Photo uploaded', description: 'Synced to Asset Panda.' });
      qc.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  return (
    <div className={`relative ${height} overflow-hidden`}>
      {imgUrl ? (
        <img src={imgUrl} alt={asset?.name || ''} loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
      ) : null}
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-50/30 transition"
        style={{ display: imgUrl ? 'none' : 'flex', background: imgUrl ? '' : `linear-gradient(135deg, var(--tw-gradient-stops))` }
        }
        onClick={(e) => { e.stopPropagation(); if (hasPanda) fileRef.current?.click(); }}
      >
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Icon className="w-6 h-6 text-white" />}
        </div>
        {hasPanda && !imgUrl && (
          <p className="text-[10px] font-semibold text-white/90 text-center">Click to upload</p>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
      {days !== null && (
        <div className={`absolute bottom-2 left-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg ${pillCls}`}>
          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      )}
    </div>
  );
}

/** Quantity badge */
function QuantityBadge({ available, owned }) {
  if (available == null && owned == null) return null;
  const o = owned ?? null;
  const a = available != null ? available : (o != null ? o : 0);
  const tone = a <= 0
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : (o != null && a < o ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200');
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tone}`}>
      <Boxes className="w-2.5 h-2.5" /> {o != null ? `${a} / ${o}` : `${a}`}
    </span>
  );
}

/** Financial chip */
function FinancialChip({ asset }) {
  if (!asset.acquisition_cost) return null;
  const bookValue = asset.current_book_value || 0;
  const annualDep = asset.annual_depreciation || 0;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
      <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
      {bookValue > 0 ? `${(bookValue / 1000).toFixed(0)}k` : '—'}
      {annualDep > 0 && <><span className="text-slate-300">·</span><TrendingDown className="w-2.5 h-2.5 text-amber-400" />{`${(annualDep / 1000).toFixed(1)}k/yr`}</>}
    </span>
  );
}

/** Lifecycle badge */
const LIFECYCLE_META = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  aging: { label: 'Aging', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  due_for_replacement: { label: 'Replace', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  disposed: { label: 'Disposed', cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

function deriveLifecycle(asset) {
  if (asset.disposal_date) return 'disposed';
  if (asset.lifecycle_status === 'disposed') return 'disposed';
  if (asset.replacement_date) {
    const days = Math.floor((new Date(asset.replacement_date) - new Date()) / 86400000);
    if (days <= 90 && days >= -365) return 'due_for_replacement';
  }
  if (asset.depreciation_years && asset.acquisition_date) {
    const yearsElapsed = (Date.now() - new Date(asset.acquisition_date).getTime()) / (365.25 * 86400000);
    if (yearsElapsed >= asset.depreciation_years) return 'aging';
  }
  return asset.lifecycle_status || 'active';
}

function LifecycleBadge({ asset }) {
  const status = deriveLifecycle(asset);
  const meta = LIFECYCLE_META[status];
  const years = asset.acquisition_date ? Math.floor((Date.now() - new Date(asset.acquisition_date).getTime()) / (365.25 * 86400000)) : null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label.split(' ')[0]}
      {years != null && <span className="opacity-60">· {years}y</span>}
    </span>
  );
}

/** Operating hours strip */
function OperatingHoursStrip({ asset }) {
  const hours = asset.operating_hours || asset.hours_used || 0;
  if (!hours && !asset.service_interval_hours) return null;
  const interval = asset.service_interval_hours || 250;
  const pct = Math.min((hours / interval) * 100, 100);
  const tone = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
      <span className="text-[10px] font-semibold text-slate-600 tabular-nums">{Math.round(hours)}h</span>
      {asset.service_interval_hours && (
        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * AssetCard — unified, responsive card for both rigs and equipment.
 * Clean hub-glass surface with photo banner, identity, spec pills,
 * compliance status, and action buttons. Touch-friendly on all screens.
 */
export default function AssetCard({ asset, linkedItems = [], parentRig, compact = false, selectionMode = false, isSelected = false, onToggleSelect, onOpen, onCertVault, onUploadCert, onOpenRig }) {
  if (!asset) return null;
  const isRig = asset.asset_type === 'rig';
  const Icon = TYPE_ICON[asset.asset_type] || Wrench;
  const liveStatus = isRig
    ? (linkedItems.length > 0 ? rollupCompliance(asset, linkedItems).master : derivedComplianceStatus(asset))
    : derivedComplianceStatus(asset);
  const meta = COMPLIANCE_META[liveStatus];
  const MasterIcon = liveStatus === 'expired' ? ShieldX : liveStatus === 'expiring' ? ShieldAlert : liveStatus === 'unknown' ? HelpCircle : ShieldCheck;
  const borderAccent = liveStatus === 'expired' ? 'border-l-4 border-l-red-500' : liveStatus === 'expiring' ? 'border-l-4 border-l-amber-500' : liveStatus === 'unknown' ? 'border-l-4 border-l-slate-400' : 'border-l-4 border-l-emerald-500';
  const depotTagged = isInDepot(asset);
  const rollup = isRig && linkedItems.length > 0 ? rollupCompliance(asset, linkedItems) : null;
  const d = daysUntil(asset.compliance_expiry_date);

  const handleClick = () => {
    if (selectionMode) { onToggleSelect?.(asset.id); }
    else { onOpen?.(asset); }
  };

  return (
    <div
      onClick={handleClick}
      className={`hub-glass rounded-2xl text-left relative ${borderAccent} ${selectionMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-lg transition'} ${isSelected ? 'ring-2 ring-emerald-500' : ''} overflow-hidden flex flex-col`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center border-2 transition z-20 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-white/80 border-slate-300'}`}>
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}

      {/* Photo banner */}
      <CardBanner asset={asset} height={compact ? 'h-20' : 'h-32'} />

      {/* Depot badge */}
      {depotTagged && !selectionMode && (
        <span className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5 shadow-sm z-10">
          <Warehouse className="w-2.5 h-2.5" /> DEPOT
        </span>
      )}

      {/* Body */}
      <div className={`p-3.5 flex-1 flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
        {/* Parent rig link (equipment only) */}
        {parentRig && !selectionMode && !compact && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenRig?.(parentRig); }}
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition w-fit"
          >
            <Link2 className="w-3 h-3" /> {parentRig.name}
          </button>
        )}

        {/* Identity */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <AssetColourDot colour={asset.colour} size={12} />
              <p className="font-semibold text-slate-900 truncate text-sm">{asset.name}</p>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {[asset.make, asset.model].filter(Boolean).join(' · ') || (isRig && asset.rig_type && asset.rig_type !== 'n/a' ? `${asset.rig_type.toUpperCase()} Rig` : (asset.equipment_type || ''))}
            </p>
            <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
              {asset.fleet_number ? `FAA ${asset.fleet_number}` : ''}{asset.serial_number ? `${asset.fleet_number ? ' · ' : ''}S/N ${asset.serial_number}` : ''}
            </p>
          </div>
          {!selectionMode && <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />}
        </div>

        {/* Status + spec pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.tone}`}>
            <MasterIcon className="w-3 h-3" /> {meta.label}
          </span>
          {isRig && rollup && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              <Link2 className="w-2.5 h-2.5" /> {linkedItems.length}
            </span>
          )}
          {(asset.operating_hours || asset.hours_used) != null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              <Clock className="w-2.5 h-2.5" /> {asset.operating_hours || asset.hours_used}h
            </span>
          )}
          {asset.storage_location && !compact && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[120px]">
              <MapPin className="w-2.5 h-2.5" /> {asset.storage_location}
            </span>
          )}
          {asset.weight_kg != null && !compact && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              <Weight className="w-2.5 h-2.5" /> {Math.round(asset.weight_kg)}kg
            </span>
          )}
          <QuantityBadge available={asset.quantity_available} owned={asset.quantity_owned} />
        </div>

        {/* Source badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {asset.panda_asset_id ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              <Database className="w-2.5 h-2.5" /> Panda
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
              <CircleDot className="w-2.5 h-2.5" /> Local
            </span>
          )}
          {!compact && <FinancialChip asset={asset} />}
          {!compact && <LifecycleBadge asset={asset} />}
        </div>

        {/* Operating hours strip */}
        {!compact && (asset.operating_hours || asset.service_interval_hours) && (
          <OperatingHoursStrip asset={asset} />
        )}

        {/* Compliance rollup progress (rigs only) */}
        {isRig && rollup && !compact && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Compliance</span>
              <span className="font-semibold text-slate-600">
                {rollup.counts.compliant}/{linkedItems.length + 1}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rollup.counts.compliant / (linkedItems.length + 1) >= 0.85 ? 'bg-emerald-500' : rollup.counts.compliant / (linkedItems.length + 1) >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${(rollup.counts.compliant / (linkedItems.length + 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Expiry date */}
        {d !== null && !compact && (
          <p className={`text-[10px] font-medium flex items-center gap-1 ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
            <CalendarClock className="w-3 h-3" /> {d < 0 ? 'Expired' : `${d}d left`} · {safeFmt(asset.compliance_expiry_date)}
          </p>
        )}

        {/* Sparkline (rigs only, non-compact) */}
        {isRig && !compact && (
          <RigUtilizationSparkline rigId={asset.id} />
        )}

        {/* Action buttons */}
        {!selectionMode && !compact && (
          <div className="mt-auto flex gap-1.5 pt-1">
            {onCertVault && isRig && (
              <button
                onClick={(e) => { e.stopPropagation(); onCertVault(asset); }}
                className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[11px] font-semibold transition justify-center min-h-[36px]"
              >
                <Lock className="w-3.5 h-3.5" /> Certs
              </button>
            )}
            {onUploadCert && (
              <button
                onClick={(e) => { e.stopPropagation(); onUploadCert(asset); }}
                className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-2 bg-primary hover:bg-[#244715] text-white rounded-lg text-[11px] font-semibold transition justify-center min-h-[36px]"
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}