import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, X, ArrowRight, Plus, ScanLine,
  ShieldCheck, ShieldAlert, ShieldX, Database, Package, Cog,
  Wrench, Truck, Anchor, Plug, Loader2, Link2,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

const TYPE_ICONS = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck,
  lifting: Anchor, portable_appliance: Plug,
};

const COMPLIANCE_META = {
  compliant: { Icon: ShieldCheck, color: 'text-emerald-600', ring: 'ring-emerald-400', bg: 'bg-emerald-50', label: 'Compliant' },
  expiring: { Icon: ShieldAlert, color: 'text-amber-600', ring: 'ring-amber-400', bg: 'bg-amber-50', label: 'Expiring Soon' },
  expired: { Icon: ShieldX, color: 'text-red-600', ring: 'ring-red-400', bg: 'bg-red-50', label: 'Expired' },
  unknown: { Icon: ShieldAlert, color: 'text-slate-500', ring: 'ring-slate-300', bg: 'bg-slate-50', label: 'No Data' },
};

/**
 * ScanResultPopup — bottom-sheet popup that overlays the live camera scanner.
 * Handles four states: resolving, result (normal or already-in-basket), error,
 * and pending-panda (new Asset Panda asset awaiting confirmation).
 *
 * Auto-dismisses after 8s of inactivity (camera keeps running).
 */
