import React, { useMemo } from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, ChevronRight, Link2, Lock, ScanLine, Check, CheckSquare, Database, CircleDot,
  Warehouse, MapPin, CalendarClock, AlertTriangle, Boxes, Hash, Ruler, Gauge, Clock,
  TrendingDown, PoundSterling, Activity, Weight, Upload,
} from 'lucide-react';
import { rollupCompliance, derivedComplianceStatus, COMPLIANCE_META, ASSET_TYPE_META, findParentRig, daysUntil } from '@/utils/rigRollup';
import RigUtilizationSparkline from '@/components/righub/RigUtilizationSparkline';


const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700', machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600', vehicle: 'from-slate-500 to-slate-700',
  lifting: 'from-teal-500 to-cyan-700', portable_appliance: 'from-amber-400 to-yellow-600',
};

function safeFmt(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch { return d; } }

/** Tooltip for the Panda/Local source badge — includes last sync time when available. */
function syncTitle(asset) {
  const base = asset.panda_asset_id ? 'Synced from Asset Panda' : 'Created locally — not in Asset Panda';
  if (asset.last_sync_timestamp) {
    try { return `${base} · last sync ${new Date(asset.last_sync_timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`; } catch { return base; }
  }
  return base;
}

/** An asset is "in depot" if its storage_location mentions depot or yard. */
export function isInDepot(asset) {
  const loc = (asset?.storage_location || '').toLowerCase().trim();
  return loc.includes('depot') || loc.includes('yard') || loc.includes('dartford');
}

/** An asset is "ready" (available for assignment) if active and not out of stock / needing service. */
function isReady(asset) {
  if (asset.is_active === false) return false;
  if (asset.stock_level === 'out_of_stock' || asset.stock_level === 'needs_service') return false;
  return true;
}

/** Casing items — detected by name/equipment_type containing "casing". */
function isCasingItem(asset) {
  const t = `${asset?.name || ''} ${asset?.equipment_type || ''} ${asset?.compliance_category || ''}`.toLowerCase();
  return t.includes('casing');
}