export default function ScanResultPopup({
  resolving, scanResult, scanError, pendingPanda, alreadyInBasket, confirming, refreshing,
  onViewAsset, onScanNext, onAddToBasket, onConfirmPanda, onCancelPanda, extraActions = [],
}) {
  const hasContent = resolving || scanResult || scanError || pendingPanda;
  if (!hasContent) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      {/* Semi-transparent backdrop — camera still visible behind */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onScanNext} />

      {/* Bottom sheet */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[75vh] overflow-y-auto safe-area-bottom">
        {/* Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {resolving ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Checking Asset Panda…</p>
          </div>
        ) : pendingPanda ? (
          <PandaContent panda={pendingPanda} confirming={confirming} onConfirm={onConfirmPanda} onCancel={onCancelPanda} />
        ) : scanError ? (
          <ErrorContent error={scanError} onTryAgain={onScanNext} />
        ) : scanResult ? (
          <ResultContent
            asset={scanResult}
            alreadyInBasket={alreadyInBasket}
            refreshing={refreshing}
            onViewAsset={onViewAsset}
            onScanNext={onScanNext}
            onAddToBasket={onAddToBasket}
            extraActions={extraActions}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ─── Result (normal or already-in-basket) ─── */
function ResultContent({ asset, alreadyInBasket, refreshing, onViewAsset, onScanNext, onAddToBasket, extraActions = [] }) {
  const [qty, setQty] = useState(1);
  const isStockItem = asset.quantity_owned != null && asset.quantity_owned > 1;
  const maxQty = Math.min(asset.quantity_available || asset.quantity_owned || 99, asset.quantity_owned || 99);
  const status = asset.compliance_status || 'unknown';
  const meta = COMPLIANCE_META[status] || COMPLIANCE_META.unknown;
  const StatusIcon = meta.Icon;
  const TypeIcon = TYPE_ICONS[asset.asset_type] || Package;
  const expiryDate = asset.compliance_expiry_date;
  const daysToExpiry = expiryDate ? differenceInDays(new Date(expiryDate + 'T00:00:00'), new Date()) : null;

  return (
    <div className="pb-5">
      {/* Refreshing shimmer */}
      {refreshing && (
        <div className="h-1 w-full bg-emerald-50 overflow-hidden">
          <div className="h-full w-1/3 bg-emerald-400 shimmer rounded-full" />
        </div>
      )}

      {/* Compliance ring + identity */}
      <div className="px-5 pt-3 pb-4 flex items-center gap-4">
        <div className={`relative w-16 h-16 rounded-full flex items-center justify-center ring-4 ${meta.ring} ${meta.bg} flex-shrink-0`}>
          {alreadyInBasket ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          ) : (
            <StatusIcon className={`w-8 h-8 ${meta.color}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {alreadyInBasket && (
            <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-1">ALREADY IN BASKET</span>
          )}
          <p className="text-lg font-bold text-slate-900 truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {asset.serial_number && (
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{asset.serial_number}</span>
            )}
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              <StatusIcon className="w-3 h-3" /> {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Info chips */}
      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
          <TypeIcon className="w-3 h-3" /> {asset.asset_type?.replace(/_/g, ' ')}
        </span>
        {asset.stock_level && asset.stock_level !== 'unknown' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 capitalize">
            {asset.stock_level.replace(/_/g, ' ')}
          </span>
        )}
        {asset.storage_location && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500 truncate max-w-[140px]">
            {asset.storage_location}
          </span>
        )}
        {daysToExpiry !== null && (
          <span className="text-[11px] font-medium text-slate-400">
            {daysToExpiry >= 0 ? `${daysToExpiry}d left` : `${Math.abs(daysToExpiry)}d overdue`}
          </span>
        )}
      </div>

      {/* Context-aware extra actions (PAT test, repair, fault, etc.) */}
      {extraActions.length > 0 && (
        <div className="px-5 pb-2 flex gap-2 flex-wrap">
          {extraActions.map((action, i) => (
            <button
              key={i}
              onClick={() => action.onClick(asset)}
              className={action.className || 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95'}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Quantity stepper for stock/consumable items */}
      {isStockItem && !alreadyInBasket && (
        <div className="px-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Quantity</p>
            <p className="text-[11px] text-slate-400">{asset.quantity_available || 0} available of {asset.quantity_owned} owned</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 font-bold text-lg active:scale-90 transition"
            >
              −
            </button>
            <span className="w-12 text-center text-lg font-bold text-slate-900 tabular-nums">{qty}</span>
            <button
              onClick={() => setQty(q => Math.min(maxQty, q + 1))}
              className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 font-bold text-lg active:scale-90 transition"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 flex gap-2">
        <button
          onClick={() => onViewAsset(asset)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95"
        >
          <ArrowRight className="w-4 h-4" /> View
        </button>
        <button
          onClick={onScanNext}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition active:scale-95"
        >
          <ScanLine className="w-4 h-4" /> Scan Next
        </button>
        {!alreadyInBasket && (
          <button
            onClick={() => onAddToBasket(asset, qty)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Error (no match) ─── */
function ErrorContent({ error, onTryAgain }) {
  return (
    <div className="px-6 py-6 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 ring-4 ring-red-200 flex items-center justify-center mb-3">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <p className="text-base font-bold text-slate-900">No match found</p>
      <p className="text-sm text-slate-500 mt-0.5">This barcode isn't in your inventory</p>
      {error && (
        <p className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded mt-2 max-w-full truncate">{error}</p>
      )}
      <button
        onClick={onTryAgain}
        className="mt-4 inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition active:scale-95"
      >
        <ScanLine className="w-4 h-4" /> Try Again
      </button>
    </div>
  );
}

/* ─── Panda confirm (new Asset Panda asset) ─── */
function PandaContent({ panda, confirming, onConfirm, onCancel }) {
  return (
    <div className="pb-5">
      <div className="px-5 pt-3 pb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-50 ring-4 ring-blue-300 flex items-center justify-center flex-shrink-0">
          <Database className="w-8 h-8 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full mb-1">NEW FROM ASSET PANDA</span>
          <p className="text-lg font-bold text-slate-900 truncate">{panda.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {panda.serial && <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{panda.serial}</span>}
            {panda.barcode && <span className="text-xs text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{panda.barcode}</span>}
          </div>
        </div>
      </div>
      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
        {panda.asset_type && <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">{panda.asset_type}</span>}
        {panda.stock_level && panda.stock_level !== 'unknown' && <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 capitalize">{panda.stock_level.replace(/_/g, ' ')}</span>}
        {panda.group_label && <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600 truncate max-w-[160px]">{panda.group_label}</span>}
      </div>
      <div className="px-5 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm transition active:scale-95 disabled:opacity-60"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {confirming ? 'Linking…' : 'Link to Inventory'}
        </button>
        <button
          onClick={onCancel}
          disabled={confirming}
          className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition active:scale-95 disabled:opacity-60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}