/** Lifecycle status meta — matches LIFECYCLE_META in AssetFinancialTab. */
const LIFECYCLE_META = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  aging: { label: 'Aging', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  due_for_replacement: { label: 'Due for Replacement', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  disposed: { label: 'Disposed', cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

/** Derive lifecycle status from asset fields (mirrors AssetLifecycleManager logic). */
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

/** Years in service from acquisition date. */
function yearsInService(asset) {
  if (!asset.acquisition_date) return null;
  return Math.floor((Date.now() - new Date(asset.acquisition_date).getTime()) / (365.25 * 86400000));
}

/** Compact financial summary chip — book value + annual depreciation. */
function FinancialChip({ asset }) {
  if (!asset.acquisition_cost) return null;
  const bookValue = asset.current_book_value || 0;
  const annualDep = asset.annual_depreciation || 0;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200" title={`Book value £${Math.round(bookValue).toLocaleString()} · £${Math.round(annualDep).toLocaleString()}/yr depreciation`}>
      <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
      {bookValue > 0 ? `${(bookValue / 1000).toFixed(0)}k` : '—'}
      <span className="text-slate-300">·</span>
      <TrendingDown className="w-2.5 h-2.5 text-amber-400" />
      {annualDep > 0 ? `${(annualDep / 1000).toFixed(1)}k/yr` : '—'}
    </span>
  );
}

/** Lifecycle badge with years-in-service. */
function LifecycleBadge({ asset }) {
  const status = deriveLifecycle(asset);
  const meta = LIFECYCLE_META[status];
  const years = yearsInService(asset);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`} title={`${meta.label}${years != null ? ` · ${years}y in service` : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label.split(' ')[0]}
      {years != null && <span className="opacity-60">· {years}y</span>}
    </span>
  );
}

/** Operating hours strip — hours used + % of service interval consumed. */
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

/** Colour-code the Asset Panda condition string. */
function conditionTone(cond) {
  if (!cond) return 'bg-slate-50 text-slate-600 border-slate-200';
  const c = String(cond).toLowerCase();
  if (c.includes('good') || c.includes('excellent') || c.includes('new') || c.includes('like new') || c.includes('ok') || c.includes('great')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (c.includes('fair') || c.includes('used') || c.includes('average') || c.includes('wear') || c.includes('working')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (c.includes('poor') || c.includes('bad') || c.includes('repair') || c.includes('faulty') || c.includes('damage') || c.includes('broken') || c.includes('scrap')) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

/** Quantity available / owned badge — red when 0, amber when low, slate otherwise. */
function QuantityBadge({ available, owned }) {
  if (available == null && owned == null) return null;
  const o = owned ?? null;
  // When Asset Panda tracks owned but not available, all owned units are
  // available (nothing booked out yet) — fall back so the card shows full stock.
  const a = available != null ? available : (o != null ? o : 0);
  const tone = a <= 0
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : (o != null && a < o ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200');
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tone}`} title="Quantity available / owned">
      <Boxes className="w-2.5 h-2.5" /> {o != null ? `${a} / ${o}` : `${a}`}
    </span>
  );
}

/**
 * Photo banner — the top section of every inventory card. Shows the first
 * cached Asset Panda thumbnail full-width with a gradient scrim and a
 * compliance countdown ring overlaid bottom-left. Falls back to the
 * type-gradient icon tile when there's no photo.
 */
function AssetCardBanner({ asset, heightClass = 'h-28' }) {
  const img = Array.isArray(asset?.panda_image_urls) ? asset.panda_image_urls[0] : null;
  const imgUrl = img?.thumb || img?.medium || img?.url;
  const Icon = TYPE_ICON[asset?.asset_type] || Wrench;
  const grad = TYPE_GRADIENT[asset?.asset_type] || 'from-slate-500 to-slate-700';
  const expiry = asset?.compliance_expiry_date;
  const days = expiry ? daysUntil(expiry) : null;
  const showPill = days !== null;
  const pillCls = days < 0 ? 'bg-red-500 text-white' : days <= 30 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';
  return (
    <div className={`relative ${heightClass} overflow-hidden`}>
      {imgUrl ? (
        <img src={imgUrl} alt={asset?.name || ''} loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
      ) : null}
      <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`} style={{ display: imgUrl ? 'none' : 'flex' }}>
        <Icon className="w-10 h-10 text-white/80" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />
      {showPill && (
        <div className={`absolute bottom-2 left-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg ${pillCls}`}>
          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/**
 * Unified inventory grid — renders rigs (with compliance rollup) and equipment
 * in a single grid, filtered by category, search, compliance status, source,
 * and depot-only toggle. Equipment at the depot is visually badged so managers
 * can see what's ready to be assigned to rigs or people.
 */
export default function AssetInventoryGrid({
  assets, rigs, category, search, compFilter, sourceFilter = 'all', depotOnly = false,
  groupBy = 'none',
  selectionMode, selected, setSelected,
  onOpenRig, onOpenEquip, onCertVault, onUploadCert,
}) {
  const q = search.toLowerCase().trim();

  const matchesSource = (a) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'panda') return !!a.panda_asset_id;
    if (sourceFilter === 'local') return !a.panda_asset_id;
    return true;
  };

  const rigsByMaster = useMemo(() => rigs.map(rig => {
    const linked = (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
    return { rig, linked, rollup: rollupCompliance(rig, linked) };
  }), [rigs, assets]);

  const filteredRigs = useMemo(() => rigsByMaster.filter(({ rig, rollup }) => {
    if (depotOnly && !isInDepot(rig)) return false;
    if (!matchesSource(rig)) return false;
    if (compFilter !== 'all' && rollup.master !== compFilter) return false;
    if (!q) return true;
    return (rig.name || '').toLowerCase().includes(q) || (rig.serial_number || '').toLowerCase().includes(q);
  }), [rigsByMaster, q, compFilter, sourceFilter, depotOnly]);

  const filteredEquip = useMemo(() => assets.filter(a => {
    if (a.asset_type === 'rig') return false;
    if (depotOnly && !isInDepot(a)) return false;
    if (!matchesSource(a)) return false;
    if (category !== 'all' && a.asset_type !== category) return false;
    if (compFilter !== 'all' && derivedComplianceStatus(a) !== compFilter) return false;
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }).map(eq => ({ equip: eq, parentRig: findParentRig(eq.id, rigs) })), [assets, rigs, category, q, compFilter, sourceFilter, depotOnly]);

  const showRigs = category === 'all' || category === 'rig';
  const showEquip = category !== 'rig';
  const totalCount = (showRigs ? filteredRigs.length : 0) + (showEquip ? filteredEquip.length : 0);

  // Summary stats
  const depotCount = useMemo(() => assets.filter(a => a.asset_type !== 'rig' && isInDepot(a)).length, [assets]);
  const onSiteCount = useMemo(() => assets.filter(a => a.asset_type !== 'rig' && !isInDepot(a) && a.is_active !== false).length, [assets]);
  const attentionCount = useMemo(() => assets.filter(a => {
    if (a.asset_type === 'rig') return false;
    const d = daysUntil(a.compliance_expiry_date);
    return a.compliance_status === 'expired' || (d !== null && d <= 30) || a.is_active === false;
  }).length, [assets]);

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        {/* Stats strip still shows even on empty filter */}
        <div className="flex flex-wrap gap-2.5">
          <StatPill icon={Boxes} label="Total Equipment" value={assets.filter(a => a.asset_type !== 'rig').length} tone="bg-slate-100 text-slate-600" />
          <StatPill icon={Warehouse} label="In Depot" value={depotCount} tone="bg-emerald-100 text-emerald-700" />
          <StatPill icon={MapPin} label="On Site / Linked" value={onSiteCount} tone="bg-blue-100 text-blue-700" />
          <StatPill icon={AlertTriangle} label="Needs Attention" value={attentionCount} tone="bg-amber-100 text-amber-700" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {assets.length === 0 ? 'No assets yet. Sync from Asset Panda to populate.' : 'No assets match your filters.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats strip */}
      <div className="flex flex-wrap gap-2.5">
        <StatPill icon={Boxes} label="Total Equipment" value={assets.filter(a => a.asset_type !== 'rig').length} tone="bg-slate-100 text-slate-600" />
        <StatPill icon={Warehouse} label="In Depot" value={depotCount} tone="bg-emerald-100 text-emerald-700" />
        <StatPill icon={MapPin} label="On Site / Linked" value={onSiteCount} tone="bg-blue-100 text-blue-700" />
        <StatPill icon={AlertTriangle} label="Needs Attention" value={attentionCount} tone="bg-amber-100 text-amber-700" />
      </div>

      {/* Rig cards (with compliance rollup) */}
      {showRigs && filteredRigs.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <Cog className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Rigs <span className="text-slate-400 font-normal normal-case tracking-normal">({filteredRigs.length})</span></h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRigs.map(({ rig, linked, rollup }) => {
              const meta = COMPLIANCE_META[rollup.master];
              const MasterIcon = rollup.master === 'expired' ? ShieldX : rollup.master === 'expiring' ? ShieldAlert : rollup.master === 'unknown' ? HelpCircle : ShieldCheck;
              const border = rollup.master === 'expired' ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : rollup.master === 'expiring' ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-100' : rollup.master === 'unknown' ? 'border-l-4 border-l-slate-400 ring-1 ring-slate-100' : 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-100';
              const depotTagged = isInDepot(rig);
              return (
                <button key={rig.id} onClick={() => onOpenRig(rig)} className={`insight-card rounded-xl text-left ${border} relative overflow-hidden`}>
                  <AssetCardBanner asset={rig} heightClass="h-32" />
                  {depotTagged && (
                    <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5 z-10">
                      <Warehouse className="w-2.5 h-2.5" /> DEPOT
                    </span>
                  )}
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{rig.name}</p>
                        <p className="text-[11px] text-slate-500 truncate font-medium">
                          {[rig.make, rig.model].filter(Boolean).join(' · ') || (rig.rig_type && rig.rig_type !== 'n/a' ? `${rig.rig_type.toUpperCase()} Rig` : 'Rig')}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {rig.fleet_number ? `FAA ${rig.fleet_number}` : rig.serial_number || ''}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.tone}`}>
                        <MasterIcon className="w-3 h-3" /> {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        <Link2 className="w-2.5 h-2.5" /> {linked.length}
                      </span>
                      {rig.hours_used != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <Clock className="w-2.5 h-2.5" /> {rig.hours_used}h
                        </span>
                      )}
                      {rig.storage_location && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[130px]">
                          <MapPin className="w-2.5 h-2.5" /> {rig.storage_location}
                        </span>
                      )}
                      {rig.panda_asset_id
                        ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200" title={syncTitle(rig)}><Database className="w-2.5 h-2.5" /> Panda</span>
                        : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200" title={syncTitle(rig)}><CircleDot className="w-2.5 h-2.5" /> Local</span>}
                      <QuantityBadge available={rig.quantity_available} owned={rig.quantity_owned} />
                      {rig.weight_kg != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          <Weight className="w-2.5 h-2.5" /> {Math.round(rig.weight_kg)} kg
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mb-2">
                      {['compliant', 'expiring', 'expired', 'unknown'].map(k => rollup.counts[k] > 0 && (
                        <span key={k} className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${COMPLIANCE_META[k].tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${COMPLIANCE_META[k].dot}`} /> {rollup.counts[k]}
                        </span>
                      ))}
                    </div>
                    {/* Financial + lifecycle + utilization strip */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <FinancialChip asset={rig} />
                      <LifecycleBadge asset={rig} />
                    </div>
                    <div className="mb-1.5">
                      <OperatingHoursStrip asset={rig} />
                    </div>
                    {(() => {
                      const totalUnits = (rig.linked_equipment_ids || []).length + 1;
                      const pct = totalUnits > 0 ? Math.round((rollup.counts.compliant / totalUnits) * 100) : 0;
                      return (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Compliance</span>
                            <span className="font-semibold text-slate-600">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    <RigUtilizationSparkline rigId={rig.id} />
                    {rig.next_service_date && <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><ScanLine className="w-3 h-3" /> Next service {safeFmt(rig.next_service_date)}</p>}
                    <div className="mt-2 flex gap-1.5">
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onCertVault(rig); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCertVault(rig); } }} className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 text-[#2E5A1A] rounded-lg text-[11px] font-semibold transition justify-center">
                        <Lock className="w-3.5 h-3.5" /> Certs
                      </span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUploadCert?.(rig); }} className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A] hover:bg-[#244715] text-white rounded-lg text-[11px] font-semibold transition justify-center">
                        <Upload className="w-3.5 h-3.5" /> Upload Cert
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipment cards */}
      {showEquip && filteredEquip.length > 0 && (() => {
        // Group equipment by the selected dimension (none/type/location/status)
        const groupKey = (eq) => {
          if (groupBy === 'type') return eq.asset_type || 'other';
          if (groupBy === 'location') return eq.storage_location || 'Unspecified';
          if (groupBy === 'status') return derivedComplianceStatus(eq) || 'unknown';
          return 'all';
        };
        const groupLabel = (key) => {
          if (groupBy === 'type') return (ASSET_TYPE_META[key]?.label || key);
          if (groupBy === 'status') return (COMPLIANCE_META[key]?.label || key);
          return key;
        };
        const groups = groupBy === 'none'
          ? [{ key: 'all', items: filteredEquip }]
          : Object.entries(
              filteredEquip.reduce((m, entry) => {
                const k = groupKey(entry.equip);
                (m[k] = m[k] || []).push(entry);
                return m;
              }, {})
            ).map(([key, items]) => ({ key, items }));

        return groups.map((group) => (
        <div key={group.key} className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <Wrench className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              {depotOnly && groupBy === 'none' ? 'Depot Equipment' : 'Equipment'} {groupBy !== 'none' && <span className="text-slate-500 normal-case tracking-normal">· {groupLabel(group.key)}</span>} <span className="text-slate-400 font-normal normal-case tracking-normal">({group.items.length})</span>
            </h3>
            {depotOnly && groupBy === 'none' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                <Warehouse className="w-3 h-3" /> Ready to assign
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.items.map(({ equip, parentRig }) => {
              const liveStatus = derivedComplianceStatus(equip);
              const meta = COMPLIANCE_META[liveStatus];
              const Icon = TYPE_ICON[equip.asset_type] || Wrench;
              const statusAccent = liveStatus === 'expired' ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : liveStatus === 'expiring' ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-100' : liveStatus === 'unknown' ? 'border-l-4 border-l-slate-400 ring-1 ring-slate-100' : 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-100';
              const grad = TYPE_GRADIENT[equip.asset_type] || 'from-slate-500 to-slate-700';
              const d = daysUntil(equip.compliance_expiry_date);
              const isSel = selected.has(equip.id);
              const depotTagged = isInDepot(equip);
              const ready = isReady(equip);
              const handleCardClick = () => {
                if (selectionMode) {
                  setSelected(prev => { const n = new Set(prev); n.has(equip.id) ? n.delete(equip.id) : n.add(equip.id); return n; });
                } else { onOpenEquip(equip); }
              };
              return (
                <div key={equip.id} onClick={handleCardClick} className={`insight-card rounded-xl text-left relative ${statusAccent} ${selectionMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-lg'} ${isSel ? 'ring-2 ring-emerald-500' : ''} ${depotTagged ? 'ring-1 ring-emerald-200' : ''} overflow-hidden`}>
                  {selectionMode && <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center border-2 transition z-20 ${isSel ? 'bg-emerald-500 border-emerald-500' : 'bg-white/80 border-slate-300'}`}>{isSel && <Check className="w-4 h-4 text-white" />}</div>}
                  <AssetCardBanner asset={equip} heightClass="h-28" />
                  {depotTagged && !selectionMode && (
                    <span className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5 shadow-sm z-10">
                      <Warehouse className="w-2.5 h-2.5" /> IN DEPOT
                    </span>
                  )}
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{equip.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {equip.fleet_number ? `FAA ${equip.fleet_number}` : equip.serial_number || ''}
                        </p>
                      </div>
                      {!selectionMode && <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                    </div>
                    {/* 3 spec chips */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {(equip.make || equip.model) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[120px]">
                          {[equip.make, equip.model].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {equip.hours_used != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <Clock className="w-2.5 h-2.5" /> {equip.hours_used}h
                        </span>
                      )}
                      {equip.storage_location && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[120px]">
                          <MapPin className="w-2.5 h-2.5" /> {equip.storage_location}
                        </span>
                      )}
                      {isCasingItem(equip) && equip.length != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                          <Ruler className="w-2.5 h-2.5" /> {equip.length}m
                        </span>
                      )}
                      <QuantityBadge available={equip.quantity_available} owned={equip.quantity_owned} />
                      {equip.weight_kg != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          <Weight className="w-2.5 h-2.5" /> {Math.round(equip.weight_kg)} kg
                        </span>
                      )}
                    </div>
                    {/* Financial + lifecycle + utilization strip */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <FinancialChip asset={equip} />
                      <LifecycleBadge asset={equip} />
                    </div>
                    {(equip.operating_hours || equip.service_interval_hours) && (
                      <div className="mb-1.5">
                        <OperatingHoursStrip asset={equip} />
                      </div>
                    )}
                    {/* Footer: condition + source + parent rig + expiry */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {equip.condition && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${conditionTone(equip.condition)}`}>
                          <Gauge className="w-2.5 h-2.5" /> {equip.condition}
                        </span>
                      )}
                      {equip.panda_asset_id
                        ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200" title={syncTitle(equip)}><Database className="w-2.5 h-2.5" /> Panda</span>
                        : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200" title={syncTitle(equip)}><CircleDot className="w-2.5 h-2.5" /> Local</span>}
                      {parentRig && <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5"><Link2 className="w-3 h-3" /> {parentRig.name}</span>}
                    </div>
                    {d !== null && (
                      <p className={`text-[10px] font-medium mt-1.5 flex items-center gap-1 ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                        <CalendarClock className="w-3 h-3" /> {d < 0 ? 'Expired' : `${d}d left`} · {safeFmt(equip.compliance_expiry_date)}
                      </p>
                    )}
                    {!selectionMode && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUploadCert?.(equip); }} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A] hover:bg-[#244715] text-white rounded-lg text-[11px] font-semibold transition">
                        <Upload className="w-3.5 h-3.5" /> Upload Cert
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        ));
      })()}
    </div>
  );
}